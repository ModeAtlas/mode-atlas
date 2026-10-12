import Foundation
import Capacitor

@main
struct DocumentRouterTests {
    static func main() throws {
        precondition(CommandLine.arguments.count == 2, "Pass the actual native web bundle directory")
        let files = FileManager.default
        let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true).standardizedFileURL
        let router = ModeAtlasRouter(basePath: root.path)
        var fallback = CapacitorRouter()
        fallback.basePath = root.path
        let home = root.appendingPathComponent("index.html").path
        for path in ["", "/", "/index.html"] {
            precondition(router.route(for: path) == home, "Home route failed: \(path)")
        }

        // Enumerate the shipped documents instead of copying a page allowlist.
        let enumerator = files.enumerator(at: root, includingPropertiesForKeys: [.isRegularFileKey])!
        let documents = enumerator.compactMap { $0 as? URL }.filter { $0.lastPathComponent == "index.html" }.sorted { $0.path < $1.path }
        for required in ["learn", "progress", "friends", "kana", "reading", "writing", "results", "wordbank", "privacy", "terms"] {
            precondition(documents.contains { $0.path == root.appendingPathComponent(required + "/index.html").path }, "Missing bundled page: \(required)")
        }
        let references = try NSRegularExpression(pattern: #"(?:src|href)\s*=\s*["']([^"']+\.(?:css|js)(?:\?[^"']*)?)["']"#, options: [.caseInsensitive])
        var assetCount = 0
        for document in documents {
            let relative = String(document.path.dropFirst(root.path.count))
            let clean = String(relative.dropLast("index.html".count))
            for path in Set([clean, String(clean.dropLast()), relative]) {
                precondition(router.route(for: path) == document.path, "Wrong document for \(path): \(router.route(for: path))")
            }
            let url = URL(string: "capacitor://localhost" + clean)!
            let html = try String(contentsOf: document, encoding: .utf8)
            for match in references.matches(in: html, range: NSRange(html.startIndex..., in: html)) {
                let reference = String(html[Range(match.range(at: 1), in: html)!])
                let asset = URL(string: reference, relativeTo: url)!.absoluteURL
                if asset.scheme != "capacitor" || asset.host != "localhost" { continue }
                let resolved = router.route(for: asset.path)
                let expected = root.path + asset.path
                precondition(resolved == expected && resolved != home, "Asset fell back to home: \(asset)")
                precondition(files.fileExists(atPath: resolved), "Missing page asset: \(asset)")
                assetCount += 1
            }
        }
        precondition(assetCount > 0, "No stylesheet or script references were checked")
        for path in ["/not-a-page/", "/assets/missing.css", "/reading/missing.js", "/mode-atlas-native-manifest.json"] {
            precondition(router.route(for: path) == fallback.route(for: path), "Changed Capacitor asset/fallback behavior: \(path)")
        }

        // A future bundled page must work without another native route list.
        let temporary = files.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? files.removeItem(at: temporary) }
        let future = temporary.appendingPathComponent("future/branch/index.html")
        try files.createDirectory(at: future.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("future page".utf8).write(to: future)
        let futureRouter = ModeAtlasRouter(basePath: temporary.path)
        for path in ["/future/branch", "/future/branch/"] {
            precondition(futureRouter.route(for: path) == future.path, "New bundled page was not discovered")
        }
        print("Native router passed: \(documents.count) bundled documents, \(assetCount) script/style references, future nested pages and Capacitor fallbacks")
    }
}
