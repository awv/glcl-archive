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

struct RunnerMatch: Codable {
    let bib: String
    let name: String
    let club: String
    let confidence: Float
    let isInherited: Bool
    let isLifetimeFallback: Bool
    let bbox: [CGFloat] // [origin.x, origin.y, width, height]
}

struct MultiMatchResult {
    let photoURL: URL
    let matches: [RunnerMatch]
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
func loadBibDatabase(from dataPath: String, targetSeason: String?, targetRace: Int?, targetDiscipline: String? = nil) -> (activeBibMap: [String: RunnerRecord], lifetimeBibMap: [String: RunnerRecord], inheritedCount: Int) {
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
    let cleanTargetDiscipline = targetDiscipline?.lowercased().trimmingCharacters(in: .whitespaces)
    
    for r in sortedRecords {
        let seasonStr = r["season"] as? String ?? ""
        let discStr = r["discipline"] as? String ?? ""
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
        
        if let td = cleanTargetDiscipline, !td.isEmpty {
            if !discStr.lowercased().contains(td) { continue }
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

// MARK: - Club Vest Color Validation
func sampleVestColor(cgImage: CGImage, bibBBox: CGRect) -> (r: CGFloat, g: CGFloat, b: CGFloat)? {
    // In Vision normalized coordinates: y=0 is bottom, y=1 is top
    let imgW = CGFloat(cgImage.width)
    let imgH = CGFloat(cgImage.height)
    
    // Chest area is directly above the bib
    let vestNormY = bibBBox.origin.y + bibBBox.size.height
    let vestNormH = min(bibBBox.size.height * 1.5, 0.98 - vestNormY)
    guard vestNormH > 0.01 else { return nil }
    
    let vestNormX = max(0.0, bibBBox.origin.x - bibBBox.size.width * 0.2)
    let vestNormW = min(1.0 - vestNormX, bibBBox.size.width * 1.4)
    guard vestNormW > 0.01 else { return nil }
    
    // Convert to CGImage pixel coordinates (where y=0 is top)
    let pixelX = Int(vestNormX * imgW)
    let pixelY = Int((1.0 - (vestNormY + vestNormH)) * imgH)
    let pixelW = Int(vestNormW * imgW)
    let pixelH = Int(vestNormH * imgH)
    
    guard pixelW > 2 && pixelH > 2 else { return nil }
    guard let cropped = cgImage.cropping(to: CGRect(x: pixelX, y: pixelY, width: pixelW, height: pixelH)) else {
        return nil
    }
    
    // Bilinear downsample into a 1x1 context for average RGB
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    var pixelData = [UInt8](repeating: 0, count: 4)
    guard let context = CGContext(
        data: &pixelData,
        width: 1,
        height: 1,
        bitsPerComponent: 8,
        bytesPerRow: 4,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        return nil
    }
    
    context.interpolationQuality = .medium
    context.draw(cropped, in: CGRect(x: 0, y: 0, width: 1, height: 1))
    
    return (CGFloat(pixelData[0]), CGFloat(pixelData[1]), CGFloat(pixelData[2]))
}

// MARK: - Club Vest Color Validation
// Grounded against verified reference race photos in assets/images/Vests (10 GLCL clubs)
func isColorCompatibleWithClub(r: CGFloat, g: CGFloat, b: CGFloat, club: String) -> Bool {
    let c = club.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    
    // 1. SAFETY DEFAULTS FOR CROSS-COUNTRY & ROAD CONDITIONS:
    // Runners frequently wear black or white thermal underlayers, grey garments,
    // or carry race numbers pinned high. Mud and heavy shadow also neutralize color.
    // ALWAYS accept neutral, grayscale, black, or white torso samples.
    
    // Dark clothing / Black base tops / heavy shadows
    if r < 75 && g < 75 && b < 75 {
        return true
    }
    
    // White upper chest / white base tops / bib background paper
    if r > 185 && g > 185 && b > 185 {
        return true
    }
    
    // Low saturation / Grayscale / Neutral / Mud
    let maxChannel = max(r, max(g, b))
    let minChannel = min(r, min(g, b))
    let delta = maxChannel - minChannel
    if delta < 28 {
        return true
    }
    
    // 2. DETECT DOMINANT CHROMATIC COLOR FAMILIES:
    let isGreen = g > 75 && g > r * 1.25 && g > b * 1.20
    let isRed = r > 85 && r > g * 1.40 && r > b * 1.40
    let isMaroon = r > 60 && r > g * 1.35 && g < 90 && b < r * 0.95 && !isRed
    let isRoyalBlue = b > 80 && b > r * 1.25 && b > g * 1.15
    let isSkyBlue = b > 85 && g > 75 && b > r * 1.20 && (g > r * 1.05 || b > g * 1.25) && !isRoyalBlue
    let isPurple = (r > 55 && b > 65) && (min(r, b) > g * 1.20) && (r + b > g * 2.3)
    let isYellow = r > 115 && g > 105 && b < min(r, g) * 0.70
    
    // 3. APPLY MUTUAL-EXCLUSION CONTRADICTIONS PER CLUB:
    if c.contains("parc bryn bach") || c == "pbb" {
        if isMaroon || isRoyalBlue || isPurple { return false }
    } else if c.contains("lliswerry") {
        if isGreen || isRoyalBlue || isSkyBlue || isPurple || isYellow { return false }
    } else if c.contains("chepstow") {
        if isGreen || isMaroon || isPurple { return false }
    } else if c.contains("fairwater") {
        if isGreen || isRed || isMaroon || isPurple || isYellow { return false }
    } else if c.contains("pont-y-pwl") || c.contains("pontypool") {
        if isGreen || isRoyalBlue || isSkyBlue || isPurple { return false }
    } else if c.contains("monmouth") {
        if isGreen || isRed || isMaroon || isPurple { return false }
    } else if c.contains("caerleon") {
        if isGreen || isRed || isSkyBlue || isYellow { return false }
    } else if c.contains("caldicot") {
        if isGreen || isRed || isSkyBlue || isYellow { return false }
    } else if c.contains("griffithstown") {
        if isRed || isMaroon || isPurple { return false }
    } else if c.contains("islwyn") {
        if isGreen || isRed || isSkyBlue || isRoyalBlue || isYellow { return false }
    }
    
    return true
}

// MARK: - Head & Body Grounding Filter
/// Verifies that a detected bib has a head/face above it belonging to this runner.
/// Discards partial glimpses of numbers where the runner's head is cropped out of frame.
func hasHeadAboveBib(bibBox: CGRect, faces: [VNFaceObservation], humans: [VNHumanObservation]) -> Bool {
    let bibMidX = bibBox.midX
    let bibMidY = bibBox.midY
    let bibMaxY = bibBox.origin.y + bibBox.size.height

    // 1. Direct Face Detection
    for face in faces {
        let fBox = face.boundingBox
        // Face must be vertically above the bib center
        guard fBox.midY > bibMidY else { continue }
        // Face chin should not be far below the bib top
        guard fBox.origin.y >= (bibBox.origin.y - bibBox.size.height * 0.35) else { continue }
        
        // Horizontal alignment: face center and bib center should be in the same vertical column
        let maxHOffset = max(fBox.size.width * 1.6, bibBox.size.width * 1.4, 0.09)
        guard abs(fBox.midX - bibMidX) <= maxHOffset else { continue }
        
        // Proportional scale check: face width vs bib width
        let ratio = fBox.size.width / max(bibBox.size.width, 0.001)
        guard ratio >= 0.18 && ratio <= 4.5 else { continue }
        
        // Vertical distance check: face chin shouldn't be excessively far from bib top
        let verticalGap = fBox.origin.y - bibMaxY
        let maxGap = max(bibBox.size.height * 5.0, fBox.size.height * 4.0, 0.40)
        guard verticalGap <= maxGap else { continue }
        
        return true
    }

    // 2. Human Upper-Body Detection (handles tilted heads, caps, dark sunglasses, profile angles)
    for human in humans {
        let hBox = human.boundingBox
        // Human box must encompass bib horizontally
        let minX = hBox.origin.x - 0.06
        let maxX = hBox.origin.x + hBox.size.width + 0.06
        guard bibMidX >= minX && bibMidX <= maxX else { continue }
        
        // Human box bottom must be near or below the bib
        guard hBox.origin.y <= bibMidY + bibBox.size.height * 0.6 else { continue }
        
        // AND human box top must extend significantly above the bib to contain head/neck
        let humanTop = hBox.origin.y + hBox.size.height
        guard humanTop >= bibMaxY + max(bibBox.size.height * 0.6, 0.05) else { continue }
        
        return true
    }

    return false
}

// MARK: - OCR & Vision Multi-Runner Scanner
func scanPhoto(
    url: URL,
    activeBibMap: [String: RunnerRecord],
    lifetimeBibMap: [String: RunnerRecord],
    minConfidence: Float,
    requireHead: Bool = true
) -> MultiMatchResult? {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        return nil
    }
    
    var detectedTokens: [(text: String, conf: Float, bbox: CGRect)] = []
    var faceObservations: [VNFaceObservation] = []
    var humanObservations: [VNHumanObservation] = []
    
    let textRequest = VNRecognizeTextRequest { req, err in
        guard let observations = req.results as? [VNRecognizedTextObservation] else { return }
        for obs in observations {
            if let top = obs.topCandidates(1).first {
                detectedTokens.append((top.string, top.confidence, obs.boundingBox))
            }
        }
    }
    // Revision 2 pinned to avoid macOS E5RT Neural Engine driver bug
    textRequest.revision = VNRecognizeTextRequestRevision2
    textRequest.recognitionLevel = .accurate
    textRequest.usesLanguageCorrection = false
    
    let faceRequest = VNDetectFaceRectanglesRequest { req, err in
        if let obs = req.results as? [VNFaceObservation] {
            faceObservations = obs
        }
    }
    
    let humanRequest = VNDetectHumanRectanglesRequest { req, err in
        if let obs = req.results as? [VNHumanObservation] {
            humanObservations = obs
        }
    }
    humanRequest.upperBodyOnly = true
    
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try? handler.perform([textRequest])
    try? handler.perform([faceRequest, humanRequest])
    
    var rawCandidates: [RunnerMatch] = []
    
    for token in detectedTokens {
        let pattern = "\\b\\d{1,7}\\b"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { continue }
        let nsStr = token.text as NSString
        let matches = regex.matches(in: token.text, range: NSRange(location: 0, length: nsStr.length))
        
        for m in matches {
            let numStr = nsStr.substring(with: m.range)
            
            // Skip common calendar year numbers
            if ["2024", "2025", "2026", "2027", "24", "25", "26", "27"].contains(numStr) {
                continue
            }
            
            let isShortBib = (numStr.count <= 2)
            
            // Spatial & Size Constraints on 1- and 2-digit numbers to eliminate background clutter
            if isShortBib {
                let area = token.bbox.width * token.bbox.height
                if area < 0.0006 || token.bbox.height < 0.016 {
                    continue
                }
                if token.bbox.origin.y < 0.06 || token.bbox.origin.y > 0.90 || token.bbox.origin.x < 0.05 || token.bbox.origin.x > 0.95 {
                    continue
                }
                if token.conf < 0.35 {
                    continue
                }
            }
            
            // HEAD FILTER: Must have head/face detected above this bib
            if requireHead {
                let hasHead = hasHeadAboveBib(bibBox: token.bbox, faces: faceObservations, humans: humanObservations)
                if !hasHead {
                    continue
                }
            }
            
            // Optional Vest Color Check: Sample torso above bib
            let vestColor = sampleVestColor(cgImage: cgImage, bibBBox: token.bbox)
            let bboxArr: [CGFloat] = [token.bbox.origin.x, token.bbox.origin.y, token.bbox.size.width, token.bbox.size.height]
            
            // Tier 1: Active Season Runner match (Highest Priority)
            if let runner = activeBibMap[numStr] {
                if let (r, g, b) = vestColor, !isColorCompatibleWithClub(r: r, g: g, b: b, club: runner.club) {
                    continue
                }
                rawCandidates.append(RunnerMatch(
                    bib: numStr,
                    name: runner.name,
                    club: runner.club,
                    confidence: token.conf,
                    isInherited: runner.isInherited,
                    isLifetimeFallback: false,
                    bbox: bboxArr
                ))
                continue
            }
            
            // Tier 2: Unregistered candidate within active season
            if !activeBibMap.isEmpty {
                if token.conf >= minConfidence {
                    rawCandidates.append(RunnerMatch(
                        bib: numStr,
                        name: "",
                        club: "",
                        confidence: token.conf,
                        isInherited: false,
                        isLifetimeFallback: false,
                        bbox: bboxArr
                    ))
                }
                continue
            }
            
            // Tier 3: Ungrounded fallback (Only if no active season roster was provided)
            if let runner = lifetimeBibMap[numStr] {
                if let (r, g, b) = vestColor, !isColorCompatibleWithClub(r: r, g: g, b: b, club: runner.club) {
                    continue
                }
                rawCandidates.append(RunnerMatch(
                    bib: numStr,
                    name: runner.name,
                    club: runner.club,
                    confidence: token.conf,
                    isInherited: runner.isInherited,
                    isLifetimeFallback: true,
                    bbox: bboxArr
                ))
                continue
            }
            
            // Tier 4: Unregistered candidate when no database is available
            if token.conf >= minConfidence {
                rawCandidates.append(RunnerMatch(
                    bib: numStr,
                    name: "",
                    club: "",
                    confidence: token.conf,
                    isInherited: false,
                    isLifetimeFallback: false,
                    bbox: bboxArr
                ))
            }
        }
    }
    
    // Deduplicate candidate bibs per photo:
    // Grounded active runners first, then by confidence descending, then by bib length descending
    let sortedCandidates = rawCandidates.sorted { c1, c2 in
        let g1 = (!c1.name.isEmpty && !c1.isLifetimeFallback) ? 1 : 0
        let g2 = (!c2.name.isEmpty && !c2.isLifetimeFallback) ? 1 : 0
        if g1 != g2 { return g1 > g2 }
        if c1.bib.count != c2.bib.count { return c1.bib.count > c2.bib.count }
        return c1.confidence > c2.confidence
    }
    
    var uniqueMatches: [RunnerMatch] = []
    
    for candidate in sortedCandidates {
        // Skip duplicate bib number on same runner
        if uniqueMatches.contains(where: { $0.bib == candidate.bib }) {
            continue
        }
        
        let cBox = CGRect(x: candidate.bbox[0], y: candidate.bbox[1], width: candidate.bbox[2], height: candidate.bbox[3])
        var isSpatialDuplicate = false
        
        for existing in uniqueMatches {
            let eBox = CGRect(x: existing.bbox[0], y: existing.bbox[1], width: existing.bbox[2], height: existing.bbox[3])
            let intersection = cBox.intersection(eBox)
            if !intersection.isNull && !intersection.isEmpty {
                let minArea = min(cBox.width * cBox.height, eBox.width * eBox.height)
                if minArea > 0 {
                    let overlapRatio = (intersection.width * intersection.height) / minArea
                    if overlapRatio > 0.30 {
                        isSpatialDuplicate = true
                        break
                    }
                }
            }
        }
        
        if !isSpatialDuplicate {
            uniqueMatches.append(candidate)
        }
    }
    
    // Sort unique matches by prominence: largest bib bounding box first (closest subject)
    uniqueMatches.sort { m1, m2 in
        let area1 = m1.bbox[2] * m1.bbox[3]
        let area2 = m2.bbox[2] * m2.bbox[3]
        return area1 > area2
    }
    
    return MultiMatchResult(
        photoURL: url,
        matches: uniqueMatches,
        detectedWords: detectedTokens.map { $0.text }
    )
}

// MARK: - Main CLI
func printUsage() {
    print("""
    \(Color.bold)GLCL Race Photo Tagger (Apple Neural Engine + Multi-Runner Intelligence)\(Color.reset)
    
    Usage:
      glcl-tagger <directory-of-photos> [options]
      
    Options:
      --season <name>       Target season (e.g. "2024/2025" or "2026/2027"). Automatically resolves
                            persistent bibs carried over from prior seasons.
      --race <num>          Filter to race fixture number (e.g. 5)
      --data <path>         Path to data.js (default: looks in ./data.js)
      --json                Output machine-readable JSON lines for streaming ingestion
      --no-head-filter      Disable head/face requirement (by default, headless bibs are omitted)
      --write               Write tags into JPEG files (Default is safe DRY-RUN mode)
      --min-conf <float>    Minimum OCR confidence threshold (default: 0.6)
      -h, --help            Show this help message
      
    Examples:
      # 1. Preview multi-runner tags for Sunday's race:
      ./backend_tools/glcl-tagger ~/Pictures/Road_Race5 --season 2025/2026 --race 5
      
      # 2. Stream JSON to indexing pipeline:
      ./backend_tools/glcl-tagger /tmp/batch --season 2025/2026 --race 5 --json
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
    var discipline: String? = nil
    var dataPath: String? = nil
    var writeMode = false
    var jsonOutput = false
    var requireHead = true
    var minConfidence: Float = 0.6
    
    var idx = 2
    while idx < args.count {
        switch args[idx] {
        case "--season":
            if idx + 1 < args.count { season = args[idx + 1]; idx += 1 }
        case "--race":
            if idx + 1 < args.count { raceNumber = Int(args[idx + 1]); idx += 1 }
        case "--discipline":
            if idx + 1 < args.count { discipline = args[idx + 1]; idx += 1 }
        case "--data":
            if idx + 1 < args.count { dataPath = args[idx + 1]; idx += 1 }
        case "--write":
            writeMode = true
        case "--json":
            jsonOutput = true
        case "--no-head-filter":
            requireHead = false
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
    
    if !jsonOutput {
        print("\(Color.bold)=================================================================\(Color.reset)")
        print("\(Color.cyan)\(Color.bold)🏃 GLCL Race Photo Tagger (Apple Neural Engine + Multi-Runner Intelligence)\(Color.reset)")
        print("\(Color.bold)=================================================================\(Color.reset)")
        print("Folder:       \(targetDir)")
        print("Mode:         \(writeMode ? "\(Color.yellow)\(Color.bold)WRITE (Saving tags into photos)\(Color.reset)" : "\(Color.green)\(Color.bold)DRY-RUN (Safe preview, no files modified)\(Color.reset)")")
        print("Head Filter:  \(requireHead ? "\(Color.green)ENABLED (Headless bib crops omitted)\(Color.reset)" : "\(Color.yellow)DISABLED\(Color.reset)")")
        if let s = season { print("Season:       \(s)") }
        if let d = discipline { print("Discipline:   \(d.uppercased())") }
        if let r = raceNumber { print("Race #:       \(r)") }
    }
    
    let t0 = Date()
    var activeBibMap: [String: RunnerRecord] = [:]
    var lifetimeBibMap: [String: RunnerRecord] = [:]
    var inheritedCount = 0
    
    if let dp = dataPath {
        let res = loadBibDatabase(from: dp, targetSeason: season, targetRace: raceNumber, targetDiscipline: discipline)
        activeBibMap = res.activeBibMap
        lifetimeBibMap = res.lifetimeBibMap
        inheritedCount = res.inheritedCount
        if !jsonOutput {
            let parseTime = Date().timeIntervalSince(t0)
            print("Database:     \(dp) (\(lifetimeBibMap.count) lifetime GLCL bibs indexed in \(String(format: "%.2f", parseTime))s)")
            if inheritedCount > 0 {
                print("Intelligence: \(Color.green)\(Color.bold)\(inheritedCount)\(Color.reset) persistent runner bibs carried over for Season \(season ?? "current")")
            }
            print("-----------------------------------------------------------------")
            fflush(stdout)
        }
    } else if !jsonOutput {
        print("\(Color.yellow)Warning: data.js not found. Running in ungrounded mode.\(Color.reset)")
    }
    
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
        if !jsonOutput {
            print("\(Color.red)No JPEG photos found in \(targetDir)\(Color.reset)")
        }
        exit(1)
    }
    
    if !jsonOutput {
        print("Processing \(Color.bold)\(photoURLs.count)\(Color.reset) photos...\n")
        fflush(stdout)
    }
    
    var matchedPhotosCount = 0
    var totalRunnersTagged = 0
    let scanStart = Date()
    
    for (i, url) in photoURLs.enumerated() {
        let prefix = "[\(i + 1)/\(photoURLs.count)] \(url.lastPathComponent): "
        
        let result = scanPhoto(
            url: url,
            activeBibMap: activeBibMap,
            lifetimeBibMap: lifetimeBibMap,
            minConfidence: minConfidence,
            requireHead: requireHead
        )
        
        let matches = result?.matches ?? []
        
        if jsonOutput {
            var matchDicts: [[String: Any]] = []
            for m in matches {
                matchDicts.append([
                    "bib": m.bib,
                    "name": m.name,
                    "club": m.club,
                    "conf": Double(round(m.confidence * 100.0) / 100.0),
                    "is_inherited": m.isInherited,
                    "is_lifetime": m.isLifetimeFallback,
                    "bbox": m.bbox.map { Double(round($0 * 1000.0) / 1000.0) }
                ])
            }
            let outObj: [String: Any] = [
                "photo": url.lastPathComponent,
                "matches": matchDicts
            ]
            if let data = try? JSONSerialization.data(withJSONObject: outObj, options: []),
               let jsonStr = String(data: data, encoding: .utf8) {
                print(jsonStr)
            }
            fflush(stdout)
            continue
        }
        
        if !matches.isEmpty {
            matchedPhotosCount += 1
            totalRunnersTagged += matches.count
            
            if matches.count == 1 {
                let m = matches[0]
                var runnerDesc = "Unregistered"
                if !m.name.isEmpty {
                    var badge = ""
                    if m.isInherited {
                        badge = " \(Color.yellow)[inherited bib]\(Color.reset)"
                    } else if m.isLifetimeFallback {
                        badge = " \(Color.magenta)[lifetime fallback]\(Color.reset)"
                    }
                    runnerDesc = "\(m.name) (\(m.club))\(badge)"
                }
                print("\(prefix)\(Color.green)\(Color.bold)Bib #\(m.bib)\(Color.reset) → \(runnerDesc) \(Color.dim)[conf: \(String(format: "%.2f", m.confidence))]\(Color.reset)")
            } else {
                print("\(prefix)\(Color.green)\(Color.bold)\(matches.count) Runners Detected\(Color.reset):")
                for m in matches {
                    var runnerDesc = "Unregistered"
                    if !m.name.isEmpty {
                        var badge = ""
                        if m.isInherited { badge = " \(Color.yellow)[inherited bib]\(Color.reset)" }
                        else if m.isLifetimeFallback { badge = " \(Color.magenta)[lifetime fallback]\(Color.reset)" }
                        runnerDesc = "\(m.name) (\(m.club))\(badge)"
                    }
                    print("  \(Color.cyan)↳ Bib #\(m.bib)\(Color.reset) → \(runnerDesc) \(Color.dim)[conf: \(String(format: "%.2f", m.confidence))]\(Color.reset)")
                }
            }
            
            if writeMode {
                var allTags: [String] = []
                for m in matches {
                    allTags.append("bib\(m.bib)")
                    allTags.append(m.bib)
                    if !m.name.isEmpty { allTags.append(m.name) }
                    if !m.club.isEmpty { allTags.append(m.club) }
                }
                let uniqueTags = Array(NSOrderedSet(array: allTags)) as? [String] ?? allTags
                let ok = writeTagsToJPEG(url: url, tags: uniqueTags)
                if ok {
                    print("  \(Color.green)↳ Saved tags: \(uniqueTags.joined(separator: ", "))\(Color.reset)")
                } else {
                    print("  \(Color.red)↳ Failed to write metadata\(Color.reset)")
                }
            }
        } else {
            print("\(prefix)\(Color.dim)No bib detected\(Color.reset)")
        }
        fflush(stdout)
    }
    
    if !jsonOutput {
        let elapsed = Date().timeIntervalSince(scanStart)
        let avgPerPhoto = photoURLs.count > 0 ? elapsed / Double(photoURLs.count) : 0
        
        print("\n\(Color.bold)=================================================================\(Color.reset)")
        print("\(Color.bold)SCAN COMPLETE\(Color.reset)")
        print("Total Photos:    \(photoURLs.count)")
        print("Photos Matched:  \(Color.green)\(Color.bold)\(matchedPhotosCount)\(Color.reset) (\(Int(Double(matchedPhotosCount)/Double(photoURLs.count)*100))%)")
        print("Runners Tagged:  \(Color.cyan)\(Color.bold)\(totalRunnersTagged)\(Color.reset)")
        print("Scan Duration:   \(String(format: "%.2f", elapsed))s (avg \(String(format: "%.3f", avgPerPhoto))s/photo)")
        if !writeMode && matchedPhotosCount > 0 {
            print("\n\(Color.yellow)\(Color.bold)💡 Tip:\(Color.reset) This was a dry-run. Add \(Color.cyan)--write\(Color.reset) to save tags into the photos before uploading to Flickr.")
        }
        print("\(Color.bold)=================================================================\(Color.reset)\n")
    }
}

main()
