// Bundled into the existing AppDelegate.swift by scripts/ios-background-mic.py.
// Native audio capture is required: iOS suspends WKWebView's Web Audio in background.
// Audio samples NEVER leave the device and are not saved. Only 12-note profiles
// are retained in a bounded in-memory FIFO while the user enables live follow.
import AVFoundation
import Capacitor

@objc(CantoriaBridgeViewController)
open class CantoriaBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(CantoriaBackgroundMicPlugin())
    }
}

@objc(CantoriaBackgroundMicPlugin)
public class CantoriaBackgroundMicPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CantoriaBackgroundMicPlugin"
    public let jsName = "CantoriaBackgroundMic"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pull", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ensure", returnType: CAPPluginReturnPromise)
    ]

    private struct ChromaFrame {
        let seq: Int
        let at: Int
        let chroma: [Double]
        let level: Double
    }
    private let captureQueue = DispatchQueue(label: "it.cantoria.backgroundmic.analysis", qos: .userInitiated)
    private let stateLock = NSLock()
    private var frames: [ChromaFrame] = []
    private var lastSeq = 0
    private var captureGeneration = 0
    private var lastSampleTime = 0
    private var activeEngine: AVAudioEngine?
    private var recordingRequested = false
    private var permissionRequestID = 0
    private var interruptionObserver: NSObjectProtocol?
    private var routeObserver: NSObjectProtocol?

    override public func load() {
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification, object: nil, queue: .main
        ) { [weak self] notice in
            guard let self = self, self.recordingRequested else { return }
            guard let number = notice.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let kind = AVAudioSession.InterruptionType(rawValue: number) else { return }
            if kind == .ended { self.restartCaptureIfNeeded() }
        }
        routeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main
        ) { [weak self] _ in
            guard let self = self, self.recordingRequested else { return }
            if self.activeEngine?.isRunning != true { self.restartCaptureIfNeeded() }
        }
    }

    deinit {
        if let observer = interruptionObserver { NotificationCenter.default.removeObserver(observer) }
        if let observer = routeObserver { NotificationCenter.default.removeObserver(observer) }
        activeEngine?.stop()
    }

    private func shutdown(clearFrames: Bool) {
        activeEngine?.stop()
        activeEngine?.inputNode.removeTap(onBus: 0)
        activeEngine = nil
        stateLock.lock()
        captureGeneration += 1
        if clearFrames {
            frames.removeAll()
            lastSeq = 0
            lastSampleTime = 0
        }
        stateLock.unlock()
    }

    // Run only on main. Recording starts on an explicit action; never as part
    // of application boot or a generic lifecycle transition.
    private func beginCapture() throws {
        shutdown(clearFrames: false)
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement)
        try session.setActive(true)
        let engine = AVAudioEngine()
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0 && format.channelCount > 0 else {
            throw NSError(domain: "CantoriaMicrophone", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Ingresso microfono non disponibile"])
        }
        stateLock.lock()
        let generation = captureGeneration
        stateLock.unlock()
        let rate = format.sampleRate
        input.installTap(onBus: 0, bufferSize: 8192, format: format) { [weak self] buffer, _ in
            guard let channel = buffer.floatChannelData?[0] else { return }
            let sampleCount = Int(buffer.frameLength)
            guard sampleCount >= 1024 else { return }
            let copy = Array(UnsafeBufferPointer(start: channel, count: sampleCount))
            self?.captureQueue.async { [weak self] in
                self?.analyse(copy, sampleRate: rate, generation: generation)
            }
        }
        do {
            try engine.start()
            activeEngine = engine
        } catch {
            input.removeTap(onBus: 0)
            throw error
        }
    }

    private func restartCaptureIfNeeded() {
        guard recordingRequested else { return }
        let now = Int(Date().timeIntervalSince1970 * 1000)
        stateLock.lock()
        let stale = lastSampleTime > 0 && now - lastSampleTime > 5000
        stateLock.unlock()
        if activeEngine?.isRunning == true && !stale { return }
        do { try beginCapture() }
        catch { NSLog("Cantoria background microphone recovery: %@", error.localizedDescription) }
    }

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.permissionRequestID += 1
            let requestID = self.permissionRequestID
            self.recordingRequested = true
            self.shutdown(clearFrames: true)
            let session = AVAudioSession.sharedInstance()
            let proceed: (Bool) -> Void = { granted in
                guard self.recordingRequested && self.permissionRequestID == requestID else {
                    call.reject("Avvio microfono annullato")
                    return
                }
                guard granted else {
                    self.recordingRequested = false
                    call.reject("Autorizza il microfono nelle impostazioni di iOS")
                    return
                }
                do {
                    try self.beginCapture()
                    call.resolve(["running": true])
                } catch {
                    self.recordingRequested = false
                    self.shutdown(clearFrames: false)
                    call.reject("Impossibile avviare il microfono nativo: " + error.localizedDescription)
                }
            }
            switch session.recordPermission {
            case .granted: proceed(true)
            case .denied: proceed(false)
            case .undetermined:
                session.requestRecordPermission { granted in
                    DispatchQueue.main.async { proceed(granted) }
                }
            @unknown default: proceed(false)
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.permissionRequestID += 1
            self.recordingRequested = false
            self.shutdown(clearFrames: true)
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            call.resolve(["running": false])
        }
    }

    @objc func ensure(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.restartCaptureIfNeeded()
            call.resolve(["running": self.recordingRequested && self.activeEngine?.isRunning == true])
        }
    }

    @objc func pull(_ call: CAPPluginCall) {
        let after = call.getInt("after") ?? 0
        let limit = max(1, min(call.getInt("limit") ?? 180, 300))
        stateLock.lock()
        let batch = Array(frames.lazy.filter { $0.seq > after }.prefix(limit))
        let oldest = frames.first?.seq ?? (lastSeq + 1)
        let last = lastSeq
        let sampled = lastSampleTime
        stateLock.unlock()
        let payload: JSArray = batch.map { frame in
            let json: JSObject = [
                "seq": frame.seq,
                "at": frame.at,
                "chroma": frame.chroma,
                "level": frame.level
            ]
            return json
        }
        let age = sampled > 0 ? Int(Date().timeIntervalSince1970 * 1000) - sampled : -1
        call.resolve([
            "frames": payload,
            "running": recordingRequested && activeEngine?.isRunning == true,
            "firstSeq": oldest,
            "latestSeq": last,
            "lastSampleAgeMs": age
        ])
    }

    private func analyse(_ samples: [Float], sampleRate: Double, generation: Int) {
        let count = min(samples.count, 8192)
        guard count >= 1024 && sampleRate > 0 else { return }
        var windowed = [Double](repeating: 0, count: count)
        var power = 0.0
        for index in 0..<count {
            let value = Double(samples[index])
            power += value * value
            let window = 0.5 - 0.5 * cos(2.0 * .pi * Double(index) / Double(count - 1))
            windowed[index] = value * window
        }
        let rms = sqrt(power / Double(count))
        var profile = [Double](repeating: 0, count: 12)
        if rms > 0.0012 {
            var peaks = [Double](repeating: 0, count: 48)
            for midi in 40...87 {
                let frequency = 440.0 * pow(2.0, Double(midi - 69) / 12.0)
                if frequency > sampleRate * 0.4 { continue }
                let omega = 2.0 * .pi * frequency / sampleRate
                let coefficient = 2.0 * cos(omega)
                var q1 = 0.0
                var q2 = 0.0
                for value in windowed {
                    let q0 = value + coefficient * q1 - q2
                    q2 = q1
                    q1 = q0
                }
                let energy = max(0.0, q1 * q1 + q2 * q2 - coefficient * q1 * q2)
                peaks[midi - 40] = sqrt(energy) / sqrt(max(0.65, frequency / 150.0))
            }
            let highest = peaks.max() ?? 0
            if highest > 0 {
                for midi in 40...87 {
                    let value = peaks[midi - 40]
                    if value >= highest * 0.16 { profile[midi % 12] += value * value }
                }
                let total = profile.reduce(0.0, +)
                if total > 0 { profile = profile.map { $0 / total } }
            }
        }
        let ms = Int(Date().timeIntervalSince1970 * 1000)
        stateLock.lock()
        defer { stateLock.unlock() }
        guard generation == captureGeneration && recordingRequested else { return }
        lastSeq += 1
        lastSampleTime = ms
        frames.append(ChromaFrame(seq: lastSeq, at: ms, chroma: profile,
                                  level: min(100, max(0, rms * 650))))
        // Roughly 45 min at one 8192-sample tap per 0.17s.
        if frames.count > 16000 { frames.removeFirst(1500) }
    }
}
