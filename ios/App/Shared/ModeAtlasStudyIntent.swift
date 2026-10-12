import AppIntents

extension ModeAtlasDestination: AppEnum {
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Mode Atlas screen")
    static var caseDisplayRepresentations: [ModeAtlasDestination: DisplayRepresentation] = [
        .atlas: "Atlas", .yourAtlas: "Progress", .kana: "Kana", .reading: "Reading", .writing: "Writing",
        .daily: "Daily Challenge", .results: "Results", .wordBank: "Words"
    ]

    var title: String {
        String(localized: Self.caseDisplayRepresentations[self]?.title ?? "Mode Atlas")
    }
    var symbol: String {
        switch self {
        case .yourAtlas: return "sparkles"
        case .atlas: return "house"
        case .kana: return "character"
        case .reading: return "book"
        case .writing: return "pencil"
        case .daily: return "flame"
        case .results: return "chart.bar"
        case .wordBank: return "character.book.closed"
        }
    }
}

// Included in both targets. OpenIntent executes in the foreground app, so the
// extension does not need a URL workaround, App Group or a second routing store.
struct OpenModeAtlasIntent: OpenIntent {
    static var title: LocalizedStringResource = "Open Mode Atlas screen"
    static var description = IntentDescription("Open a practice mode or your learning progress.")

    @Parameter(title: "Screen") var target: ModeAtlasDestination

    static var parameterSummary: some ParameterSummary { Summary("Open \(\.$target)") }

    init() {}
    init(target: ModeAtlasDestination) { self.target = target }

    @MainActor
    func perform() async throws -> some IntentResult {
        ModeAtlasNavigation.queue(target)
        return .result()
    }
}
