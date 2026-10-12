import SwiftUI
import WidgetKit

struct StudyEntry: TimelineEntry {
    let date: Date
    let snapshot: ModeAtlasWidgetSnapshot?
    var progress: ModeAtlasWidgetSnapshot? {
        guard let value = snapshot, value.isUsable(at: date) else { return nil }
        return value
    }
}
struct StudyProvider: TimelineProvider {
    func placeholder(in context: Context) -> StudyEntry { StudyEntry(date: Date(), snapshot: nil) }
    func getSnapshot(in context: Context, completion: @escaping (StudyEntry) -> Void) {
        completion(StudyEntry(date: Date(), snapshot: ModeAtlasWidgetStore.read()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<StudyEntry>) -> Void) {
        let now = Date()
        let snapshot = ModeAtlasWidgetStore.read()
        let expiry = snapshot?.studyRoutine(at: now).expiresAt
        let entries = WidgetActivity.timelineDates(since: snapshot?.activityDate, at: now, boundaries: [expiry].compactMap { $0 })
            .map { StudyEntry(date: $0, snapshot: snapshot) }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(1800))))
    }
}

struct StudyWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme
    let entry: StudyEntry
    private var blue: Color { colorScheme == .dark ? Color(red: 155/255, green: 192/255, blue: 1) : Color(red: 36/255, green: 95/255, blue: 206/255) }
    private var green: Color { colorScheme == .dark ? Color(red: 115/255, green: 214/255, blue: 164/255) : Color(red: 20/255, green: 108/255, blue: 69/255) }
    private var background: Color { Color(uiColor: .secondarySystemGroupedBackground) }

    private var brand: some View {
        HStack(spacing: 6) {
            Text("あ").font(.caption.weight(.black)).foregroundStyle(blue).accessibilityHidden(true)
            Text("Your Atlas").font(.caption.weight(.semibold))
            Spacer(minLength: 0)
        }.lineLimit(1)
    }
    private func streak(_ value: ModeAtlasWidgetSnapshot, compact: Bool = false) -> some View {
        let routine = value.studyRoutine(at: entry.date)
        return VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Image(systemName: "flame.fill").foregroundStyle(green).font(.title3).accessibilityHidden(true)
                Text(routine.available ? routine.streak.formatted() : "—")
                    .font(.system(compact ? .title : .largeTitle, design: .rounded).weight(.bold))
                Text("day streak").font(.caption).foregroundStyle(.secondary)
            }.lineLimit(1).minimumScaleFactor(0.7)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(routine.available ? "Study streak: \(routine.streak) days" : "Study streak not yet available")
            StudyStreakStatus(routine: routine, date: entry.date)
                .font(.caption2).foregroundStyle(.secondary)
        }
    }
    private func activityText(since date: Date) -> Text {
        if WidgetActivity.isRecent(since: date, at: entry.date) {
            return Text(WidgetActivity.recentText)
        }
        // System formatting updates at minute precision without waking the app.
        let elapsed = Text(.currentDate, format: .offset(to: date,
            allowedFields: [.day, .hour, .minute], maxFieldCount: 2, sign: .never))
        return Text("\(elapsed) ago")
    }
    private func activity(_ value: ModeAtlasWidgetSnapshot) -> some View {
        HStack(spacing: 4) {
            Image(systemName: "clock").accessibilityHidden(true)
            if let date = value.activityDate {
                activityText(since: date)
                    .multilineTextAlignment(.leading)
                    .accessibilityLabel("Last study activity \(date.formatted(date: .abbreviated, time: .shortened))")
            } else { Text("No activity recorded") }
        }.font(.caption2).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.7)
    }
    private func goalSummary(_ value: ModeAtlasWidgetSnapshot, weekly: Bool = false) -> some View {
        let goals = value.goals(at: entry.date).filter { $0.isWeekly == weekly }
        let done = goals.filter { $0.value >= $0.target }.count
        let total = goals.count
        return HStack(spacing: 5) {
            Image(systemName: total > 0 && done == total ? "checkmark.circle.fill" : weekly ? "calendar" : "scope")
                .foregroundStyle(total > 0 && done == total ? green : blue).accessibilityHidden(true)
            Text(goals.isEmpty ? "Open to update \(weekly ? "week" : "goals")" : "\(done)/\(total) \(weekly ? "weekly" : "daily") goals")
            Spacer(minLength: 0)
        }.font(.caption2).lineLimit(1).minimumScaleFactor(0.75)
    }
    private func goals(_ value: ModeAtlasWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if value.goals(at: entry.date).filter({ !$0.isWeekly }).isEmpty {
                Text("Open Mode Atlas for today’s goals").font(.caption2).foregroundStyle(.secondary)
            }
            ForEach(value.goals(at: entry.date)) { goal in
                HStack(spacing: 8) {
                    Image(systemName: goal.value >= goal.target ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(goal.value >= goal.target ? green : .secondary).accessibilityHidden(true)
                    Text(goal.label).lineLimit(1).minimumScaleFactor(0.8)
                    Spacer(minLength: 0)
                    Text("\(goal.value)/\(goal.target)").monospacedDigit().foregroundStyle(.secondary)
                }.font(.caption2).accessibilityElement(children: .combine)
            }
        }
    }
    private func compact(_ value: ModeAtlasWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            brand
            streak(value, compact: true)
            Spacer(minLength: 0)
            goalSummary(value)
            goalSummary(value, weekly: true)
        }
    }
    private func medium(_ value: ModeAtlasWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            brand
            HStack(alignment: .top, spacing: 18) {
                streak(value, compact: true).frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 8) {
                    goalSummary(value)
                    goalSummary(value, weekly: true)
                    if let next = value.goals(at: entry.date).first(where: { !$0.isWeekly && $0.value < $0.target }) {
                        Text(next.label).font(.caption2).foregroundStyle(.secondary).lineLimit(2)
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
            Spacer(minLength: 0)
            activity(value)
        }
    }
    private func large(_ value: ModeAtlasWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            brand
            streak(value)
            Divider()
            goalSummary(value)
            goals(value)
            Spacer(minLength: 0)
            HStack {
                activity(value)
                Spacer(minLength: 4)
                Text("Level \(value.level)").font(.caption2).foregroundStyle(.secondary)
            }
        }
    }
    private var empty: some View {
        VStack(alignment: .leading, spacing: 10) {
            brand
            Label("Your study routine", systemImage: "flame").font(.headline)
            Spacer(minLength: 0)
            Text(ModeAtlasWidgetStore.container == nil
                 ? "Progress is unavailable in this build."
                 : "Open Mode Atlas to update your streak and goals.")
                .font(.caption2).foregroundStyle(.secondary)
        }
    }
    @ViewBuilder private var content: some View {
        Group {
            if let value = entry.progress {
                if family == .systemLarge { large(value) }
                else if family == .systemMedium { medium(value) }
                else { compact(value) }
            } else { empty }
        }
        .foregroundStyle(.primary)
        .widgetURL(ModeAtlasWidgetStore.launchURL)
    }
    var body: some View {
        switch family {
        case .accessoryCircular, .accessoryRectangular, .accessoryInline:
            StudyAccessoryView(entry: entry)
        default:
            content.containerBackground(for: .widget) { background }
        }
    }
}
struct StudyStreakStatus: View {
    let routine: ModeAtlasWidgetRoutine
    let date: Date
    var body: some View {
        HStack(spacing: 4) {
            if routine.studiedToday { Image(systemName: "checkmark.circle.fill").accessibilityHidden(true) }
            Text(routine.status)
            if routine.needsStudy, let end = routine.expiresAt, end > date {
                Text(timerInterval: date...end, countsDown: true, showsHours: true)
                    .monospacedDigit()
                    .accessibilityLabel("Streak ends at \(end.formatted(date: .abbreviated, time: .shortened))")
            }
        }.lineLimit(1).minimumScaleFactor(0.7).accessibilityElement(children: .combine)
    }
}

struct ModeAtlasStudyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: ModeAtlasWidgetStore.kind, provider: StudyProvider()) { StudyWidgetView(entry: $0) }
            .configurationDisplayName("Your Atlas")
            .description("Your study streak, time to keep it going, and daily and weekly goals.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge,
                                .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
