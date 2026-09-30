import AppIntents

struct ModeAtlasShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        // One parameterised action lets Siri resolve a named screen and lets
        // Shortcuts save a chosen destination without duplicate intent types.
        AppShortcut(intent: OpenModeAtlasIntent(),
            phrases: ["Open \(\.$target) in \(.applicationName)", "Open a screen in \(.applicationName)"],
            shortTitle: "Open screen", systemImageName: "book")
    }
}
