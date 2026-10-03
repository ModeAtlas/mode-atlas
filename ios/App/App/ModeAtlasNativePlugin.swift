import Foundation
import UIKit
import Capacitor
import UserNotifications
import WidgetKit
import AVFAudio
import MessageUI
import FirebaseCore

@objc(ModeAtlasNativePlugin)
public final class ModeAtlasNativePlugin: CAPPlugin, CAPBridgedPlugin, NotificationHandlerProtocol, MFMailComposeViewControllerDelegate {
    public let identifier = "ModeAtlasNativePlugin"
    public let jsName = "ModeAtlasNative"
    public let pluginMethods: [CAPPluginMethod] = [
        "publishWidgetSnapshot", "getNotificationStatus", "requestNotifications",
        "configureStudyReminder", "getEngagementState",
        "resetEngagement", "testNotification", "openNotificationSettings", "consumeDestination", "setAppearance",
        "exportBackup", "getAccessibilityPreferences", "setAppIcon", "playSound", "stopSounds", "openExternalLink", "composeFeedback", "shareFriendCode", "getAppVersion", "revokeAppleAuthorization"
    ].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    static let reminderID = "mode-atlas.daily-study"
    static let testID = "mode-atlas.notification-test"
    private let center = UNUserNotificationCenter.current()
    private var operations: Task<Void, Never>?
    private var reloadWork: DispatchWorkItem?
    private var lastReload = Date.distantPast
    private var observers: [NSObjectProtocol] = []
    private var sharingBackup = false
    private var sharingFriendCode = false
    private var changingIcon = false
    private var mailCall: CAPPluginCall?
    private let sounds = ModeAtlasSoundPlayer()

    @objc func getAppVersion(_ call: CAPPluginCall) {
        call.resolve(["version": Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "",
                      "build": Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "", "platform": "ios"])
    }

