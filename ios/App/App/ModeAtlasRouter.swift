import Foundation
import Capacitor

// The bundled documents own the available pages. Capacitor's default router
// treats every extensionless URL as a single-page app and returns the home page.
struct ModeAtlasRouter: Router {
    var basePath: String = ""

    func route(for path: String) -> String {
        if !basePath.isEmpty && URL(fileURLWithPath: path).pathExtension.isEmpty {
            let root = URL(fileURLWithPath: basePath, isDirectory: true).standardizedFileURL
            let relative = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let document = root.appendingPathComponent(relative, isDirectory: true)
                .appendingPathComponent("index.html").standardizedFileURL
            var isDirectory: ObjCBool = false
            if document.path.hasPrefix(root.path + "/"),
               FileManager.default.fileExists(atPath: document.path, isDirectory: &isDirectory),
               !isDirectory.boolValue {
                return document.path
            }
        }

        var fallback = CapacitorRouter()
        fallback.basePath = basePath
        return fallback.route(for: path)
    }
}
