import AppKit
import SwiftUI
import WidgetKit
import ImageIO

// Render the shipped SwiftUI card, not a browser approximation of the widget.
@main
struct WidgetRenderChecks {
    @MainActor static func main() throws {
        _ = NSApplication.shared
        let destination = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
        try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)
        let input = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2]))
        var json = try JSONSerialization.jsonObject(with: input) as! [String: Any]
        let now = Date(), formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"; formatter.locale = Locale(identifier: "en_US_POSIX")
        json["updatedAt"] = now.timeIntervalSince1970 * 1000
        json["localDay"] = formatter.string(from: now); json["lastStudyDay"] = formatter.string(from: now)
        json["level"] = 21; json["levelXp"] = 733; json["levelRequirement"] = 5100; json["levelProgress"] = 733.0 / 5100
        json["nextLevel"] = 25; json["nextTitle"] = "Horizon Keeper"
        let value = try JSONDecoder().decode(ModeAtlasWidgetSnapshot.self, from: JSONSerialization.data(withJSONObject: json))
        precondition(value.isValid)
        let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: CommandLine.arguments[3]) as CFURL, nil)!
        let avatar = CGImageSourceCreateImageAtIndex(source, 0, nil)!
        let entry = StudyEntry(date: now, snapshot: value, avatar: avatar)
        let sizes: [(String, WidgetFamily, CGFloat, CGFloat)] = [("small", .systemSmall, 158, 158), ("medium", .systemMedium, 338, 158), ("large", .systemLarge, 338, 354), ("extra-large", .systemExtraLarge, 634, 300)]
        for (name, family, width, height) in sizes {
            for (mode, scheme) in [("light", ColorScheme.light), ("dark", ColorScheme.dark)] {
                let background = scheme == .dark ? Color(red: 28/255, green: 28/255, blue: 30/255) : Color.white
                let view = StudyWidgetCard(entry: entry, family: family).padding(16)
                    .frame(width: width, height: height).background(background)
                    .clipShape(RoundedRectangle(cornerRadius: 24)).environment(\.colorScheme, scheme)
                let renderer = ImageRenderer(content: view); renderer.scale = 2
                guard let image = renderer.cgImage else { fatalError("Could not render \(name) \(mode)") }
                let url = destination.appendingPathComponent("\(name)-\(mode).png")
                let writer = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil)!
                CGImageDestinationAddImage(writer, image, nil)
                precondition(CGImageDestinationFinalize(writer))
            }
        }
        print("Rendered eight native widget layouts with the maximum personal-goal count and full avatar/pet")
    }
}
