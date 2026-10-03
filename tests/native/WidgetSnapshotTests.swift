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
        assert(!sample(version: 4).isValid)
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
        var atlas = sample(version: 3)
        atlas.title = "Trail Finder"; atlas.frame = "plain"; atlas.studyStreak = 3; atlas.lastStudyDay = day
        atlas.nextTitle = "Grove Explorer"; atlas.nextLevel = 5
        atlas.goals = [ModeAtlasWidgetGoal(id: "recall", label: "Recall 20 kana today", value: 20, target: 20),
                       ModeAtlasWidgetGoal(id: "balance", label: "Read 5 and write 5 today", value: 6, target: 10),
                       ModeAtlasWidgetGoal(id: "review", label: "Recall 5 due kana today", value: 1, target: 5),
                       ModeAtlasWidgetGoal(id: "week", label: "Practise on 4 days this week", value: 2, target: 4)]
        assert(atlas.isValid)
        let decodedAtlas = try JSONDecoder().decode(ModeAtlasWidgetSnapshot.self, from: JSONEncoder().encode(atlas))
        assert(decodedAtlas.title == "Trail Finder" && decodedAtlas.goals(at: now).first!.value == 20)
        assert(decodedAtlas.goals(at: tomorrow).first!.value == 0, "Yesterday's completed daily goals must reset")
        assert(decodedAtlas.routineStreak(at: tomorrow) == 3)
        assert(decodedAtlas.routineStreak(at: calendarDay(2, after: now)) == 0)
        atlas.nextLevel = 3; assert(!atlas.isValid); atlas.nextLevel = 5
        atlas.goals = [atlas.goals!.first!]; assert(!atlas.isValid)
        var rotating = sample(version: 4)
        rotating.title = "Trail Finder"; rotating.frame = "plain"; rotating.studyStreak = 3; rotating.lastStudyDay = day
        rotating.goals = [ModeAtlasWidgetGoal(id: "read-20", label: "Read 20 kana correctly", value: 20, target: 20, period: "daily"),
                          ModeAtlasWidgetGoal(id: "broad-15", label: "Recall 15 kana from a pool of at least 45", value: 6, target: 15, period: "daily"),
                          ModeAtlasWidgetGoal(id: "streak-10", label: "Reach a 10-answer streak without hints", value: 4, target: 10, period: "daily"),
                          ModeAtlasWidgetGoal(id: "days-3", label: "Practise on 3 days this week", value: 2, target: 3, period: "weekly"),
                          ModeAtlasWidgetGoal(id: "tests-2", label: "Complete 2 formal tests this week", value: 1, target: 2, period: "weekly")]
        assert(rotating.isValid && rotating.goals(at: now).count == 5)
        let decodedRotation = try JSONDecoder().decode(ModeAtlasWidgetSnapshot.self, from: JSONEncoder().encode(rotating))
        assert(decodedRotation.goals(at: tomorrow).allSatisfy(\.isWeekly), "Expired daily labels must disappear until the app publishes today's rotation")
        assert(decodedRotation.goals(at: calendarDay(7, after: now)).isEmpty, "Expired weekly labels must also disappear")
        assert(decodedRotation.goals(at: now).filter(\.isWeekly).count == 2)
        var highLevel = try JSONSerialization.jsonObject(with: JSONEncoder().encode(rotating)) as! [String: Any]
        highLevel["levelRequirement"] = 163000
        let higherCurve = try JSONDecoder().decode(ModeAtlasWidgetSnapshot.self, from: JSONSerialization.data(withJSONObject: highLevel))
        assert(higherCurve.isValid, "High-level requirements on the new curve must remain usable")
        rotating.goals![0].period = "weekly"; assert(!rotating.isValid, "A snapshot requires three daily and two weekly goals")
        assert(ModeAtlasWidgetStore.read() == nil, "Unprovisioned builds must not read another container")
        testActivityTiming()
        print("Widget bounds, v1 migration, retained totals, first-minute boundaries, minimal timelines, calendar rollover and round-trip passed")
    }

    static func calendarDay(_ days: Int, after date: Date) -> Date { Calendar.current.date(byAdding: .day, value: days, to: date)! }
    static func testActivityTiming() {
        let activity = Date(timeIntervalSince1970: 1_790_726_390.125)
        for elapsed in [-30.0, 0, 59.999, 60, 120, 3600, 86400] {
            assert(WidgetActivity.isRecent(since: activity, at: activity.addingTimeInterval(elapsed)) == (elapsed < 60))
        }

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let midnight = calendar.startOfDay(for: activity).addingTimeInterval(86400)
        let now = midnight.addingTimeInterval(-10)
        let recent = now.addingTimeInterval(-30)
        let firstMinute = recent.addingTimeInterval(60)
        let live = WidgetActivity.timelineDates(since: recent, at: now, calendar: calendar)
        assert(live == [now, midnight, firstMinute], "The first-minute transition must survive an intervening midnight")
        assert(!WidgetActivity.isRecent(since: recent, at: live.last!))

        let older = now.addingTimeInterval(-185 * 60)
        let normal = WidgetActivity.timelineDates(since: older, at: now, calendar: calendar)
        assert(normal == [now, midnight], "Live text needs no repeating timeline entries")
        assert(WidgetActivity.timelineDates(since: nil, at: now, calendar: calendar) == normal)
        let exactBoundary = WidgetActivity.timelineDates(since: now.addingTimeInterval(-60), at: now, calendar: calendar)
        assert(exactBoundary == normal, "Do not duplicate the current entry at 60 seconds")

        calendar.timeZone = TimeZone(identifier: "Australia/Melbourne")!
        let beforeDST = calendar.date(from: DateComponents(year: 2026, month: 10, day: 4))!
        let dstDates = WidgetActivity.timelineDates(since: nil, at: beforeDST, calendar: calendar)
        assert(dstDates.last!.timeIntervalSince(beforeDST) == 23 * 3600, "Daily rollover must follow local midnight across daylight saving")
    }
}
