import Foundation

// Presentation only: the app remains the owner of the recorded activity date.
enum WidgetActivity {
    static let recentText = "Less than a minute ago"

    static func isRecent(since activity: Date, at date: Date) -> Bool {
        date.timeIntervalSince(activity) < 60
    }

    static func isFinalMinute(until deadline: Date, at date: Date) -> Bool {
        (0...60).contains(deadline.timeIntervalSince(date))
    }

    static func timelineDates(since activity: Date?, at now: Date,
                              calendar: Calendar = .current, boundaries: [Date] = []) -> [Date] {
        let midnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
        var dates = Set([now, midnight])
        dates.formUnion(boundaries.filter { $0 > now })
        dates.formUnion(boundaries.map { $0.addingTimeInterval(-60) }.filter { $0 > now })
        // Keep rollover/freeze states correct even if WidgetKit postpones its
        // requested refresh. This is at most one entry per day, never a timer.
        let horizon = min(boundaries.max() ?? midnight, calendar.date(byAdding: .day, value: 7, to: midnight)!)
        var day = midnight
        while day < horizon {
            dates.insert(day)
            day = calendar.date(byAdding: .day, value: 1, to: day)!
        }
        if let activity = activity {
            // One state transition; do not leave the first-minute label frozen.
            let firstMinute = activity.addingTimeInterval(60)
            if firstMinute > now { dates.insert(firstMinute) }
        }
        return dates.sorted()
    }
}
