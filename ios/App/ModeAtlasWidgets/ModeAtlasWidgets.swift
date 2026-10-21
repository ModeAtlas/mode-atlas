import SwiftUI
import WidgetKit

struct StudyEntry: TimelineEntry {
    let date: Date
    let snapshot: ModeAtlasWidgetSnapshot?
    var avatar: CGImage? = nil
    var progress: ModeAtlasWidgetSnapshot? {
        guard let value = snapshot, value.isUsable(at: date) else { return nil }
        return value
    }
}
struct StudyProvider: TimelineProvider {
    func placeholder(in context: Context) -> StudyEntry { StudyEntry(date: Date(), snapshot: nil) }
    func getSnapshot(in context: Context, completion: @escaping (StudyEntry) -> Void) {
        let value = ModeAtlasWidgetStore.read()
        completion(StudyEntry(date: Date(), snapshot: value,
                              avatar: ModeAtlasWidgetArtwork.read(value?.avatarKey, in: ModeAtlasWidgetStore.container)))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<StudyEntry>) -> Void) {
        let now = Date(), snapshot = ModeAtlasWidgetStore.read()
        let avatar = ModeAtlasWidgetArtwork.read(snapshot?.avatarKey, in: ModeAtlasWidgetStore.container)
        let expiry = snapshot?.studyRoutine(at: now).expiresAt
        let weekEnd = snapshot?.weekly.map { Date(timeIntervalSince1970: $0.endAt / 1000) }
        let updated = snapshot.map { Date(timeIntervalSince1970: $0.updatedAt / 1000) }
        let entries = WidgetActivity.timelineDates(since: updated, at: now,
                         boundaries: [expiry, weekEnd].compactMap { $0 })
            .map { StudyEntry(date: $0, snapshot: snapshot, avatar: avatar) }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(1800))))
    }
}

