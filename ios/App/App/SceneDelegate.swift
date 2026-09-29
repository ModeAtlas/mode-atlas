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

// Capacitor's default router serves index.html for every extensionless URL.
// Mode Atlas has real documents at these clean paths, so resolve them before
// falling back to Capacitor's asset routing.
private struct ModeAtlasRouter: Router {
    var basePath: String = ""

    func route(for path: String) -> String {
        let page = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if ["kana", "reading", "writing", "results", "wordbank", "privacy", "terms"].contains(page) {
            return basePath + "/" + page + "/index.html"
        }
        var fallback = CapacitorRouter()
        fallback.basePath = basePath
        return fallback.route(for: path)
    }
}

private final class ModeAtlasBridgeViewController: CAPBridgeViewController {
    override var preferredStatusBarStyle: UIStatusBarStyle {
        traitCollection.userInterfaceStyle == .dark ? .lightContent : .darkContent
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        setNeedsStatusBarAppearanceUpdate()
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
            ModeAtlasNativePlugin.pendingDestination = "reading"
        }

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
}
