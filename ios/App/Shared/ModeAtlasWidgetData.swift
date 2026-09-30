import Foundation

// Shared between the app and extension. No Firebase or Capacitor dependency.
struct ModeAtlasWidgetGoal: Codable, Identifiable {
    let id: String
    let label: String
    let value: Int
    let target: Int
    var isValid: Bool { ["recall", "balance", "review", "week"].contains(id) && !label.isEmpty && label.count <= 80 && target > 0 && target <= 10000 && value >= 0 && value <= target }
}
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

    var title: String? = nil
    var frame: String? = nil
    var nextTitle: String? = nil
    var nextLevel: Int? = nil
    var studyStreak: Int? = nil
    var lastStudyDay: String? = nil
    var goals: [ModeAtlasWidgetGoal]? = nil

    var isValid: Bool {
        guard [1, 2, 3].contains(schemaVersion), updatedAt.isFinite, updatedAt > 0,
              (1...999).contains(level), (0...1_000_000_000_000).contains(correct),
              (0...100_000).contains(streak), levelProgress.isFinite,
              (0...1).contains(levelProgress), ["kana", "daily", "yourAtlas"].contains(destination) else { return false }
        if schemaVersion >= 2 && [words, readingCorrect, writingCorrect, levelXp, levelRequirement].contains(where: { $0 == nil }) { return false }
        if schemaVersion >= 2 && lastActivityAt == nil { return false }
        if let words = words, !(0...1_000_000).contains(words) { return false }
        if let reading = readingCorrect, let writing = writingCorrect,
           reading < 0 || writing < 0 || reading > correct || writing > correct || reading + writing != correct { return false }
        if let xp = levelXp, !(0...1_000_000_000_000).contains(xp) { return false }
        if let requirement = levelRequirement, !(1...100_000).contains(requirement) { return false }
        if let activity = lastActivityAt, !activity.isFinite || activity < 0 || activity > updatedAt + 300_000 { return false }
        if schemaVersion == 3 {
            guard let title, !title.isEmpty, title.count <= 60, let frame,
                  ["plain", "grove", "bridge", "summit", "lantern", "horizon"].contains(frame),
                  let studyStreak, (0...100000).contains(studyStreak), let localDay, Self.validDay(localDay),
                  let goals, goals.count == 4, Set(goals.map(\.id)).count == 4, goals.allSatisfy(\.isValid) else { return false }
            if let lastStudyDay, !Self.validDay(lastStudyDay) { return false }
            if studyStreak > 0 && lastStudyDay == nil { return false }
            if let nextLevel, nextLevel <= level || nextLevel > 999 { return false }
            if let nextTitle, nextTitle.isEmpty || nextTitle.count > 60 { return false }
            if (nextTitle == nil) != (nextLevel == nil) { return false }
        }
        return true
    }
    private static func validDay(_ value: String) -> Bool {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        guard value.count == 10, let day = formatter.date(from: value) else { return false }
        return formatter.string(from: day) == value
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
    func goals(at date: Date) -> [ModeAtlasWidgetGoal] {
        let calendar = Calendar(identifier: .gregorian)
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        guard let localDay, let savedDay = formatter.date(from: localDay) else { return [] }
        // The shared progression owner uses Monday-based local weeks.
        func monday(_ day: Date) -> Date {
            let weekday = calendar.component(.weekday, from: day)
            return calendar.date(byAdding: .day, value: -(weekday + 5) % 7, to: calendar.startOfDay(for: day))!
        }
        return (goals ?? []).map { goal in
            let current = goal.id == "week" ? monday(savedDay) == monday(date) : localDay == formatter.string(from: date)
            return ModeAtlasWidgetGoal(id: goal.id, label: goal.label, value: current ? goal.value : 0, target: goal.target)
        }
    }
    func routineStreak(at date: Date) -> Int {
        let calendar = Calendar(identifier: .gregorian)
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        guard let day = lastStudyDay, let last = formatter.date(from: day) else { return 0 }
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: last), to: calendar.startOfDay(for: date)).day ?? 0
        return (0...1).contains(days) ? (studyStreak ?? 0) : 0
    }
    func currentStreak(at date: Date) -> Int { completedToday(at: date) ? streak : 0 }
    var activityDate: Date? {
        guard let value = lastActivityAt, value > 0 else { return nil }
        return Date(timeIntervalSince1970: value / 1000)
    }
}

enum ModeAtlasWidgetStore {
    static let kind = "ModeAtlasStudyWidget"
    static let launchURL = URL(string: "modeatlas://open/?section=atlas")!
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
