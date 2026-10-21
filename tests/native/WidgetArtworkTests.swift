import Foundation

@main
struct WidgetArtworkTests {
    static func main() throws {
        let container = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: container, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: container) }
        let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
        let key = try ModeAtlasWidgetArtwork.store(data.base64EncodedString(), in: container)
        assert(key.count == 64 && ModeAtlasWidgetArtwork.read(key, in: container) != nil)
        let second = try ModeAtlasWidgetArtwork.store(data.base64EncodedString(), in: container)
        assert(key == second, "Unchanged artwork must use the same immutable file")
        assert(ModeAtlasWidgetArtwork.url(for: "../private", in: container) == nil)
        for bad in ["invalid!", Data("not a PNG".utf8).base64EncodedString(), String(repeating: "A", count: 800000)] {
            do { _ = try ModeAtlasWidgetArtwork.store(bad, in: container); assertionFailure("Invalid artwork accepted") } catch {}
        }
        ModeAtlasWidgetArtwork.prune(keeping: key, in: container)
        assert(ModeAtlasWidgetArtwork.read(key, in: container) != nil)
        ModeAtlasWidgetArtwork.prune(keeping: nil, in: container)
        assert(ModeAtlasWidgetArtwork.read(key, in: container) == nil, "Account reset must erase the shared portrait")
        print("Bounded PNG storage, immutable reuse, path isolation and account cleanup passed")
    }
}
