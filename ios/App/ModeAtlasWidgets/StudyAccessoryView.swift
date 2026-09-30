import SwiftUI
import WidgetKit

// Lock Screen layouts read the same validated projection as Home Screen widgets.
// System styling keeps them legible in tinted and Always-On appearances.
struct StudyAccessoryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: StudyEntry

    @ViewBuilder private var content: some View {
        if let value = entry.progress {
            switch family {
            case .accessoryCircular:
                Gauge(value: value.levelProgress) { Text("Level") } currentValueLabel: {
                    Text(value.level, format: .number).minimumScaleFactor(0.6)
                }
                .gaugeStyle(.accessoryCircular)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Atlas level \(value.level), \(Int(value.levelProgress * 100)) percent to next level")
            case .accessoryInline:
                Text("Lv \(value.level) · \(value.correct.formatted(.number.notation(.compactName))) correct")
                    .accessibilityLabel("Atlas level \(value.level), \(value.correct.formatted()) kana correct")
            default:
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text("Level \(value.level)").font(.headline).widgetAccentable()
                        Spacer(minLength: 0)
                        Image(systemName: value.completedToday(at: entry.date) ? "checkmark.circle.fill" : "circle")
                            .accessibilityLabel(value.completedToday(at: entry.date) ? "Daily complete" : "Daily not completed")
                    }
                    Text("\(value.correct.formatted(.number.notation(.compactName))) correct")
                    if let words = value.words {
                        Text("\(words.formatted(.number.notation(.compactName))) words banked")
                    }
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