// Home Screen presentation has one owner, also used by the native render checks.
// The avatar is decoded once per timeline, never once per entry or text update.
struct StudyWidgetCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let entry: StudyEntry
    let family: WidgetFamily
    private var blue: Color { colorScheme == .dark ? Color(hex: 0x9bc0ff) : Color(hex: 0x245fce) }
    private var green: Color { colorScheme == .dark ? Color(hex: 0x73d6a4) : Color(hex: 0x146c45) }
    private var flame: Color { colorScheme == .dark ? Color(hex: 0xf0c977) : Color(hex: 0xb45d12) }
    private let hero = Color(hex: 0x243f81)
    private let mint = Color(hex: 0xb8f3dd)

    private func header(_ value: ModeAtlasWidgetSnapshot? = nil) -> some View {
        HStack(spacing: 6) {
            Image("AtlasMark").resizable().scaledToFit().frame(width: 20, height: 20).accessibilityHidden(true)
            Text("Mode Atlas").font(.system(size: 13, weight: .bold))
            Spacer(minLength: 2)
            if let value {
                Text("Lv \(value.level)").font(.system(size: 11, weight: .bold)).monospacedDigit()
                    .foregroundStyle(blue).padding(.horizontal, 7).padding(.vertical, 4)
                    .background(blue.opacity(0.10), in: Capsule())
            }
        }.lineLimit(1).minimumScaleFactor(0.8)
    }
    private func streak(_ value: ModeAtlasWidgetSnapshot, prominent: Bool = false, onHero: Bool = false) -> some View {
        let routine = value.studyRoutine(at: entry.date)
        return VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Image(systemName: routine.frozen ? "snowflake" : "flame.fill")
                    .font(.system(size: prominent ? 23 : 18, weight: .semibold))
                    .foregroundStyle(onHero ? mint : flame).accessibilityHidden(true)
                Text(routine.available ? routine.streak.formatted() : "—")
                    .font(.system(size: prominent ? 38 : 30, weight: .heavy, design: .rounded)).monospacedDigit()
                Text("day streak").font(.system(size: 11, weight: .medium)).opacity(0.8)
            }.lineLimit(1).minimumScaleFactor(0.7)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(routine.available ? "Study streak: \(routine.streak) days" : "Study streak not yet available")
            StudyStreakStatus(routine: routine, date: entry.date).font(.system(size: 10, weight: .medium)).opacity(0.85)
        }
    }
    private func xp(_ value: ModeAtlasWidgetSnapshot, onHero: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 3) {
                Text("\((value.levelXp ?? 0).formatted()) / \((value.levelRequirement ?? 100).formatted()) XP")
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right").accessibilityHidden(true)
            }.font(.system(size: 10, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.75)
            ProgressView(value: value.levelProgress).tint(onHero ? mint : blue)
                .accessibilityLabel("Progress to level \(value.level + 1)")
        }
    }
    private func goalSummary(_ value: ModeAtlasWidgetSnapshot, weekly: Bool = false) -> some View {
        let goals = value.goals(at: entry.date).filter { $0.isWeekly == weekly }
        let done = goals.filter { $0.value >= $0.target }.count
        return HStack(spacing: 3) {
            Image(systemName: !goals.isEmpty && done == goals.count ? "checkmark.circle.fill" : weekly ? "calendar" : "scope")
                .foregroundStyle(!goals.isEmpty && done == goals.count ? green : blue).accessibilityHidden(true)
            Text(goals.isEmpty ? "Update \(weekly ? "week" : "goals")" : "\(done)/\(goals.count) \(weekly ? "week" : "today")")
        }.font(.system(size: 10, weight: .medium)).lineLimit(1).minimumScaleFactor(0.8)
            .accessibilityLabel(goals.isEmpty ? "Open to update goals" : "\(done) of \(goals.count) \(weekly ? "weekly" : "daily") goals complete")
    }
    private func avatar(onHero: Bool = false) -> some View {
        ZStack(alignment: .bottom) {
            Ellipse().fill((onHero ? mint : blue).opacity(onHero ? 0.13 : 0.08)).padding(.vertical, 8)
            if let image = entry.avatar {
                Image(decorative: image, scale: 2).resizable()
                    .widgetAccentedRenderingMode(.fullColor).scaledToFit()
                    .accessibilityLabel("Your avatar and companion")
            } else {
                Image("AtlasMark").resizable().scaledToFit().padding(14).opacity(0.8).accessibilityHidden(true)
            }
        }
    }
    private func goalColumn(_ value: ModeAtlasWidgetSnapshot, weekly: Bool, spacious: Bool = false) -> some View {
        let goals = value.goals(at: entry.date).filter { $0.isWeekly == weekly }
        return VStack(alignment: .leading, spacing: spacious ? 14 : 7) {
            HStack(spacing: 4) {
                Image(systemName: weekly ? "calendar" : "scope").foregroundStyle(blue).accessibilityHidden(true)
                Text(weekly ? "THIS WEEK" : "TODAY").tracking(0.8)
            }.font(.system(size: spacious ? 12 : 10, weight: .bold))
            if goals.isEmpty { Text("Open for fresh goals").font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(2) }
            ForEach(goals) { goal in
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 3) {
                        Text(goal.displayLabel).font(.system(size: spacious ? 13 : 10, weight: .medium)).lineLimit(spacious ? 2 : 1).minimumScaleFactor(0.8)
                        Spacer(minLength: 0)
                        if goal.value >= goal.target { Image(systemName: "checkmark.circle.fill").font(.system(size: 10)).foregroundStyle(green) }
                    }
                    HStack(spacing: 5) {
                        ProgressView(value: Double(goal.value), total: Double(goal.target)).tint(goal.value >= goal.target ? green : blue)
                        Text("\(goal.value)/\(goal.target)").font(.system(size: 9, weight: .medium)).monospacedDigit().foregroundStyle(.secondary)
                    }
                }.accessibilityElement(children: .ignore).accessibilityLabel("\(goal.label): \(goal.value) of \(goal.target)")
            }
        }.frame(maxWidth: .infinity, alignment: .topLeading)
    }
    private func ranking(_ value: ModeAtlasWidgetSnapshot) -> some View {
        HStack(spacing: 5) {
            if let weekly = value.weekly, weekly.isCurrent(at: entry.date) {
                Image(systemName: "trophy.fill").foregroundStyle(flame).accessibilityHidden(true)
                Text("#\(weekly.rank) this week").fontWeight(.bold)
                Spacer(minLength: 2)
                Text("\(weekly.score.formatted()) XP").foregroundStyle(.secondary)
            } else {
                Text("\(value.correct.formatted()) correct").fontWeight(.semibold)
                Spacer(minLength: 2)
                Text("\((value.totalXp ?? 0).formatted()) total XP").foregroundStyle(.secondary)
            }
        }.font(.system(size: 11)).lineLimit(1).minimumScaleFactor(0.8)
    }
    private func updated(_ value: ModeAtlasWidgetSnapshot) -> some View {
        let date = Date(timeIntervalSince1970: value.updatedAt / 1000)
        return HStack(spacing: 3) {
            Image(systemName: "arrow.triangle.2.circlepath").accessibilityHidden(true)
            if WidgetActivity.isRecent(since: date, at: entry.date) { Text("Updated just now") }
            else {
                let elapsed = Text(.currentDate, format: .offset(to: date,
                    allowedFields: [.day, .hour, .minute], maxFieldCount: 2, sign: .never))
                Text("Updated \(elapsed) ago")
            }
        }.font(.system(size: 9)).foregroundStyle(.secondary).lineLimit(1)
            .accessibilityLabel("Progress updated \(date.formatted(date: .abbreviated, time: .shortened))")
    }
    private func small(_ value: ModeAtlasWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            header(value)
            Spacer(minLength: 0)
            streak(value)
            Spacer(minLength: 0)
            xp(value)
            goalSummary(value)
        }
    }
    private func medium(_ value: ModeAtlasWidgetSnapshot, width: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            header(value)
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 6) {
                    streak(value)
                    xp(value)
                    HStack(spacing: 10) { goalSummary(value); goalSummary(value, weekly: true) }
                }.frame(maxWidth: .infinity, alignment: .leading)
                avatar().frame(width: min(105, width * 0.31))
            }.frame(maxHeight: .infinity)
        }
    }
    private func large(_ value: ModeAtlasWidgetSnapshot, height: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            header(value)
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 8) {
                    streak(value, prominent: true, onHero: true)
                    xp(value, onHero: true)
                }.frame(maxWidth: .infinity, alignment: .leading)
                avatar(onHero: true).frame(width: 108)
            }.padding(.horizontal, 12).padding(.vertical, 6)
                .frame(height: min(122, max(102, height * 0.34)))
                .foregroundStyle(.white).background(hero, in: RoundedRectangle(cornerRadius: 18))
            HStack(alignment: .top, spacing: 14) {
                goalColumn(value, weekly: false)
                goalColumn(value, weekly: true)
            }
            Spacer(minLength: 0)
            Divider()
            ranking(value)
            updated(value)
        }
    }
    private func extraLarge(_ value: ModeAtlasWidgetSnapshot, size: CGSize) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            header(value)
            HStack(alignment: .top, spacing: 22) {
                VStack(alignment: .leading, spacing: 8) {
                    streak(value, prominent: true, onHero: true)
                    avatar(onHero: true).frame(maxWidth: .infinity, maxHeight: .infinity)
                    xp(value, onHero: true)
                }.padding(14).frame(width: size.width * 0.32)
                    .foregroundStyle(.white).background(hero, in: RoundedRectangle(cornerRadius: 20))
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .top, spacing: 22) {
                        goalColumn(value, weekly: false, spacious: true)
                        goalColumn(value, weekly: true, spacious: true)
                    }
                    Spacer(minLength: 0)
                    Divider()
                    ranking(value)
                    updated(value)
                }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }.frame(maxHeight: .infinity)
        }
    }
    var body: some View {
        GeometryReader { geometry in
            Group {
                if let value = entry.progress {
                    if family == .systemExtraLarge { extraLarge(value, size: geometry.size) }
                    else if family == .systemLarge { large(value, height: geometry.size.height) }
                    else if family == .systemMedium { medium(value, width: geometry.size.width) }
                    else { small(value) }
                } else {
                    VStack(alignment: .leading, spacing: 10) {
                        header()
                        Spacer(minLength: 0)
                        Label("Your study routine", systemImage: "flame.fill").font(.headline)
                        Text("Open Mode Atlas to update your streak and goals.").font(.caption).foregroundStyle(.secondary)
                        Spacer(minLength: 0)
                    }
                }
            }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }.foregroundStyle(colorScheme == .dark ? Color(hex: 0xf4f4f5) : Color(hex: 0x172b4a))
            .privacySensitive().widgetURL(ModeAtlasWidgetStore.launchURL)
    }
}

