import UIKit
import WebKit
import Capacitor
import GoogleSignIn
import UserNotifications

// Mirrors the shared preference so the native frame does not flash navy before
// the bundled document loads. The launch storyboard itself follows the OS.
enum ModeAtlasAppearance {
    static let preferenceKey = "modeAtlasAppearance"
    static let collections = ["sakura", "midnight", "skyline", "evergreen"]
    static var style: UIUserInterfaceStyle {
        switch UserDefaults.standard.string(forKey: preferenceKey) ?? "dark" {
        case "light", "sakura": return .light
        case "system": return .unspecified
        default: return .dark
        }
    }
    static let canvasKey = "modeAtlasAppearanceCanvas"
    static var canvas: UIColor {
        if let preference = UserDefaults.standard.string(forKey: preferenceKey), collections.contains(preference),
           let value = UserDefaults.standard.string(forKey: canvasKey), let color = color(value) { return color }
        return UIColor(named: "AppCanvas") ?? .systemBackground
    }
    static func color(_ value: String) -> UIColor? {
        guard value.range(of: "^#[0-9a-fA-F]{6}$", options: .regularExpression) != nil,
              let number = UInt32(value.dropFirst(), radix: 16) else { return nil }
        return UIColor(red: CGFloat((number >> 16) & 255) / 255, green: CGFloat((number >> 8) & 255) / 255,
                       blue: CGFloat(number & 255) / 255, alpha: 1)
    }
}

// The web dock is custom, so UIKit cannot move it into Duo's shared bar region
// automatically. Read system occlusions in the view that owns the coordinates.
final class ModeAtlasWebView: WKWebView {
    var onLayoutChange: (([String: Any]) -> Void)?
    private var occlusions: [CGRect] = []
    private var lastLayout: NSDictionary?

    override func updateConstraints() {
        if #available(iOS 27.1, *) {
            // UIKit tracks these reads and invalidates constraints when a camera
            // or Live Activity changes, even without a window resize.
            occlusions = reservedRegions(kind: .occlusion).map(\.frame)
        }
        super.updateConstraints()
        publishLayout()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        publishLayout()
    }

    override func safeAreaInsetsDidChange() {
        super.safeAreaInsetsDidChange()
        setNeedsUpdateConstraints()
        publishLayout()
    }

    func viewportLayout() -> [String: Any] {
        var blocked = occlusions
        if let window, let scene = window.windowScene, let status = scene.statusBarManager,
           !status.isStatusBarHidden {
            let frame = window.convert(status.statusBarFrame, from: scene.coordinateSpace)
            blocked.append(convert(frame, from: window))
        }
        let insets = safeAreaInsets
        return ["width": bounds.width, "height": bounds.height,
                "safeArea": ["top": insets.top, "right": insets.right,
                             "bottom": insets.bottom, "left": insets.left],
                "occlusions": blocked.filter { !$0.isEmpty && $0.intersects(bounds) }.map {
                    ["x": $0.minX, "y": $0.minY, "width": $0.width, "height": $0.height]
                }]
    }

    private func publishLayout() {
        guard bounds.width > 0, bounds.height > 0 else { return }
        let layout = viewportLayout()
        guard !(lastLayout?.isEqual(to: layout) ?? false) else { return }
        lastLayout = layout as NSDictionary
        onLayoutChange?(layout)
    }
}

final class ModeAtlasBridgeViewController: CAPBridgeViewController {
    override var preferredStatusBarStyle: UIStatusBarStyle {
        traitCollection.userInterfaceStyle == .dark ? .lightContent : .darkContent
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (controller: ModeAtlasBridgeViewController, _: UITraitCollection) in
            controller.setNeedsStatusBarAppearanceUpdate()
        }
    }

    func applyCanvas() {
        view.backgroundColor = ModeAtlasAppearance.canvas
        webView?.backgroundColor = ModeAtlasAppearance.canvas
        webView?.scrollView.backgroundColor = ModeAtlasAppearance.canvas
    }

    override func capacitorDidLoad() {
        let native = ModeAtlasNativePlugin()
        bridge?.registerPluginInstance(native)
        (webView as? ModeAtlasWebView)?.onLayoutChange = { [weak native] layout in
            native?.notifyListeners("viewportLayoutChanged", data: layout)
        }
    }

    override func router() -> Router { ModeAtlasRouter() }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        let webView = ModeAtlasWebView(frame: frame, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = ModeAtlasAppearance.canvas
        webView.scrollView.backgroundColor = webView.backgroundColor
        return webView
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.overrideUserInterfaceStyle = ModeAtlasAppearance.style
        window?.backgroundColor = ModeAtlasAppearance.canvas
        window?.rootViewController = ModeAtlasBridgeViewController()
        window?.makeKeyAndVisible()
        if let response = connectionOptions.notificationResponse,
           [ModeAtlasNativePlugin.reminderID, ModeAtlasNativePlugin.testID].contains(response.notification.request.identifier),
           response.actionIdentifier == UNNotificationDefaultActionIdentifier {
            ModeAtlasNavigation.queue(.reading)
        }
        if let shortcut = connectionOptions.shortcutItem { _ = handleShortcut(shortcut) }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        let remainingContexts = URLContexts.filter { !GIDSignIn.sharedInstance.handle($0.url) }
        if !remainingContexts.isEmpty {
            SceneDelegateProxy.shared.scene(scene, openURLContexts: Set(remainingContexts))
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    private func handleShortcut(_ shortcut: UIApplicationShortcutItem) -> Bool {
        let destinations: [String: ModeAtlasDestination] = ["app.modeatlas.reading": .reading, "app.modeatlas.writing": .writing, "app.modeatlas.daily": .daily]
        guard let destination = destinations[shortcut.type] else { return false }
        ModeAtlasNavigation.queue(destination)
        return true
    }

    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem,
                     completionHandler: @escaping (Bool) -> Void) {
        completionHandler(handleShortcut(shortcutItem))
    }
}
