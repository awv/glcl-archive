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
}

// MARK: - Dataset Loader
func loadBibDatabase(from dataPath: String, targetSeason: String?, targetRace: Int?) -> [String: RunnerRecord] {
    let url = URL(fileURLWithPath: dataPath)
    guard let content = try? String(contentsOf: url, encoding: .utf8) else {
        print("\(Color.red)Error: Could not read dataset at \(dataPath)\(Color.reset)")
        return [:]
    }
    
    // Check if it's a plain text results file (e.g. from results_source/*.txt)
    if dataPath.hasSuffix(".txt") {
        return loadBibsFromTextFile(content: content, season: targetSeason ?? "2026/2027", race: targetRace)
    }
    
    guard let startIdx = content.firstIndex(of: "["),
          let endIdx = content.lastIndex(of: "]") else {
        print("\(Color.red)Error: JSON array not found in \(dataPath)\(Color.reset)")
        return [:]
    }
    
    let jsonString = String(content[startIdx...endIdx])
    guard let jsonData = jsonString.data(using: .utf8),
          let records = try? JSONSerialization.jsonObject(with: jsonData, options: []) as? [[String: Any]] else {
        print("\(Color.red)Error: Failed to parse records from \(dataPath)\(Color.reset)")
        return [:]
    }
    
    var bibMap: [String: RunnerRecord] = [:]
    for r in records {
        var bibStr = ""
        if let bInt = r["bib"] as? Int {
            bibStr = String(bInt)
        } else if let bStr = r["bib"] as? String {
            bibStr = bStr
        }
        
        guard !bibStr.isEmpty, bibStr != "0" else { continue }
        
        let seasonStr = r["season"] as? String ?? ""
        if let targetSeason = targetSeason, !seasonStr.isEmpty {
            if !seasonStr.lowercased().contains(targetSeason.lowercased()) {
                continue
            }
        }
        
        let raceNum = r["race_number"] as? Int
        if let targetRace = targetRace, let rn = raceNum {
            if rn != targetRace { continue }
        }
        
        let record = RunnerRecord(
            name: r["name"] as? String ?? "Unknown",
            bib: bibStr,
            club: r["club"] as? String ?? "",
            season: seasonStr,
            raceNumber: raceNum
        )
        bibMap[bibStr] = record
    }
    
    return bibMap
}

func loadBibsFromTextFile(content: String, season: String, race: Int?) -> [String: RunnerRecord] {
    var bibMap: [String: RunnerRecord] = [:]
    let lines = content.components(separatedBy: .newlines)
    
    for line in lines {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }
        
        // Tab-separated or comma-separated
        let parts = trimmed.contains("\t") ? trimmed.components(separatedBy: "\t") : trimmed.components(separatedBy: ",")
        if parts.count >= 3 {
            // Pos, Bib, Name, Cat, Club, Time...
            let p1 = parts[0].trimmingCharacters(in: .whitespaces)
            let p2 = parts[1].trimmingCharacters(in: .whitespaces)
            let p3 = parts[2].trimmingCharacters(in: .whitespaces)
            let p4 = parts.count > 3 ? parts[3].trimmingCharacters(in: .whitespaces) : ""
            let p5 = parts.count > 4 ? parts[4].trimmingCharacters(in: .whitespaces) : ""
            
            var bibStr = ""
            var nameStr = ""
            var clubStr = ""
            
            if let _ = Int(p2) {
                bibStr = p2
                nameStr = p3
                clubStr = p5
            } else if let _ = Int(p1) {
                // If column 0 is bib or position
                bibStr = p1
                nameStr = p2
                clubStr = p4
            }
            
            if !bibStr.isEmpty && bibStr != "0" {
                bibMap[bibStr] = RunnerRecord(
                    name: nameStr,
                    bib: bibStr,
                    club: clubStr,
                    season: season,
                    raceNumber: race
                )
            }
        }
    }
    return bibMap
}

