import Foundation

// Presentation only: the app remains the owner of the recorded activity date.
enum WidgetActivity {
    static let recentText = "Less than a minute ago"

    static func isRecent(since activity: Date, at date: Date) -> Bool {
        date.timeIntervalSince(activity) < 60
    }

    static func timelineDates(since activity: Date?, at now: Date,
                              calendar: Calendar = .current) -> [Date] {
        let midnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
        var dates = Set([now, midnight])
        if let activity = activity {
            // One state transition; do not leave the first-minute label frozen.
            let firstMinute = activity.addingTimeInterval(60)
            if firstMinute > now { dates.insert(firstMinute) }
        }
        return dates.sorted()
    }
}
