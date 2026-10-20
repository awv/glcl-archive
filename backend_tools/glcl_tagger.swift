import Foundation
import Vision
import ImageIO
import UniformTypeIdentifiers

// MARK: - Models
struct RunnerRecord {
    let name: String
    let bib: String
    let club: String
    let season: String
    let raceNumber: Int?
    let isInherited: Bool
    let isLifetimeFallback: Bool
}

struct MatchResult {
    let photoURL: URL
    let bib: String
    let runner: RunnerRecord?
    let confidence: Float
    let detectedWords: [String]
}

// MARK: - CLI Colors
enum Color {
    static let reset = "\u{001B}[0m"
    static let bold = "\u{001B}[1m"
    static let green = "\u{001B}[32m"
    static let yellow = "\u{001B}[33m"
    static let blue = "\u{001B}[34m"
    static let cyan = "\u{001B}[36m"
    static let red = "\u{001B}[31m"
    static let dim = "\u{001B}[2m"
    static let magenta = "\u{001B}[35m"
}

// MARK: - Helper Functions
func cleanRunnerName(_ raw: String) -> String {
    return raw.replacingOccurrences(of: ",", with: " ")
        .lowercased()
        .components(separatedBy: .whitespacesAndNewlines)
        .filter { !$0.isEmpty }
        .joined(separator: " ")
}

func parseSeasonYear(_ seasonStr: String) -> Int {
    let parts = seasonStr.components(separatedBy: CharacterSet(charactersIn: "/-_"))
    if let first = parts.first, let yr = Int(first.trimmingCharacters(in: .whitespaces)) {
        return yr < 100 ? yr + 2000 : yr
    }
    return 0
}

// MARK: - Intelligent Dataset Loader
func loadBibDatabase(from dataPath: String, targetSeason: String?, targetRace: Int?) -> (activeBibMap: [String: RunnerRecord], lifetimeBibMap: [String: RunnerRecord], inheritedCount: Int) {
    let url = URL(fileURLWithPath: dataPath)
    guard let content = try? String(contentsOf: url, encoding: .utf8) else {
        print("\(Color.red)Error: Could not read dataset at \(dataPath)\(Color.reset)")
        return ([:], [:], 0)
    }
    
    guard let startIdx = content.firstIndex(of: "["),
          let endIdx = content.lastIndex(of: "]") else {
        print("\(Color.red)Error: JSON array not found in \(dataPath)\(Color.reset)")
        return ([:], [:], 0)
    }
    
    let jsonString = String(content[startIdx...endIdx])
    guard let jsonData = jsonString.data(using: .utf8),
          let records = try? JSONSerialization.jsonObject(with: jsonData, options: []) as? [[String: Any]] else {
        print("\(Color.red)Error: Failed to parse records from \(dataPath)\(Color.reset)")
        return ([:], [:], 0)
    }
    
    // 1. Sort all historical records chronologically by season year ascending
    let sortedRecords = records.sorted { r1, r2 in
        let s1 = parseSeasonYear(r1["season"] as? String ?? "")
        let s2 = parseSeasonYear(r2["season"] as? String ?? "")
        return s1 < s2
    }
    
    // 2. Build multi-year athlete lifetime registry: [CleanName: LatestValidBibRecord] and [Bib: LatestRecord]
    var lifetimeRunnerRegistry: [String: RunnerRecord] = [:]
    var lifetimeBibMap: [String: RunnerRecord] = [:]
    
    for r in sortedRecords {
        var bibStr = ""
        if let bInt = r["bib"] as? Int {
            bibStr = String(bInt)
        } else if let bStr = r["bib"] as? String {
            bibStr = bStr
        }
        bibStr = bibStr.trimmingCharacters(in: .whitespaces)
        guard !bibStr.isEmpty, bibStr != "0" else { continue }
        
        let rawName = r["name"] as? String ?? ""
        let cleanName = cleanRunnerName(rawName)
        guard !cleanName.isEmpty else { continue }
        
        let seasonStr = r["season"] as? String ?? ""
        let clubStr = r["club"] as? String ?? ""
        let raceNum = r["race_number"] as? Int
        
        let record = RunnerRecord(
            name: rawName,
            bib: bibStr,
            club: clubStr,
            season: seasonStr,
            raceNumber: raceNum,
            isInherited: false,
            isLifetimeFallback: true
        )
        lifetimeRunnerRegistry[cleanName] = record
        lifetimeBibMap[bibStr] = record
    }
    
    // 3. Build target season active roster
    var activeBibMap: [String: RunnerRecord] = [:]
    var inheritedCount = 0
    let cleanTargetSeason = targetSeason?.lowercased().trimmingCharacters(in: .whitespaces)
    
    for r in sortedRecords {
        let seasonStr = r["season"] as? String ?? ""
        let rawName = r["name"] as? String ?? ""
        let cleanName = cleanRunnerName(rawName)
        let clubStr = r["club"] as? String ?? ""
        let raceNum = r["race_number"] as? Int
        
        var bibStr = ""
        if let bInt = r["bib"] as? Int { bibStr = String(bInt) }
        else if let bStr = r["bib"] as? String { bibStr = bStr }
        bibStr = bibStr.trimmingCharacters(in: .whitespaces)
        
        if let ts = cleanTargetSeason, !ts.isEmpty {
            if !seasonStr.lowercased().contains(ts) { continue }
        }
        
        if let tr = targetRace, let rn = raceNum {
            if rn != tr { continue }
        }
        
        if !bibStr.isEmpty && bibStr != "0" {
            let record = RunnerRecord(
                name: rawName,
                bib: bibStr,
                club: clubStr,
                season: seasonStr,
                raceNumber: raceNum,
                isInherited: false,
                isLifetimeFallback: false
            )
            activeBibMap[bibStr] = record
        } else {
            // Intelligent Fallback: Check if athlete had a persistent bib in prior seasons
            if let prior = lifetimeRunnerRegistry[cleanName] {
                let inheritedRecord = RunnerRecord(
                    name: rawName.isEmpty ? prior.name : rawName,
                    bib: prior.bib,
                    club: clubStr.isEmpty ? prior.club : clubStr,
                    season: seasonStr.isEmpty ? prior.season : seasonStr,
                    raceNumber: raceNum,
                    isInherited: true,
                    isLifetimeFallback: false
                )
                if activeBibMap[prior.bib] == nil {
                    activeBibMap[prior.bib] = inheritedRecord
                    inheritedCount += 1
                }
            }
        }
    }
    
    return (activeBibMap, lifetimeBibMap, inheritedCount)
}

