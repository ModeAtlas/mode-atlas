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
        let entries = WidgetActivity.timelineDates(since: snapshot?.activityDate, at: now)
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
    private func level(_ value: ModeAtlasWidgetSnapshot, compact: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text("\(value.level)").font(.system(compact ? .title2 : .largeTitle, design: .rounded).weight(.bold))
                Text("Level").font(.caption).foregroundStyle(.secondary)
            }.accessibilityElement(children: .ignore).accessibilityLabel("Atlas level \(value.level)")
            ProgressView(value: value.levelProgress).tint(blue)
                .accessibilityLabel("Progress to next level")
                .accessibilityValue("\(Int(value.levelProgress * 100)) percent")
            if family == .systemLarge, let xp = value.levelXp, let required = value.levelRequirement {
                Text("\(xp.formatted()) / \(required.formatted()) XP to level \(value.level + 1)")
                    .font(.caption2).foregroundStyle(.secondary)
            }
        }.minimumScaleFactor(0.75)
    }
    private func metric(_ title: String, value: Int?, tint: Color = .primary) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            if let value = value {
                Text(value, format: .number.notation(.compactName))
                    .font(.system(.title3, design: .rounded).weight(.bold)).foregroundStyle(tint)
            } else { Text("—").font(.title3.weight(.bold)).foregroundStyle(.secondary) }
            Text(title).font(.caption2).foregroundStyle(.secondary)
        }
        .lineLimit(1).minimumScaleFactor(0.7).frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title + ": " + (value?.formatted() ?? "Not available"))
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
    private func goalSummary(_ value: ModeAtlasWidgetSnapshot) -> some View {
        let goals = value.goals(at: entry.date).filter { $0.id != "week" }
        let done = goals.filter { $0.value >= $0.target }.count
        return HStack(spacing: 4) {
            Image(systemName: done == 3 ? "checkmark.circle.fill" : "scope").foregroundStyle(done == 3 ? green : blue)
            Text(goals.isEmpty ? "Open to update goals" : "\(done)/3 daily goals")
            Spacer(minLength: 0)
        }.font(.caption2).lineLimit(1).minimumScaleFactor(0.75)
    }
    private func goals(_ value: ModeAtlasWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
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
        VStack(alignment: .leading, spacing: 5) {
            brand
            level(value, compact: true)
            goalSummary(value)
            HStack(spacing: 6) { metric("Correct", value: value.correct); metric("Words", value: value.words) }
            Spacer(minLength: 0)
            activity(value)
        }
    }
    private func medium(_ value: ModeAtlasWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            brand
            HStack(alignment: .top, spacing: 18) {
                VStack(alignment: .leading, spacing: 3) {
                    level(value, compact: true)
                    Text(value.title ?? "Your progress").font(.caption2).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.7)
                }.frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 7) {
                    HStack(spacing: 12) { metric("Total correct", value: value.correct); metric("Words banked", value: value.words) }
                    goalSummary(value)
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
            Spacer(minLength: 0)
            HStack { activity(value); Spacer(minLength: 4); Text("\(value.routineStreak(at: entry.date))d streak").font(.caption2).foregroundStyle(.secondary) }
        }
    }
    private func large(_ value: ModeAtlasWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            brand
            HStack(alignment: .center, spacing: 16) {
                level(value, compact: true).frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .trailing, spacing: 3) {
                    Text(value.title ?? "Your progress").font(.caption.weight(.semibold))
                    Text("\(value.routineStreak(at: entry.date))-day study streak").font(.caption2).foregroundStyle(.secondary)
                }.lineLimit(1).minimumScaleFactor(0.75)
            }
            Divider()
            goals(value)
            Divider()
            HStack { metric("Total correct", value: value.correct); metric("Words banked", value: value.words) }
            if let next = value.nextTitle, let level = value.nextLevel {
                HStack(spacing: 5) {
                    Image(systemName: "sparkles").foregroundStyle(blue)
                    Text("Next: \(next) · Level \(level)")
                }.font(.caption2).lineLimit(1).minimumScaleFactor(0.75)
            }
            Spacer(minLength: 0)
            activity(value)
        }
    }
    private var empty: some View {
        VStack(alignment: .leading, spacing: 10) {
            brand
            Text("Your progress").font(.headline)
            HStack { metric("Level", value: nil); metric("Correct", value: nil) }
            Spacer(minLength: 0)
            Text(ModeAtlasWidgetStore.container == nil
                 ? "Progress is unavailable in this build."
                 : "Open Mode Atlas to update your progress.")
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
struct ModeAtlasStudyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: ModeAtlasWidgetStore.kind, provider: StudyProvider()) { StudyWidgetView(entry: $0) }
            .configurationDisplayName("Your Atlas")
            .description("Your level, daily goals, study streak, next reward and learning totals.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge,
                                .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
