import Foundation

// Presentation only: the app remains the owner of the recorded activity date.
enum WidgetActivity {
    static let recentText = "Less than a minute ago"

    static func isRecent(since activity: Date, at date: Date) -> Bool {
        date.timeIntervalSince(activity) < 60
    }

    // iOS 15–17 fallback. Current iOS uses the system's live date formatter.
    static func text(since activity: Date, at date: Date) -> String {
        if isRecent(since: activity, at: date) { return recentText }
        let minutes = Int(date.timeIntervalSince(activity) / 60)
        let hours = minutes / 60
        let days = hours / 24
        var parts: [String]
        if days > 0 {
            parts = ["\(days) \(days == 1 ? "day" : "days")"]
            if hours % 24 > 0 { parts.append("\(hours % 24) \(hours % 24 == 1 ? "hr" : "hrs")") }
        } else if hours > 0 {
            parts = ["\(hours) \(hours == 1 ? "hr" : "hrs")"]
            if minutes % 60 > 0 { parts.append("\(minutes % 60) min") }
        } else { parts = ["\(minutes) min"] }
        return parts.joined(separator: " ") + " ago"
    }

    static func timelineDates(since activity: Date?, at now: Date,
                              usesLiveText: Bool, calendar: Calendar = .current) -> [Date] {
        let midnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
        var dates = Set([now, midnight])
        if let activity = activity {
            // One state transition; do not leave the first-minute label frozen.
            let firstMinute = activity.addingTimeInterval(60)
            if firstMinute > now { dates.insert(firstMinute) }
            if !usesLiveText {
                // Precomputed entries, not a running timer or repeated reloads.
                // Keep legacy refreshes >=5 minutes apart, then hourly if the
                // system delays the normal 30-minute timeline request.
                for minute in stride(from: 5, through: 60, by: 5) {
                    dates.insert(now.addingTimeInterval(Double(minute) * 60))
                }
                for hour in 2...24 {
                    dates.insert(now.addingTimeInterval(Double(hour) * 3600))
                }
            }
        }
        return dates.sorted()
    }
}
