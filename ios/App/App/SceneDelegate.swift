import UIKit
import WebKit
import Capacitor
import GoogleSignIn

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
    override func router() -> Router { ModeAtlasRouter() }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        let webView = super.webView(with: frame, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 18/255, green: 26/255, blue: 43/255, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        return webView
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.backgroundColor = UIColor(red: 18/255, green: 26/255, blue: 43/255, alpha: 1)
        window?.rootViewController = ModeAtlasBridgeViewController()
        window?.makeKeyAndVisible()

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
