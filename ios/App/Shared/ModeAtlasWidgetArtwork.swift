import Foundation
import ImageIO
import CryptoKit

// A bounded, local raster of the app's canonical avatar. WidgetKit does not
// fetch photos, execute the web renderer or share authentication credentials.
enum ModeAtlasWidgetArtwork {
    static let maximumBytes = 512 * 1024
    private static let prefix = "mode-atlas-widget-avatar-"
    static func url(for key: String?, in container: URL?) -> URL? {
        guard let key, key.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { return nil }
        return container?.appendingPathComponent(prefix + key + ".png")
    }
    static func store(_ base64: String, in container: URL) throws -> String {
        guard base64.utf8.count <= (maximumBytes * 4 / 3 + 4),
              let data = Data(base64Encoded: base64), data.count <= maximumBytes,
              data.starts(with: [137, 80, 78, 71, 13, 10, 26, 10]),
              let source = CGImageSourceCreateWithData(data as CFData, nil),
              CGImageSourceGetCount(source) == 1,
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int,
              (1...1024).contains(width), (1...1024).contains(height),
              CGImageSourceCreateImageAtIndex(source, 0, nil) != nil else {
            throw CocoaError(.fileReadCorruptFile)
        }
        let key = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        let file = url(for: key, in: container)!
        if !FileManager.default.fileExists(atPath: file.path) {
            try data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
        return key
    }
    static func read(_ key: String?, in container: URL?) -> CGImage? {
        guard let file = url(for: key, in: container), let data = try? Data(contentsOf: file),
              data.count <= maximumBytes, let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        return CGImageSourceCreateImageAtIndex(source, 0, [kCGImageSourceShouldCacheImmediately: true] as CFDictionary)
    }
    static func prune(keeping key: String?, in container: URL?) {
        guard let container, let files = try? FileManager.default.contentsOfDirectory(at: container, includingPropertiesForKeys: nil) else { return }
        let keep = url(for: key, in: container)?.lastPathComponent
        // Directory enumeration can return absolute URLs while appending a
        // component retains a base URL. Compare the owned filename, not URL form.
        for file in files where file.lastPathComponent.hasPrefix(prefix) && file.pathExtension == "png" && file.lastPathComponent != keep {
            try? FileManager.default.removeItem(at: file)
        }
    }
}
