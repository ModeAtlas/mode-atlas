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
        func sample(version: Int = 2, age: Double = 0, level: Int = 4, progress: Double = 0.5, localDay: String? = "", words: Int = 12) -> ModeAtlasWidgetSnapshot {
            ModeAtlasWidgetSnapshot(schemaVersion: version, updatedAt: now.addingTimeInterval(-age).timeIntervalSince1970 * 1000,
                level: level, correct: 73, streak: 3, dailyComplete: true, levelProgress: progress, destination: "kana", localDay: localDay == "" ? day : localDay,
                words: words, readingCorrect: 50, writingCorrect: 23,
                lastActivityAt: now.addingTimeInterval(-max(age, 3600)).timeIntervalSince1970 * 1000,
                levelXp: 125, levelRequirement: 250)
        }
        assert(sample().isValid && sample().isFresh(at: now))
        assert(!sample(version: 3).isValid)
        assert(!sample(words: -1).isValid)
        assert(!sample(level: 0).isValid)
        assert(!sample(progress: 1.1).isValid)
        assert(!sample(progress: .nan).isValid)
        assert(!sample(age: 86400).isFresh(at: now))
        assert(sample(age: 86400 * 30).isUsable(at: now), "Last-known totals must remain available after inactivity")
        assert(!sample(age: -301).isFresh(at: now))
        assert(!sample(age: -301).isUsable(at: now))
        assert(sample().completedToday(at: now))
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: now)!
        assert(!sample().completedToday(at: tomorrow))
        assert(sample().currentStreak(at: now) == 3 && sample().currentStreak(at: tomorrow) == 0)
        assert(!sample(localDay: nil).completedToday(at: now))
        let data = try JSONEncoder().encode(sample())
        let decoded = try JSONDecoder().decode(ModeAtlasWidgetSnapshot.self, from: data)
        assert(decoded.correct == 73 && decoded.words == 12 && decoded.readingCorrect == 50 && decoded.completedToday(at: now))
        assert(abs(decoded.activityDate!.timeIntervalSince(now) + 3600) < 1)
        var legacy = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        legacy["schemaVersion"] = 1
        for key in ["words", "readingCorrect", "writingCorrect", "lastActivityAt", "levelXp", "levelRequirement"] { legacy.removeValue(forKey: key) }
        let old = try JSONDecoder().decode(ModeAtlasWidgetSnapshot.self, from: JSONSerialization.data(withJSONObject: legacy))
        assert(old.isValid && old.correct == 73 && old.words == nil && old.activityDate == nil)
        legacy["schemaVersion"] = 2
        let incomplete = try JSONDecoder().decode(ModeAtlasWidgetSnapshot.self, from: JSONSerialization.data(withJSONObject: legacy))
        assert(!incomplete.isValid, "A v2 snapshot must contain all statistics")
        assert(ModeAtlasWidgetStore.read() == nil, "Unprovisioned builds must not read another container")
        print("Widget bounds, v1 migration, retained totals, activity date, calendar rollover and round-trip passed")
    }
}
