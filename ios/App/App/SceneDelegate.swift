import UIKit
import WebKit
import Capacitor
import GoogleSignIn
import UserNotifications

// Mirrors the shared preference so the native frame does not flash navy before
// the bundled document loads. The launch storyboard itself follows the OS.
enum ModeAtlasAppearance {
    static let preferenceKey = "modeAtlasAppearance"
    static var style: UIUserInterfaceStyle {
        switch UserDefaults.standard.string(forKey: preferenceKey) ?? "dark" {
        case "light": return .light
        case "system": return .unspecified
        default: return .dark
        }
    }
    static var canvas: UIColor { UIColor(named: "AppCanvas") ?? .systemBackground }
}

private final class ModeAtlasBridgeViewController: CAPBridgeViewController {
    override var preferredStatusBarStyle: UIStatusBarStyle {
        traitCollection.userInterfaceStyle == .dark ? .lightContent : .darkContent
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (controller: ModeAtlasBridgeViewController, _: UITraitCollection) in
            controller.setNeedsStatusBarAppearanceUpdate()
        }
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ModeAtlasNativePlugin())
    }

    override func router() -> Router { ModeAtlasRouter() }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        let webView = super.webView(with: frame, configuration: configuration)
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