// MARK: - Lossless Metadata Writer
func writeTagsToJPEG(url: URL, tags: [String]) -> Bool {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return false }
    
    let tempURL = url.deletingLastPathComponent().appendingPathComponent(".glcl_tmp_" + url.lastPathComponent)
    guard let dest = CGImageDestinationCreateWithURL(tempURL as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else {
        return false
    }
    
    let metadata = CGImageSourceCopyMetadataAtIndex(source, 0, nil).flatMap { CGImageMetadataCreateMutableCopy($0) } ?? CGImageMetadataCreateMutable()
    
    let dcNS = "http://purl.org/dc/elements/1.1/" as CFString
    let dcPrefix = "dc" as CFString
    CGImageMetadataRegisterNamespaceForPrefix(metadata, dcNS, dcPrefix, nil)
    
    let tagArray = tags as CFArray
    guard let tagItem = CGImageMetadataTagCreate(dcNS, dcPrefix, "subject" as CFString, .arrayUnordered, tagArray) else {
        return false
    }
    CGImageMetadataSetTagWithPath(metadata, nil, "dc:subject" as CFString, tagItem)
    
    let options: [CFString: Any] = [
        kCGImageDestinationMetadata: metadata,
        kCGImageDestinationMergeMetadata: true
    ]
    
    var error: Unmanaged<CFError>?
    let success = CGImageDestinationCopyImageSource(dest, source, options as CFDictionary, &error)
    guard success else {
        _ = try? FileManager.default.removeItem(at: tempURL)
        return false
    }
    
    _ = try? FileManager.default.removeItem(at: url)
    do {
        try FileManager.default.moveItem(at: tempURL, to: url)
        return true
    } catch {
        return false
    }
}

