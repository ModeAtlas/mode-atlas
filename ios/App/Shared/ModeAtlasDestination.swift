import Foundation

// Native entry points carry identifiers, never web routes or learning state.
// AtlasPlatform.destinationPath remains the owner of the document paths.
enum ModeAtlasDestination: String, CaseIterable, Sendable {
    case atlas, yourAtlas, kana, reading, writing, daily, results, wordBank
}

@MainActor
enum ModeAtlasNavigation {
    nonisolated static let event = Notification.Name("ModeAtlasDestination")
    private static var pending: ModeAtlasDestination?

    // Latest request wins, including when an intent runs before the WebView
    // exists. The bridge consumes it once after loading or returning to the app.
    static func queue(_ destination: ModeAtlasDestination) {
        pending = destination
        NotificationCenter.default.post(name: event, object: nil)
    }

    static func consume() -> ModeAtlasDestination? {
        defer { pending = nil }
        return pending
    }
}
