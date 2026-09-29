import Foundation

@main
struct WidgetSnapshotTests {
    static func main() throws {
        let now = Date()
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        let day = formatter.string(from: now)
        func sample(version: Int = 1, age: Double = 0, level: Int = 4, progress: Double = 0.5, localDay: String? = "") -> ModeAtlasWidgetSnapshot {
            ModeAtlasWidgetSnapshot(schemaVersion: version, updatedAt: now.addingTimeInterval(-age).timeIntervalSince1970 * 1000,
                level: level, correct: 73, streak: 3, dailyComplete: true, levelProgress: progress, destination: "kana", localDay: localDay == "" ? day : localDay)
        }
        assert(sample().isValid && sample().isFresh(at: now))
        assert(!sample(version: 2).isValid)
        assert(!sample(level: 0).isValid)
        assert(!sample(progress: 1.1).isValid)
        assert(!sample(progress: .nan).isValid)
        assert(!sample(age: 86400).isFresh(at: now))
        assert(!sample(age: -301).isFresh(at: now))
        assert(sample().completedToday(at: now))
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: now)!
        assert(!sample().completedToday(at: tomorrow))
        assert(!sample(localDay: nil).completedToday(at: now))
        let data = try JSONEncoder().encode(sample())
        let decoded = try JSONDecoder().decode(ModeAtlasWidgetSnapshot.self, from: data)
        assert(decoded.correct == 73 && decoded.completedToday(at: now))
        assert(ModeAtlasWidgetStore.read() == nil, "Unprovisioned builds must not read another container")
        print("Widget snapshot validation, freshness, calendar rollover and round-trip passed")
    }
}