    @objc func revokeAppleAuthorization(_ call: CAPPluginCall) {
        guard let code = call.getString("authorizationCode"), !code.isEmpty,
              let idToken = call.getString("firebaseIdToken"), !idToken.isEmpty,
              let apiKey = FirebaseApp.app()?.options.apiKey,
              let bundleID = Bundle.main.bundleIdentifier else {
            call.reject("Apple authorization revocation is unavailable.", "apple-revocation-unavailable"); return
        }
        // Firebase's native revokeToken method requires a native currentUser.
        // JS Auth owns our only session, so send its fresh token to the same
        // documented endpoint. Credentials are never persisted or logged.
        var components = URLComponents(string: "https://identitytoolkit.googleapis.com/v2/accounts:revokeToken")!
        components.queryItems = [URLQueryItem(name: "key", value: apiKey)]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(bundleID, forHTTPHeaderField: "X-Ios-Bundle-Identifier")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "providerId": "apple.com", "tokenType": "CODE", "token": code, "idToken": idToken
        ])
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 20
        let session = URLSession(configuration: configuration)
        session.dataTask(with: request) { _, response, error in
            defer { session.finishTasksAndInvalidate() }
            guard error == nil, let status = (response as? HTTPURLResponse)?.statusCode, (200..<300).contains(status) else {
                call.reject("Apple authorization could not be revoked. Please try again.", "apple-revocation-failed")
                return
            }
            call.resolve(["revoked": true])
        }.resume()
    }

    @objc func shareFriendCode(_ call: CAPPluginCall) {
        guard let code = call.getString("code"), code.range(of: "^[A-F0-9]{4}(-[A-F0-9]{4}){4}$", options: .regularExpression) != nil else {
            call.reject("Invalid friend code"); return
        }
        DispatchQueue.main.async {
            guard !self.sharingFriendCode, let controller = self.bridge?.viewController,
                  controller.presentedViewController == nil else {
                call.reject("Close the current sheet first"); return
            }
            let text = "Add me in Mode Atlas: \(code)\nOpen Profile → Friends → Add friend and enter this code."
            let sheet = UIActivityViewController(activityItems: [text], applicationActivities: nil)
            sheet.completionWithItemsHandler = { _, completed, _, error in
                self.sharingFriendCode = false
                if let error { call.reject("Could not share your friend code", nil, error) }
                else { call.resolve(["status": completed ? "shared" : "cancelled"]) }
            }
            if let popover = sheet.popoverPresentationController {
                popover.sourceView = controller.view
                popover.sourceRect = CGRect(x: controller.view.bounds.midX, y: controller.view.bounds.maxY - controller.view.safeAreaInsets.bottom, width: 1, height: 1)
                popover.permittedArrowDirections = []
            }
            self.sharingFriendCode = true
            controller.present(sheet, animated: true)
        }
    }

    @objc func playSound(_ call: CAPPluginCall) {
        guard let cue = call.getString("cue"), let volume = call.getDouble("volume"), volume.isFinite,
              volume >= 0, volume <= 1 else { call.reject("Invalid sound"); return }
        DispatchQueue.main.async { call.resolve(["played": self.sounds.play(cue, volume: Float(volume))]) }
    }
    @objc func stopSounds(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.sounds.fadeOut(); call.resolve() }
    }
    @objc func openExternalLink(_ call: CAPPluginCall) {
        guard let value = call.getString("url"), let url = URL(string: value),
              ["https", "mailto"].contains(url.scheme?.lowercased() ?? "") else {
            call.reject("Unsupported link"); return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url) { opened in call.resolve(["opened": opened]) }
        }
    }

    @objc func composeFeedback(_ call: CAPPluginCall) {
        guard let subject = call.getString("subject"), subject.count <= 160,
              let body = call.getString("body"), body.count <= 6000 else {
            call.reject("Invalid feedback draft"); return
        }
        DispatchQueue.main.async {
            guard self.mailCall == nil, let controller = self.bridge?.viewController,
                  controller.presentedViewController == nil else {
                call.reject("Close the current sheet first"); return
            }
            guard MFMailComposeViewController.canSendMail() else {
                call.resolve(["status": "unavailable"]); return
            }
            let composer = MFMailComposeViewController()
            composer.mailComposeDelegate = self
            composer.setToRecipients(["support@mode-atlas.com"])
            composer.setSubject(subject)
            composer.setMessageBody(body, isHTML: false)
            self.mailCall = call
            controller.present(composer, animated: true)
        }
    }
    public func mailComposeController(_ controller: MFMailComposeViewController,
                                      didFinishWith result: MFMailComposeResult, error: Error?) {
        let call = mailCall
        mailCall = nil
        controller.dismiss(animated: true) {
            let status = error != nil ? "failed" : result == .sent ? "queued" : result == .saved ? "saved" : "cancelled"
            call?.resolve(["status": status])
        }
    }

    @objc func setAppIcon(_ call: CAPPluginCall) {
        let name = call.getString("name")
        let icons = Bundle.main.infoDictionary?["CFBundleIcons"] as? [String: Any]
        let alternates = icons?["CFBundleAlternateIcons"] as? [String: Any] ?? [:]
        guard name == nil || alternates[name!] != nil else {
            call.reject("Unknown app icon"); return
        }
        DispatchQueue.main.async {
            guard UIApplication.shared.supportsAlternateIcons, !self.changingIcon else {
                call.reject("App icons are unavailable right now"); return
            }
            self.changingIcon = true
            UIApplication.shared.setAlternateIconName(name) { error in
                DispatchQueue.main.async {
                    self.changingIcon = false
                    if let error { call.reject("Could not change the app icon", nil, error) }
                    else { call.resolve(["changed": true]) }
                }
            }
        }
    }

    override public func load() {
        bridge?.notificationRouter.localNotificationHandler = self
        observers.append(NotificationCenter.default.addObserver(forName: ModeAtlasNavigation.event, object: nil, queue: .main) { [weak self] _ in
            self?.notifyListeners("destinationAction", data: [:], retainUntilConsumed: true)
        })
        observers.append(NotificationCenter.default.addObserver(forName: UIContentSizeCategory.didChangeNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self = self else { return }
            self.notifyListeners("accessibilityChanged", data: self.accessibilityPreferences())
        })
    }
    deinit { observers.forEach { NotificationCenter.default.removeObserver($0) } }

    private func accessibilityPreferences() -> [String: Any] {
        ["textScale": UIFontMetrics(forTextStyle: .body).scaledValue(for: 16) / 16]
    }
    @objc func getAccessibilityPreferences(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(self.accessibilityPreferences()) }
    }

    @objc func exportBackup(_ call: CAPPluginCall) {
        guard let filename = call.getString("filename"),
              filename.range(of: "^mode-atlas-save-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.json$", options: .regularExpression) != nil,
              let contents = call.getString("contents"), let data = contents.data(using: .utf8), data.count <= 16 * 1024 * 1024,
              let backup = try? JSONSerialization.jsonObject(with: data) as? [String: Any], backup["app"] as? String == "Mode Atlas" else {
            call.reject("Invalid Mode Atlas backup"); return
        }
        DispatchQueue.main.async {
            guard !self.sharingBackup, let controller = self.bridge?.viewController,
                  controller.presentedViewController == nil else {
                call.reject("Close the current sheet before exporting your save"); return
            }
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("ModeAtlasExport-" + UUID().uuidString)
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let file = directory.appendingPathComponent(filename)
                try data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
                sheet.completionWithItemsHandler = { _, completed, _, error in
                    self.sharingBackup = false
                    try? FileManager.default.removeItem(at: directory)
                    if let error = error { call.reject("Could not share your save", nil, error) }
                    else { call.resolve(["supported": true, "completed": completed]) }
                }
                if let popover = sheet.popoverPresentationController {
                    popover.sourceView = controller.view
                    popover.sourceRect = CGRect(x: controller.view.bounds.midX, y: controller.view.bounds.midY, width: 1, height: 1)
                    popover.permittedArrowDirections = []
                }
                self.sharingBackup = true
                controller.present(sheet, animated: true)
            } catch {
                try? FileManager.default.removeItem(at: directory)
                call.reject("Could not prepare your save", nil, error)
            }
        }
    }

    @objc func setAppearance(_ call: CAPPluginCall) {
        guard let preference = call.getString("preference"), ["dark", "light", "system"].contains(preference) else {
            call.reject("Unknown appearance preference")
            return
        }
        DispatchQueue.main.async {
            // Only a launch-frame mirror. Shared JavaScript owns the preference.
            UserDefaults.standard.set(preference, forKey: ModeAtlasAppearance.preferenceKey)
            self.bridge?.viewController?.view.window?.overrideUserInterfaceStyle = ModeAtlasAppearance.style
            self.bridge?.viewController?.setNeedsStatusBarAppearanceUpdate()
            call.resolve(["applied": true])
        }
    }

    // All mutations and reads use the same queue, including permission dialogs,
    // so a delayed enable cannot undo a newer disable/reset from another page.
    // The action itself stays on the main actor, including after suspension.
    private func enqueue(_ call: CAPPluginCall, _ action: @escaping @MainActor () async throws -> [String: Any]) {
        DispatchQueue.main.async {
            let previous = self.operations
            self.operations = Task { @MainActor in
                await previous?.value
                do { call.resolve(try await action()) }
                catch { call.reject("The iOS action could not be completed", nil, error) }
            }
        }
    }
    private func permission() async -> [String: Any] {
        let settings = await center.notificationSettings()
        let status: String
        switch settings.authorizationStatus {
        case .authorized: status = "authorized"
        case .provisional: status = "provisional"
        case .ephemeral: status = "ephemeral"
        case .denied: status = "denied"
        default: status = "notDetermined"
        }
        return ["supported": true, "granted": [UNAuthorizationStatus.authorized, .provisional].contains(settings.authorizationStatus), "status": status]
    }
    private func reloadWidgets(immediate: Bool = false) {
        reloadWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            WidgetCenter.shared.reloadTimelines(ofKind: ModeAtlasWidgetStore.kind)
            self?.lastReload = Date()
        }
        reloadWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + (immediate ? 0 : max(0, 60 - Date().timeIntervalSince(lastReload))), execute: work)
    }
    @objc func publishWidgetSnapshot(_ call: CAPPluginCall) {
        guard let json = call.getString("snapshot"), let data = json.data(using: .utf8), data.count <= 4096,
              let snapshot = try? JSONDecoder().decode(ModeAtlasWidgetSnapshot.self, from: data), snapshot.isValid else {
            call.reject("Invalid widget snapshot"); return
        }
        enqueue(call) { [self] in
            guard ModeAtlasWidgetStore.container != nil else {
                return ["stored": false, "widgetAvailable": true]
            }
            try ModeAtlasWidgetStore.write(snapshot)
            // A delayed work item can be suspended with the app. Ask WidgetKit
            // to read the final snapshot now when leaving the foreground.
            reloadWidgets(immediate: UIApplication.shared.applicationState != .active)
            return ["stored": true, "widgetAvailable": true]
        }
    }
    @objc func getNotificationStatus(_ call: CAPPluginCall) { enqueue(call) { await self.permission() } }
    @objc func requestNotifications(_ call: CAPPluginCall) {
        enqueue(call) { [self] in
            _ = try await center.requestAuthorization(options: [.alert, .sound])
            return await permission()
        }
    }
    @objc func getEngagementState(_ call: CAPPluginCall) {
        enqueue(call) { [self] in
            var status = await permission()
            let pending = await center.pendingNotificationRequests()
            let request = pending.first { $0.identifier == Self.reminderID }
            let time = (request?.trigger as? UNCalendarNotificationTrigger)?.dateComponents
            status["enabled"] = request != nil
            status["hour"] = time?.hour ?? 19
            status["minute"] = time?.minute ?? 0
            return ["supported": true, "reminder": status, "widgets": [
                "available": true, "progressSupported": ModeAtlasWidgetStore.container != nil]]
        }
    }
    @objc func configureStudyReminder(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled"), let hour = call.getInt("hour"), let minute = call.getInt("minute"),
              (0...23).contains(hour), (0...59).contains(minute) else { call.reject("Invalid reminder preference"); return }
        enqueue(call) { [self] in
            if !enabled {
                center.removePendingNotificationRequests(withIdentifiers: [Self.reminderID])
                center.removeDeliveredNotifications(withIdentifiers: [Self.reminderID])
                return ["supported": true, "enabled": false]
            }
            guard (await permission())["granted"] as? Bool == true else {
                return ["supported": true, "enabled": false, "permission": "denied"]
            }
            let content = notificationContent(test: false)
            var time = DateComponents(); time.hour = hour; time.minute = minute
            try await center.add(UNNotificationRequest(identifier: Self.reminderID, content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: time, repeats: true)))
            return ["supported": true, "enabled": true, "hour": hour, "minute": minute]
        }
    }
    private func notificationContent(test: Bool) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = test ? "Your Mode Atlas reminder is ready" : "A little Japanese, every day"
        content.body = test ? "Tap to open Reading practice." : "Ready for a few minutes of practice? Tap to continue."
        content.sound = .default
        content.userInfo = ["destination": "reading"]
        return content
    }
    @objc func testNotification(_ call: CAPPluginCall) {
        enqueue(call) { [self] in
            guard (await permission())["granted"] as? Bool == true else { return ["scheduled": false, "permission": "denied"] }
            try await center.add(UNNotificationRequest(identifier: Self.testID, content: notificationContent(test: true),
                trigger: UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)))
            return ["scheduled": true]
        }
    }
    @objc func resetEngagement(_ call: CAPPluginCall) {
        enqueue(call) { [self] in
            center.removePendingNotificationRequests(withIdentifiers: [Self.reminderID, Self.testID])
            center.removeDeliveredNotifications(withIdentifiers: [Self.reminderID, Self.testID])
            try ModeAtlasWidgetStore.clear()
            reloadWidgets(immediate: true)
            return ["reset": true]
        }
    }
    @objc func openNotificationSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openNotificationSettingsURLString) else { call.resolve(["opened": false]); return }
            UIApplication.shared.open(url, options: [:]) { call.resolve(["opened": $0]) }
        }
    }
    public func willPresent(notification: UNNotification) -> UNNotificationPresentationOptions {
        notification.request.identifier == Self.testID ? [.banner, .sound] : []
    }
    public func didReceive(response: UNNotificationResponse) {
        guard [Self.reminderID, Self.testID].contains(response.notification.request.identifier),
              response.actionIdentifier == UNNotificationDefaultActionIdentifier else { return }
        DispatchQueue.main.async {
            ModeAtlasNavigation.queue(.reading)
        }
    }
    @objc func consumeDestination(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let destination = ModeAtlasNavigation.consume()?.rawValue ?? ""
            call.resolve(["destination": destination])
        }
    }
}

