import Foundation
import UIKit
import Capacitor
import UserNotifications
import WidgetKit

@objc(ModeAtlasNativePlugin)
public final class ModeAtlasNativePlugin: CAPPlugin, CAPBridgedPlugin, NotificationHandlerProtocol {
    public let identifier = "ModeAtlasNativePlugin"
    public let jsName = "ModeAtlasNative"
    public let pluginMethods: [CAPPluginMethod] = [
        "publishWidgetSnapshot", "getNotificationStatus", "requestNotifications",
        "configureStudyReminder", "getEngagementState",
        "resetEngagement", "testNotification", "openNotificationSettings", "consumeDestination", "setAppearance",
        "exportBackup", "getAccessibilityPreferences", "setAppIcon"
    ].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    static let reminderID = "mode-atlas.daily-study"
    static let testID = "mode-atlas.notification-test"
    private let center = UNUserNotificationCenter.current()
    private var operations: Task<Void, Never>?
    private var reloadWork: DispatchWorkItem?
    private var lastReload = Date.distantPast
    private var observers: [NSObjectProtocol] = []
    private var sharingBackup = false
    private var changingIcon = false

    @objc func setAppIcon(_ call: CAPPluginCall) {
        let name = call.getString("name")
        guard name == nil || ["Grove", "Summit", "Horizon"].contains(name!) else {
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