// MARK: - OCR Scanner
func scanPhoto(url: URL, activeBibMap: [String: RunnerRecord], lifetimeBibMap: [String: RunnerRecord], minConfidence: Float) -> MatchResult? {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        return nil
    }
    
    var detectedTokens: [(text: String, conf: Float)] = []
    
    let request = VNRecognizeTextRequest { req, err in
        guard let observations = req.results as? [VNRecognizedTextObservation] else { return }
        for obs in observations {
            if let top = obs.topCandidates(1).first {
                detectedTokens.append((top.string, top.confidence))
            }
        }
    }
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try? handler.perform([request])
    
    var bestMatch: (bib: String, runner: RunnerRecord?, conf: Float)? = nil
    
    for token in detectedTokens {
        let pattern = "\\b\\d{1,4}\\b"
        if let regex = try? NSRegularExpression(pattern: pattern) {
            let nsStr = token.text as NSString
            let matches = regex.matches(in: token.text, range: NSRange(location: 0, length: nsStr.length))
            
            for m in matches {
                let numStr = nsStr.substring(with: m.range)
                
                // Skip common calendar year numbers
                if ["2024", "2025", "2026", "2027", "24", "25", "26", "27"].contains(numStr) {
                    continue
                }
                
                // Tier 1: Active Season Runner match (Highest Priority)
                if let runner = activeBibMap[numStr] {
                    if bestMatch == nil || token.conf > bestMatch!.conf || (bestMatch!.runner?.isLifetimeFallback == true) {
                        bestMatch = (numStr, runner, token.conf)
                        continue
                    }
                }
                
                // Tier 2: Unregistered candidate within active season (Confirms bib number without guessing wrong runner)
                if !activeBibMap.isEmpty {
                    if token.conf >= minConfidence && (bestMatch == nil || (bestMatch!.runner == nil && token.conf > bestMatch!.conf)) {
                        bestMatch = (numStr, nil, token.conf)
                    }
                    continue
                }
                
                // Tier 3: Ungrounded fallback (Only if no active season roster was provided)
                if let runner = lifetimeBibMap[numStr] {
                    if bestMatch == nil || (token.conf > bestMatch!.conf && bestMatch!.runner?.isLifetimeFallback == true) {
                        bestMatch = (numStr, runner, token.conf)
                        continue
                    }
                }
                
                // Tier 4: Unregistered candidate when no database is available
                if token.conf >= minConfidence && (bestMatch == nil || token.conf > bestMatch!.conf) {
                    bestMatch = (numStr, nil, token.conf)
                }
            }
        }
    }
    
    if let match = bestMatch {
        return MatchResult(
            photoURL: url,
            bib: match.bib,
            runner: match.runner,
            confidence: match.conf,
            detectedWords: detectedTokens.map { $0.text }
        )
    }
    
    return nil
}

// MARK: - Main CLI
func printUsage() {
    print("""
    \(Color.bold)GLCL Race Photo Tagger (Apple Neural Engine + Persistent Bib Intelligence)\(Color.reset)
    
    Usage:
      glcl-tagger <directory-of-photos> [options]
      
    Options:
      --season <name>     Target season (e.g. "2026/2027"). Automatically resolves persistent
                          bibs carried over from prior seasons if numbers were omitted in results.
      --race <num>        Filter to race fixture number (e.g. 1)
      --data <path>       Path to data.js (default: looks in ./data.js)
      --write             Write tags into JPEG files (Default is safe DRY-RUN mode)
      --min-conf <float>  Minimum OCR confidence threshold (default: 0.6)
      -h, --help          Show this help message
      
    Examples:
      # 1. Preview tags for Sunday's Glebelands race in dry-run mode:
      ./backend_tools/glcl-tagger ~/Pictures/XC_Glebelands --season 2026/2027
      
      # 2. Save tags into photos before uploading to Flickr:
      ./backend_tools/glcl-tagger ~/Pictures/XC_Glebelands --season 2026/2027 --write
    """)
}

