import Foundation
import Capacitor
import UserNotifications

// Small projection only. Firebase identity and learning calculations stay in
// the shared application. A future WidgetKit target will consume this schema.
struct ModeAtlasWidgetSnapshot: Codable {
    let schemaVersion: Int
    let updatedAt: Double
    let level: Int
    let correct: Int
    let streak: Int
    let dailyComplete: Bool
    let levelProgress: Double
    let destination: String

    var isValid: Bool {
        schemaVersion == 1 && updatedAt.isFinite && updatedAt > 0 && level >= 1
            && correct >= 0 && streak >= 0 && levelProgress.isFinite
            && (0...1).contains(levelProgress) && ["kana", "daily"].contains(destination)
    }
}

// App-local storage deliberately does not claim to be a working Home Screen
// widget. App Group storage and an extension are a separate signed capability.
private enum ModeAtlasSnapshotStore {
    static func write(_ snapshot: ModeAtlasWidgetSnapshot) throws {
        let directory = try FileManager.default.url(for: .applicationSupportDirectory,
            in: .userDomainMask, appropriateFor: nil, create: true)
        let url = directory.appendingPathComponent("mode-atlas-widget-snapshot-v1.json")
        try JSONEncoder().encode(snapshot).write(to: url, options: [.atomic, .completeFileProtection])
    }
}

@objc(ModeAtlasNativePlugin)
public final class ModeAtlasNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ModeAtlasNativePlugin"
    public let jsName = "ModeAtlasNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "publishWidgetSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getNotificationStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestNotifications", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "configureStudyReminder", returnType: CAPPluginReturnPromise)
    ]
    private let reminderID = "mode-atlas.daily-study"
    private let center = UNUserNotificationCenter.current()

    @objc func publishWidgetSnapshot(_ call: CAPPluginCall) {
        guard let json = call.getString("snapshot"), let data = json.data(using: .utf8), data.count <= 4096,
              let snapshot = try? JSONDecoder().decode(ModeAtlasWidgetSnapshot.self, from: data),
              snapshot.isValid else { call.reject("Invalid widget snapshot"); return }
        do {
            try ModeAtlasSnapshotStore.write(snapshot)
            call.resolve(["stored": true, "widgetAvailable": false])
        } catch { call.reject("Could not store widget snapshot", nil, error) }
    }

    private func resolveStatus(_ call: CAPPluginCall) {
        center.getNotificationSettings { settings in
            let granted = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
            let status: String
            switch settings.authorizationStatus {
            case .authorized: status = "authorized"
            case .provisional: status = "provisional"
            case .ephemeral: status = "ephemeral"
            case .denied: status = "denied"
            default: status = "notDetermined"
            }
            call.resolve(["supported": true, "granted": granted, "status": status])
        }
    }

    @objc func getNotificationStatus(_ call: CAPPluginCall) { resolveStatus(call) }

    @objc func requestNotifications(_ call: CAPPluginCall) {
        center.requestAuthorization(options: [.alert, .sound]) { [weak self] _, error in
            if let error = error { call.reject("Notification permission failed", nil, error); return }
            self?.resolveStatus(call)
        }
    }

    @objc func configureStudyReminder(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled") else { call.reject("Missing enabled flag"); return }
        if !enabled {
            center.removePendingNotificationRequests(withIdentifiers: [reminderID])
            center.removeDeliveredNotifications(withIdentifiers: [reminderID])
            call.resolve(["supported": true, "enabled": false])
            return
        }
        guard let hour = call.getInt("hour"), let minute = call.getInt("minute"),
              (0...23).contains(hour), (0...59).contains(minute) else { call.reject("Invalid reminder time"); return }
        center.getNotificationSettings { [self] settings in
            guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {
                call.resolve(["supported": true, "enabled": false, "permission": "denied"]); return
            }
            let content = UNMutableNotificationContent()
            content.title = "A little Japanese, every day"
            content.body = "Ready for a few minutes of practice? Open Mode Atlas to continue."
            content.sound = .default
            var time = DateComponents()
            time.hour = hour
            time.minute = minute
            let request = UNNotificationRequest(identifier: reminderID, content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: time, repeats: true))
            // Reusing one identifier replaces the previous schedule; never stacks reminders.
            center.add(request) { error in
                if let error = error { call.reject("Could not schedule reminder", nil, error); return }
                call.resolve(["supported": true, "enabled": true, "hour": hour, "minute": minute])
            }
        }
    }
}