// MARK: - Lossless Metadata Writer
func writeTagsToJPEG(url: URL, tags: [String]) -> Bool {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return false }
    
    let tempURL = url.deletingLastPathComponent().appendingPathComponent(".glcl_tmp_" + url.lastPathComponent)
    guard let dest = CGImageDestinationCreateWithURL(tempURL as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else {
        return false
    }
    
    // Copy existing metadata or create new
    let metadata = CGImageSourceCopyMetadataAtIndex(source, 0, nil).flatMap { CGImageMetadataCreateMutableCopy($0) } ?? CGImageMetadataCreateMutable()
    
    // Register Dublin Core namespace
    let dcNS = "http://purl.org/dc/elements/1.1/" as CFString
    let dcPrefix = "dc" as CFString
    CGImageMetadataRegisterNamespaceForPrefix(metadata, dcNS, dcPrefix, nil)
    
    // Set dc:subject array
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
    
    // Replace original atomically
    _ = try? FileManager.default.removeItem(at: url)
    do {
        try FileManager.default.moveItem(at: tempURL, to: url)
        return true
    } catch {
        return false
    }
}

// MARK: - OCR Scanner
func scanPhoto(url: URL, bibMap: [String: RunnerRecord], minConfidence: Float) -> MatchResult? {
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
                
                // Match against database
                if let runner = bibMap[numStr] {
                    if bestMatch == nil || token.conf > bestMatch!.conf {
                        bestMatch = (numStr, runner, token.conf)
                    }
                } else if bibMap.isEmpty {
                    if token.conf >= minConfidence && (bestMatch == nil || token.conf > bestMatch!.conf) {
                        bestMatch = (numStr, nil, token.conf)
                    }
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
    \(Color.bold)GLCL Race Photo Tagger (Apple Neural Engine)\(Color.reset)
    
    Usage:
      glcl-tagger <directory-of-photos> [options]
      
    Options:
      --season <name>     Filter valid bibs to a season (e.g. "2024/2025" or "2026/2027")
      --race <num>        Filter valid bibs to race number (e.g. 1)
      --data <path>       Path to data.js or results .txt file (default: looks in ./data.js)
      --write             Write tags into JPEG files (Default is safe DRY-RUN mode)
      --min-conf <float>  Minimum OCR confidence threshold (default: 0.6)
      -h, --help          Show this help message
      
    Examples:
      # 1. Preview tags in dry-run mode (safe, modifies no files):
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
    
    print("\(Color.bold)======================================================\(Color.reset)")
    print("\(Color.cyan)\(Color.bold)🏃 GLCL Race Photo Tagger (Apple Neural Engine)\(Color.reset)")
    print("\(Color.bold)======================================================\(Color.reset)")
    print("Folder:       \(targetDir)")
    print("Mode:         \(writeMode ? "\(Color.yellow)\(Color.bold)WRITE (Saving tags into photos)\(Color.reset)" : "\(Color.green)\(Color.bold)DRY-RUN (Safe preview, no files modified)\(Color.reset)")")
    if let s = season { print("Season:       \(s)") }
    if let r = raceNumber { print("Race #:       \(r)") }
    
    let t0 = Date()
    var bibMap: [String: RunnerRecord] = [:]
    if let dp = dataPath {
        bibMap = loadBibDatabase(from: dp, targetSeason: season, targetRace: raceNumber)
        let parseTime = Date().timeIntervalSince(t0)
        print("Database:     \(dp) (\(bibMap.count) valid bibs loaded in \(String(format: "%.2f", parseTime))s)")
    } else {
        print("\(Color.yellow)Warning: data.js not found. Running in ungrounded mode.\(Color.reset)")
    }
    print("------------------------------------------------------")
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
        
        if let match = scanPhoto(url: url, bibMap: bibMap, minConfidence: minConfidence) {
            matchedCount += 1
            let runnerDesc = match.runner != nil ? "\(match.runner!.name) (\(match.runner!.club))" : "Unregistered"
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
    
    print("\n\(Color.bold)======================================================\(Color.reset)")
    print("\(Color.bold)SCAN COMPLETE\(Color.reset)")
    print("Total Photos:   \(photoURLs.count)")
    print("Bibs Tagged:    \(Color.green)\(Color.bold)\(matchedCount)\(Color.reset) (\(Int(Double(matchedCount)/Double(photoURLs.count)*100))%)")
    print("Scan Duration:  \(String(format: "%.2f", elapsed))s (avg \(String(format: "%.3f", avgPerPhoto))s/photo)")
    if !writeMode && matchedCount > 0 {
        print("\n\(Color.yellow)\(Color.bold)💡 Tip:\(Color.reset) This was a dry-run. Add \(Color.cyan)--write\(Color.reset) to save tags into the photos before uploading to Flickr.")
    }
    print("\(Color.bold)======================================================\(Color.reset)\n")
}

main()
