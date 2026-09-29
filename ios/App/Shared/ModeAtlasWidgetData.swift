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

    var isValid: Bool {
        schemaVersion == 1 && updatedAt.isFinite && updatedAt > 0 && level >= 1
            && correct >= 0 && streak >= 0 && levelProgress.isFinite
            && (0...1).contains(levelProgress) && ["kana", "daily"].contains(destination)
    }
    func isFresh(at date: Date) -> Bool {
        let age = date.timeIntervalSince1970 - updatedAt / 1000
        return isValid && age >= -300 && age < 86400
    }
    func completedToday(at date: Date) -> Bool {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return dailyComplete && localDay == formatter.string(from: date)
    }
}

enum ModeAtlasWidgetStore {
    static let kind = "ModeAtlasStudyWidget"
    static var container: URL? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "ModeAtlasAppGroup") as? String,
              group.hasPrefix("group."), !group.contains("$(") else { return nil }
        return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
    }
    static var file: URL? { container?.appendingPathComponent("mode-atlas-widget-snapshot-v1.json") }
    static func read() -> ModeAtlasWidgetSnapshot? {
        guard let url = file, let data = try? Data(contentsOf: url), data.count <= 4096,
              let value = try? JSONDecoder().decode(ModeAtlasWidgetSnapshot.self, from: data), value.isValid else { return nil }
        return value
    }
    static func write(_ value: ModeAtlasWidgetSnapshot) throws {
        guard value.isValid, let url = file else { throw CocoaError(.fileWriteNoPermission) }
        try JSONEncoder().encode(value).write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
    static func clear() throws {
        if let url = file, FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
    }
}