// Native audio outlives individual bundled pages. PCM scores are generated from
// mode-atlas-sound-cues.js; no second set of pitch/envelope definitions lives here.
private final class ModeAtlasSoundPlayer: NSObject, AVAudioPlayerDelegate {
    private let names: Set<String> = ["tap", "correct", "wrong", "finish", "achievement", "success", "warning", "error"]
    private var players: [AVAudioPlayer] = []
    private var observers: [NSObjectProtocol] = []
    private var lastPlay: [String: TimeInterval] = [:]
    private var quietUntil: TimeInterval = 0
    private var sessionReady = false
    override init() {
        super.init()
        for name in [UIApplication.willResignActiveNotification, AVAudioSession.interruptionNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.fadeOut()
            })
        }
    }
    deinit { observers.forEach { NotificationCenter.default.removeObserver($0) } }
    func play(_ name: String, volume: Float) -> Bool {
        guard names.contains(name), UIApplication.shared.applicationState == .active else { return false }
        let now = Date.timeIntervalSinceReferenceDate
        players.removeAll { !$0.isPlaying }
        guard players.count < 4, now - (lastPlay[name] ?? -1) >= (name == "tap" ? 0.08 : 0.14),
              name != "tap" || now >= quietUntil,
              let url = Bundle.main.url(forResource: name, withExtension: "wav", subdirectory: "public/assets/audio") else { return false }
        do {
            if !sessionReady {
                // Ambient respects the Ring/Silent switch and allows other audio.
                try AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)
                sessionReady = true
            }
            try AVAudioSession.sharedInstance().setActive(true)
            let player = try AVAudioPlayer(contentsOf: url)
            player.volume = volume; player.delegate = self
            guard player.play() else { return false }
            players.append(player); lastPlay[name] = now
            if name != "tap" { quietUntil = now + player.duration }
            return true
        } catch { return false }
    }
    func fadeOut() {
        let fading = players
        fading.forEach { $0.setVolume(0, fadeDuration: 0.018) }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.025) { [weak self] in
            fading.forEach { $0.stop() }
            self?.players.removeAll { player in fading.contains { $0 === player } }
        }
    }
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        players.removeAll { $0 === player }
    }
}