struct StudyWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme
    let entry: StudyEntry
    @ViewBuilder var body: some View {
        #if os(iOS)
        switch family {
        case .accessoryCircular, .accessoryRectangular, .accessoryInline:
            StudyAccessoryView(entry: entry)
        default:
            home
        }
        #else
        home
        #endif
    }
    private var home: some View {
        StudyWidgetCard(entry: entry, family: family)
            .containerBackground(for: .widget) { colorScheme == .dark ? Color(hex: 0x1c1c1e) : Color.white }
    }
}
struct StudyStreakStatus: View {
    let routine: ModeAtlasWidgetRoutine
    let date: Date
    static func countdown(until end: Date, at date: Date) -> Text {
        if WidgetActivity.isFinalMinute(until: end, at: date) { return Text("Less than a minute") }
        return Text(.currentDate, format: .offset(to: end,
            allowedFields: [.day, .hour, .minute], maxFieldCount: 2, sign: .never))
    }
    var body: some View {
        HStack(spacing: 4) {
            if routine.studiedToday { Image(systemName: "checkmark.circle.fill").accessibilityHidden(true) }
            Text(routine.status)
            if routine.needsStudy, let end = routine.expiresAt, end > date {
                Self.countdown(until: end, at: date).monospacedDigit()
                    .accessibilityLabel("Streak ends at \(end.formatted(date: .abbreviated, time: .shortened))")
            }
        }.lineLimit(1).minimumScaleFactor(0.7).accessibilityElement(children: .combine)
    }
}
private extension Color {
    init(hex: UInt32) { self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255) }
}
struct ModeAtlasStudyWidget: Widget {
    private var families: [WidgetFamily] {
        #if os(iOS)
        [.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline]
        #else
        [.systemSmall, .systemMedium, .systemLarge, .systemExtraLarge]
        #endif
    }
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: ModeAtlasWidgetStore.kind, provider: StudyProvider()) { StudyWidgetView(entry: $0) }
            .configurationDisplayName("Your Atlas")
            .description("Your avatar, streak, level and goals. A little encouragement to keep learning.")
            .supportedFamilies(families)
    }
}
