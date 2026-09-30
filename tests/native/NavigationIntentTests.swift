import Foundation

@main
struct NavigationIntentTests {
    @MainActor
    static func main() async throws {
        assert(ModeAtlasNavigation.consume() == nil)
        // A cold-launch intent must survive until the bridge is ready.
        _ = try await OpenModeAtlasIntent(target: .daily).perform()
        assert(ModeAtlasNavigation.consume() == .daily)
        assert(ModeAtlasNavigation.consume() == nil, "Foreground and bridge events cannot replay an action")

        ModeAtlasNavigation.queue(.reading)
        ModeAtlasNavigation.queue(.writing)
        assert(ModeAtlasNavigation.consume() == .writing, "The most recent explicit destination wins")

        for destination in ModeAtlasDestination.allCases {
            _ = try await OpenModeAtlasIntent(target: destination).perform()
            assert(ModeAtlasNavigation.consume() == destination)
        }
        assert(ModeAtlasDestination(rawValue: "https://unknown.example") == nil)
        assert(ModeAtlasDestination(rawValue: "settings") == nil)
        print("Intent execution, cold-launch retention, consume-once delivery, latest request and destination bounds passed")
    }
}
