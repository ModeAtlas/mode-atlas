import Foundation

// Shared between the app and extension. No Firebase or Capacitor dependency.
struct ModeAtlasWidgetSnapshot: Codable {
    let schemaVersion: Int
    let updatedAt: Double
    let level: Int
    let correct: Int
    let streak: Int
    let dailyComplete: Bool
    let levelProgress: Double
    let destination: String
    let localDay: String?
    // Optional fields keep installed v1 snapshots readable until the app next opens.
    let words: Int?
    let readingCorrect: Int?
    let writingCorrect: Int?
    let lastActivityAt: Double?
    let levelXp: Int?
    let levelRequirement: Int?

    var isValid: Bool {
        guard [1, 2].contains(schemaVersion), updatedAt.isFinite, updatedAt > 0,
              (1...999).contains(level), (0...1_000_000_000_000).contains(correct),
              (0...100_000).contains(streak), levelProgress.isFinite,
              (0...1).contains(levelProgress), ["kana", "daily"].contains(destination) else { return false }
        if schemaVersion == 2 && [words, readingCorrect, writingCorrect, levelXp, levelRequirement].contains(where: { $0 == nil }) { return false }
        if schemaVersion == 2 && lastActivityAt == nil { return false }
        if let words = words, !(0...1_000_000).contains(words) { return false }
        if let reading = readingCorrect, let writing = writingCorrect,
           reading < 0 || writing < 0 || reading > correct || writing > correct || reading + writing != correct { return false }
        if let xp = levelXp, !(0...1_000_000_000_000).contains(xp) { return false }
        if let requirement = levelRequirement, !(1...100_000).contains(requirement) { return false }
        if let activity = lastActivityAt, !activity.isFinite || activity < 0 || activity > updatedAt + 300_000 { return false }
        return true
    }
    func isUsable(at date: Date) -> Bool {
        isValid && updatedAt / 1000 <= date.timeIntervalSince1970 + 300
    }
    func isFresh(at date: Date) -> Bool {
        let age = date.timeIntervalSince1970 - updatedAt / 1000
        return isUsable(at: date) && age < 86400
    }
    func completedToday(at date: Date) -> Bool {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return dailyComplete && localDay == formatter.string(from: date)
    }
    func currentStreak(at date: Date) -> Int { completedToday(at: date) ? streak : 0 }
    var activityDate: Date? {
        guard let value = lastActivityAt, value > 0 else { return nil }
        return Date(timeIntervalSince1970: value / 1000)
    }
}

enum ModeAtlasWidgetStore {
    static let kind = "ModeAtlasStudyWidget"
    static let launchURL = URL(string: "modeatlas://open/kana")!
    static var container: URL? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "ModeAtlasAppGroup") as? String,
              group.hasPrefix("group."), !group.contains("$(") else { return nil }
        return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
    }
    static var file: URL? { container?.appendingPathComponent("mode-atlas-widget-snapshot.json") }
    private static var legacyFile: URL? { container?.appendingPathComponent("mode-atlas-widget-snapshot-v1.json") }
    static func read() -> ModeAtlasWidgetSnapshot? {
        for url in [file, legacyFile].compactMap({ $0 }) {
            if let data = try? Data(contentsOf: url), data.count <= 4096,
               let value = try? JSONDecoder().decode(ModeAtlasWidgetSnapshot.self, from: data), value.isValid { return value }
        }
        return nil
    }
    static func write(_ value: ModeAtlasWidgetSnapshot) throws {
        guard value.isValid, let url = file else { throw CocoaError(.fileWriteNoPermission) }
        try JSONEncoder().encode(value).write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        if let legacy = legacyFile { try? FileManager.default.removeItem(at: legacy) }
    }
    static func clear() throws {
        for url in [file, legacyFile].compactMap({ $0 }) where FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
        }
    }
}
