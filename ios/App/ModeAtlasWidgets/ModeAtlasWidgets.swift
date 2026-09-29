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
        let nextDay = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: now))!
        let snapshot = ModeAtlasWidgetStore.read()
        let entries = [StudyEntry(date: now, snapshot: snapshot), StudyEntry(date: nextDay, snapshot: snapshot)]
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
            Text("Mode Atlas").font(.caption.weight(.semibold))
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
    private func activity(_ value: ModeAtlasWidgetSnapshot) -> some View {
        HStack(spacing: 4) {
            Image(systemName: "clock").accessibilityHidden(true)
            if let date = value.activityDate {
                Text("\(date, style: .relative) ago")
                    .accessibilityLabel("Last study activity \(date.formatted(date: .abbreviated, time: .shortened))")
            } else { Text("No activity recorded") }
        }.font(.caption2).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.7)
    }
    private func daily(_ value: ModeAtlasWidgetSnapshot) -> some View {
        HStack(spacing: 4) {
            Image(systemName: value.completedToday(at: entry.date) ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(value.completedToday(at: entry.date) ? green : .secondary)
            Text(value.completedToday(at: entry.date) ? "Daily complete" : "Daily not completed")
        }.font(.caption2).lineLimit(1).minimumScaleFactor(0.75)
    }
    private func compact(_ value: ModeAtlasWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            brand
            level(value, compact: true)
            HStack(spacing: 6) {
                metric("Correct", value: value.correct)
                metric("Words", value: value.words)
            }
            Spacer(minLength: 0)
            activity(value)
        }
    }
    private func medium(_ value: ModeAtlasWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            brand
            HStack(alignment: .top, spacing: 20) {
                level(value).frame(maxWidth: .infinity, alignment: .leading)
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 12) {
                        metric("Total correct", value: value.correct)
                        metric("Words banked", value: value.words)
                    }
                    daily(value)
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
            Spacer(minLength: 0)
            activity(value)
        }
    }
    private func large(_ value: ModeAtlasWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            brand
            level(value)
            Divider()
            HStack {
                metric("Total correct", value: value.correct)
                metric("Words banked", value: value.words)
            }
            HStack {
                metric("Reading correct", value: value.readingCorrect, tint: green)
                metric("Writing correct", value: value.writingCorrect, tint: blue)
            }
            HStack(alignment: .center) {
                metric("Daily streak", value: value.currentStreak(at: entry.date))
                daily(value).frame(maxWidth: .infinity, alignment: .leading)
            }
            Spacer(minLength: 0)
            VStack(alignment: .leading, spacing: 3) {
                Text("Last study activity").font(.caption.weight(.semibold))
                activity(value)
                if !value.isFresh(at: entry.date) {
                    Text("Totals updated \(Date(timeIntervalSince1970: value.updatedAt / 1000), style: .date)")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }
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
        .widgetURL(URL(string: "modeatlas://open/kana"))
    }
    var body: some View {
        if #available(iOS 17.0, *) { content.containerBackground(for: .widget) { background } }
        else { content.padding(14).background(background) }
    }
}
@main
struct ModeAtlasStudyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: ModeAtlasWidgetStore.kind, provider: StudyProvider()) { StudyWidgetView(entry: $0) }
            .configurationDisplayName("Study progress")
            .description("Your level, kana totals, words banked and recent activity at a glance.")
            .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
