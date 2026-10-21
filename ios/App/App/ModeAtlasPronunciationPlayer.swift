import Foundation
import AVFAudio

/// Renders a natural Japanese utterance, then changes playback duration without
/// changing its pitch or spelling. Short kana must not become long-vowel words.
final class ModeAtlasPronunciationPlayer {
    private let synth = AVSpeechSynthesizer()
    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let stretch = AVAudioUnitTimePitch()
    private var generation = 0
    private var completion: ((Bool) -> Void)?
    private var deadline: DispatchWorkItem?
    private var started = false
    private var queued = 0
    private var rendered = false

    init() {
        engine.attach(player)
        engine.attach(stretch)
        synth.usesApplicationAudioSession = false
    }

    func stop() {
        generation += 1
        deadline?.cancel(); deadline = nil
        synth.stopSpeaking(at: .immediate)
        player.stop(); engine.stop()
        started = false
        queued = 0; rendered = false
        finish(false)
    }

    private func finish(_ played: Bool) {
        let callback = completion; completion = nil
        callback?(played)
    }

    func play(_ text: String, slow: Bool, completion: @escaping (Bool) -> Void) {
        stop()
        guard let voice = AVSpeechSynthesisVoice(language: "ja-JP") else { completion(false); return }
        self.completion = completion
        let ticket = generation
        // Stretch the waveform itself: some voices barely change the duration
        // of a single mora when only AVSpeechUtterance.rate is changed.
        stretch.pitch = 0
        stretch.rate = slow ? 0.5 : (text.count <= 2 ? 0.72 : 0.9)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = voice
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        utterance.prefersAssistiveTechnologySettings = false
        let timeout = DispatchWorkItem { [weak self] in
            guard let self, self.generation == ticket, !self.started else { return }
            self.stop()
        }
        deadline = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 8, execute: timeout)
        synth.write(utterance) { [weak self] buffer in
            guard let pcm = buffer as? AVAudioPCMBuffer else { return }
            // Own a copy; the speech engine may reuse its callback buffer.
            let copy = AVAudioPCMBuffer(pcmFormat: pcm.format, frameCapacity: max(1, pcm.frameLength))!
            copy.frameLength = pcm.frameLength
            let source = UnsafeMutableAudioBufferListPointer(pcm.mutableAudioBufferList)
            let target = UnsafeMutableAudioBufferListPointer(copy.mutableAudioBufferList)
            for index in 0..<source.count where source[index].mDataByteSize > 0 {
                if let from = source[index].mData, let to = target[index].mData {
                    memcpy(to, from, Int(source[index].mDataByteSize))
                }
            }
            DispatchQueue.main.async {
                guard let self, self.generation == ticket else { return }
                guard copy.frameLength > 0 else {
                    self.rendered = true
                    if !self.started || self.queued == 0 { self.stop() }
                    return
                }
                if !self.started {
                    self.engine.connect(self.player, to: self.stretch, format: copy.format)
                    self.engine.connect(self.stretch, to: self.engine.mainMixerNode, format: copy.format)
                    do { try self.engine.start() } catch { self.stop(); return }
                    self.started = true
                    self.deadline?.cancel(); self.deadline = nil
                }
                self.queued += 1
                self.player.scheduleBuffer(copy, completionCallbackType: .dataPlayedBack) { [weak self] _ in
                    DispatchQueue.main.async {
                        guard let self, self.generation == ticket else { return }
                        self.queued -= 1
                        if self.rendered && self.queued == 0 { self.stop() }
                    }
                }
                if !self.player.isPlaying { self.player.play() }
                self.finish(true)
            }
        }
    }
}
