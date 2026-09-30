import AppIntents
import SwiftUI
import WidgetKit

struct StudyControlConfiguration: ControlConfigurationIntent {
    static var title: LocalizedStringResource = "Mode Atlas screen"
    @Parameter(title: "Open", default: .reading) var destination: ModeAtlasDestination
}

struct ModeAtlasStudyControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        AppIntentControlConfiguration(kind: "app.modeatlas.study", intent: StudyControlConfiguration.self) { configuration in
            ControlWidgetButton(action: OpenModeAtlasIntent(target: configuration.destination)) {
                Label(configuration.destination.title, systemImage: configuration.destination.symbol)
            }
        }
        .displayName("Open Mode Atlas")
        .description("Go straight to your chosen practice mode or progress screen.")
    }
}

@main
struct ModeAtlasWidgetBundle: WidgetBundle {
    var body: some Widget {
        ModeAtlasStudyWidget()
        ModeAtlasStudyControl()
    }
}
