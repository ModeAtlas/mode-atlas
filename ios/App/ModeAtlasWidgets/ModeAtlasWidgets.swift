import SwiftUI
import WidgetKit

struct StudyEntry: TimelineEntry {
    let date: Date
    let snapshot: ModeAtlasWidgetSnapshot?
}
struct StudyProvider: TimelineProvider {
    func placeholder(in context: Context) -> StudyEntry { StudyEntry(date: Date(), snapshot: nil) }
    func getSnapshot(in context: Context, completion: @escaping (StudyEntry) -> Void) {
        completion(StudyEntry(date: Date(), snapshot: context.isPreview ? nil : ModeAtlasWidgetStore.read()))
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
    // Widget appearance follows the Home Screen, independently of an in-app override.
    private var blue: Color { colorScheme == .dark ? Color(red: 155/255, green: 192/255, blue: 1) : Color(red: 36/255, green: 95/255, blue: 206/255) }
    private var green: Color { colorScheme == .dark ? Color(red: 115/255, green: 214/255, blue: 164/255) : Color(red: 20/255, green: 108/255, blue: 69/255) }
    private var progress: ModeAtlasWidgetSnapshot? {
        guard let value = entry.snapshot, value.isFresh(at: entry.date) else { return nil }
        return value
    }
    private var background: some View {
        Color(uiColor: .secondarySystemGroupedBackground)
    }
    private var content: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("あア").foregroundStyle(blue).font(.headline).accessibilityHidden(true)
                Text("Mode Atlas").font(.caption.weight(.bold))
                Spacer(minLength: 0)
            }
            if let value = progress {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\(value.level)").font(.system(size: 28, weight: .bold, design: .rounded))
                    Text("Atlas level").font(.caption).foregroundStyle(.secondary)
                    if family == .systemMedium {
                        Spacer()
                        Text("\(value.streak) day streak").font(.caption.weight(.semibold)).foregroundStyle(green)
                    }
                }
                ProgressView(value: value.levelProgress).tint(blue)
                Text(value.completedToday(at: entry.date) ? "Daily challenge complete ✓" : "Your daily challenge is ready")
                    .font(.caption2).foregroundStyle(.secondary).lineLimit(2)
            } else {
                Text("A little Japanese,\nevery day.").font(.headline.weight(.bold)).fixedSize(horizontal: false, vertical: true)
                Text("Jump into practice").font(.caption2).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            if family == .systemMedium {
                HStack(spacing: 12) {
                    practiceLink("Reading", symbol: "textformat.abc", destination: "reading", tint: green)
                    practiceLink("Writing", symbol: "pencil.tip", destination: "writing", tint: blue)
                }
            } else {
                Text("Practise kana →").font(.caption.weight(.bold)).foregroundStyle(green)
            }
        }
        .foregroundStyle(.primary)
        .widgetURL(URL(string: "modeatlas://open/reading"))
    }
    private func practiceLink(_ title: String, symbol: String, destination: String, tint: Color) -> some View {
        Link(destination: URL(string: "modeatlas://open/\(destination)")!) {
            Label(title, systemImage: symbol).font(.caption.weight(.bold))
                .frame(maxWidth: .infinity).padding(.vertical, 8)
                .background(tint.opacity(0.16), in: RoundedRectangle(cornerRadius: 10))
                .foregroundStyle(tint)
        }
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
            .configurationDisplayName("Mode Atlas")
            .description("Keep Japanese practice close, with learning progress and quick practice shortcuts.")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}
