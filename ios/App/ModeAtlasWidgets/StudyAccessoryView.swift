import SwiftUI
import WidgetKit

// Lock Screen layouts read the same validated projection as Home Screen widgets.
// System styling keeps them legible in tinted and Always-On appearances.
struct StudyAccessoryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: StudyEntry

    @ViewBuilder private var content: some View {
        if let value = entry.progress {
            let routine = value.studyRoutine(at: entry.date)
            switch family {
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: 0) {
                        Image(systemName: routine.studiedToday ? "flame.fill" : "flame").font(.caption2)
                        Text(routine.available ? routine.streak.formatted() : "—").font(.title2.bold()).minimumScaleFactor(0.6)
                        Text("days").font(.caption2)
                    }
                }.accessibilityElement(children: .ignore)
                    .accessibilityLabel(routine.available ? "Study streak: \(routine.streak) days. \(routine.needsStudy ? "Study today to keep it going." : routine.status)" : routine.status)
            case .accessoryInline:
                if routine.needsStudy, let end = routine.expiresAt, end > entry.date {
                    let timer = StudyStreakStatus.countdown(until: end, at: entry.date)
                    Text("Streak: \(routine.streak) · ends in \(timer)")
                } else {
                    Text(routine.available ? "Streak: \(routine.streak) · \(routine.studiedToday ? "studied today" : "start today")" : "Open to update streak")
                }
            default:
                VStack(alignment: .leading, spacing: 2) {
                    Label(routine.available ? "Streak: \(routine.streak)" : "Your study streak", systemImage: "flame.fill")
                        .font(.headline).widgetAccentable()
                    StudyStreakStatus(routine: routine, date: entry.date)
                    let daily = value.goals(at: entry.date).filter { !$0.isWeekly }
                    Text(daily.isEmpty ? "Open to update goals" : "\(daily.filter { $0.value >= $0.target }.count)/\(daily.count) daily goals")
                }
                .font(.caption).lineLimit(1).minimumScaleFactor(0.75)
                .accessibilityElement(children: .combine)
            }
        } else if family == .accessoryCircular {
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "book")
            }.accessibilityLabel("Mode Atlas. Open the app to load progress.")
        } else {
            Label("Open Mode Atlas", systemImage: "book")
        }
    }

    var body: some View {
        content
            .privacySensitive()
            .widgetURL(ModeAtlasWidgetStore.launchURL)
            .containerBackground(for: .widget) { Color.clear }
    }
}