func main() {
    let args = CommandLine.arguments
    guard args.count > 1 else {
        printUsage()
        exit(0)
    }
    
    if args.contains("-h") || args.contains("--help") {
        printUsage()
        exit(0)
    }
    
    let targetDir = args[1]
    var season: String? = nil
    var raceNumber: Int? = nil
    var dataPath: String? = nil
    var writeMode = false
    var minConfidence: Float = 0.6
    
    var idx = 2
    while idx < args.count {
        switch args[idx] {
        case "--season":
            if idx + 1 < args.count { season = args[idx + 1]; idx += 1 }
        case "--race":
            if idx + 1 < args.count { raceNumber = Int(args[idx + 1]); idx += 1 }
        case "--data":
            if idx + 1 < args.count { dataPath = args[idx + 1]; idx += 1 }
        case "--write":
            writeMode = true
        case "--min-conf":
            if idx + 1 < args.count { minConfidence = Float(args[idx + 1]) ?? 0.6; idx += 1 }
        default:
            break
        }
        idx += 1
    }
    
    if dataPath == nil {
        let candidates = ["./data.js", "../data.js", "../../data.js", "data.js"]
        for c in candidates {
            if FileManager.default.fileExists(atPath: c) {
                dataPath = c
                break
            }
        }
    }
    
    print("\(Color.bold)=================================================================\(Color.reset)")
    print("\(Color.cyan)\(Color.bold)🏃 GLCL Race Photo Tagger (Apple Neural Engine + Bib Intelligence)\(Color.reset)")
    print("\(Color.bold)=================================================================\(Color.reset)")
    print("Folder:       \(targetDir)")
    print("Mode:         \(writeMode ? "\(Color.yellow)\(Color.bold)WRITE (Saving tags into photos)\(Color.reset)" : "\(Color.green)\(Color.bold)DRY-RUN (Safe preview, no files modified)\(Color.reset)")")
    if let s = season { print("Season:       \(s)") }
    if let r = raceNumber { print("Race #:       \(r)") }
    
    let t0 = Date()
    var activeBibMap: [String: RunnerRecord] = [:]
    var lifetimeBibMap: [String: RunnerRecord] = [:]
    var inheritedCount = 0
    
    if let dp = dataPath {
        let res = loadBibDatabase(from: dp, targetSeason: season, targetRace: raceNumber)
        activeBibMap = res.activeBibMap
        lifetimeBibMap = res.lifetimeBibMap
        inheritedCount = res.inheritedCount
        let parseTime = Date().timeIntervalSince(t0)
        print("Database:     \(dp) (\(lifetimeBibMap.count) lifetime GLCL bibs indexed in \(String(format: "%.2f", parseTime))s)")
        if inheritedCount > 0 {
            print("Intelligence: \(Color.green)\(Color.bold)\(inheritedCount)\(Color.reset) persistent runner bibs carried over for Season \(season ?? "current")")
        }
    } else {
        print("\(Color.yellow)Warning: data.js not found. Running in ungrounded mode.\(Color.reset)")
    }
    print("-----------------------------------------------------------------")
    fflush(stdout)
    
    let fileManager = FileManager.default
    let dirURL = URL(fileURLWithPath: targetDir)
    
    var photoURLs: [URL] = []
    if let enumerator = fileManager.enumerator(at: dirURL, includingPropertiesForKeys: nil) {
        for case let fileURL as URL in enumerator {
            let ext = fileURL.pathExtension.lowercased()
            if ["jpg", "jpeg"].contains(ext) && !fileURL.lastPathComponent.hasPrefix(".") {
                photoURLs.append(fileURL)
            }
        }
    }
    
    photoURLs.sort { $0.lastPathComponent < $1.lastPathComponent }
    
    if photoURLs.isEmpty {
        print("\(Color.red)No JPEG photos found in \(targetDir)\(Color.reset)")
        exit(1)
    }
    
    print("Processing \(Color.bold)\(photoURLs.count)\(Color.reset) photos...\n")
    fflush(stdout)
    
    var matchedCount = 0
    let scanStart = Date()
    
    for (i, url) in photoURLs.enumerated() {
        let prefix = "[\(i + 1)/\(photoURLs.count)] \(url.lastPathComponent): "
        
        if let match = scanPhoto(url: url, activeBibMap: activeBibMap, lifetimeBibMap: lifetimeBibMap, minConfidence: minConfidence) {
            matchedCount += 1
            var runnerDesc = "Unregistered"
            if let r = match.runner {
                var badge = ""
                if r.isInherited {
                    badge = " \(Color.yellow)[inherited bib]\(Color.reset)"
                } else if r.isLifetimeFallback {
                    badge = " \(Color.magenta)[GLCL persistent: \(r.season)]\(Color.reset)"
                }
                runnerDesc = "\(r.name) (\(r.club))\(badge)"
            }
            print("\(prefix)\(Color.green)\(Color.bold)Bib #\(match.bib)\(Color.reset) → \(runnerDesc) \(Color.dim)[conf: \(String(format: "%.2f", match.confidence))]\(Color.reset)")
            
            if writeMode {
                var tags = ["bib\(match.bib)", match.bib]
                if let r = match.runner {
                    tags.append(r.name)
                    if !r.club.isEmpty { tags.append(r.club) }
                }
                let ok = writeTagsToJPEG(url: url, tags: tags)
                if ok {
                    print("  \(Color.green)↳ Saved tags: \(tags.joined(separator: ", "))\(Color.reset)")
                } else {
                    print("  \(Color.red)↳ Failed to write metadata\(Color.reset)")
                }
            }
        } else {
            print("\(prefix)\(Color.dim)No bib detected\(Color.reset)")
        }
        fflush(stdout)
    }
    
    let elapsed = Date().timeIntervalSince(scanStart)
    let avgPerPhoto = photoURLs.count > 0 ? elapsed / Double(photoURLs.count) : 0
    
    print("\n\(Color.bold)=================================================================\(Color.reset)")
    print("\(Color.bold)SCAN COMPLETE\(Color.reset)")
    print("Total Photos:   \(photoURLs.count)")
    print("Bibs Tagged:    \(Color.green)\(Color.bold)\(matchedCount)\(Color.reset) (\(Int(Double(matchedCount)/Double(photoURLs.count)*100))%)")
    print("Scan Duration:  \(String(format: "%.2f", elapsed))s (avg \(String(format: "%.3f", avgPerPhoto))s/photo)")
    if !writeMode && matchedCount > 0 {
        print("\n\(Color.yellow)\(Color.bold)💡 Tip:\(Color.reset) This was a dry-run. Add \(Color.cyan)--write\(Color.reset) to save tags into the photos before uploading to Flickr.")
    }
    print("\(Color.bold)=================================================================\(Color.reset)\n")
}

main()
