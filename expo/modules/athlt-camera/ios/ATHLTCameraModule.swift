import ExpoModulesCore
import AVFoundation
import CoreML
import Vision
import CoreMedia
import CoreVideo
import UIKit

// ─── Notification for broadcasting session to ATHLTCameraView instances ────────

extension Notification.Name {
    static let athltSessionChanged = Notification.Name("com.athlt.camera.sessionChanged")
}

// ─── Shared session holder ─────────────────────────────────────────────────────

final class ATHLTSessionHolder {
    static let shared = ATHLTSessionHolder()
    private(set) var session: AVCaptureSession?

    private init() {}

    func set(_ session: AVCaptureSession?) {
        self.session = session
        NotificationCenter.default.post(name: .athltSessionChanged, object: session)
    }
}

// ─── Ball position record ──────────────────────────────────────────────────────

private struct BallRecord {
    let centerX: Double
    let centerY: Double
    let timestamp: Double
}

// ─── Capture delegate ──────────────────────────────────────────────────────────

private final class ATHLTCaptureDelegate: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    weak var module: ATHLTCameraModule?

    func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        module?.handleSampleBuffer(sampleBuffer)
    }
}

// ─── Main Expo Module ──────────────────────────────────────────────────────────

public class ATHLTCameraModule: Module {

    // MARK: – Session infrastructure
    private let sessionQueue = DispatchQueue(label: "com.athlt.camera.session", qos: .userInteractive)
    private let inferenceQueue = DispatchQueue(label: "com.athlt.camera.inference", qos: .userInteractive)

    private var captureSession: AVCaptureSession?
    private var videoOutput: AVCaptureVideoDataOutput?
    private var captureDelegate: ATHLTCaptureDelegate?

    // MARK: – Camera position (back by default)
    // NOTE: Front camera reduces CV accuracy — lower quality sensor + farther from hoop.
    // Flip is provided so users can aim without a tripod; expect ~20% lower detection rate.
    private var currentPosition: AVCaptureDevice.Position = .back

    // MARK: – CoreML
    private var visionModel: VNCoreMLModel?
    private var isModelLoaded = false

    // MARK: – Camera mode
    // "idle"      → no inference
    // "detection" → basket/hoop seeking; emits onHoopDetected
    // "tracking"  → full shot detection state machine
    private var currentMode: String = "idle"

    // MARK: – Tracking state (inferenceQueue)
    private var isTracking = false
    private var makes = 0
    private var attempts = 0

    // MARK: – Frame throttle (~5fps from 30fps)
    private var frameCounter = 0
    private let frameSkip = 6

    // MARK: – Shot detection state
    private var ballHistory: [BallRecord] = []
    private let maxBallHistory = 30

    private var lastBasket: CGRect?
    private var lastShotTime: Double = 0
    private let shotCooldown: Double = 1.5

    private var ballNearBasketSince: Double = 0
    private var pendingMissDeadline: Double = 0
    private let missDetectionWindow: Double = 0.8

    // MARK: – Hoop detection throttle
    private var lastHoopEventTime: Double = 0
    private let hoopEventThrottle: Double = 0.5

    // MARK: – Diagnostic mode
    private var diagnosticMode = false
    private var framesAnalyzed = 0
    private var recentFrameTimestamps: [Double] = []
    private var lastDiagnosticEventTime: Double = 0
    private let diagnosticEventThrottle: Double = 0.25  // emit up to 4/sec

    // MARK: – Module definition ─────────────────────────────────────────────────

    public func definition() -> ModuleDefinition {
        Name("ATHLTCamera")

        Events("onShotDetected", "onError", "onCameraState", "onHoopDetected", "onDetectionDebug")

        View(ATHLTCameraView.self) {
            Prop("isActive") { (_: ATHLTCameraView, _: Bool) in }
        }

        // ── startSession ────────────────────────────────────────────────────────
        AsyncFunction("startSession") { (promise: Promise) in
            self.sessionQueue.async { self.doStartSession(promise: promise) }
        }

        // ── stopSession ─────────────────────────────────────────────────────────
        AsyncFunction("stopSession") { (promise: Promise) in
            self.sessionQueue.async {
                self.videoOutput?.setSampleBufferDelegate(nil, queue: nil)
                self.captureSession?.stopRunning()
                self.captureSession = nil
                self.videoOutput = nil
                self.captureDelegate = nil
                ATHLTSessionHolder.shared.set(nil)
                NSLog("[ATHLTCamera] session stopped")
                promise.resolve(["success": true])
            }
        }

        // ── loadModel ────────────────────────────────────────────────────────────
        AsyncFunction("loadModel") { (promise: Promise) in
            self.inferenceQueue.async { self.doLoadModel(promise: promise) }
        }

        // ── setMode ──────────────────────────────────────────────────────────────
        AsyncFunction("setMode") { (mode: String, promise: Promise) in
            self.inferenceQueue.async {
                self.currentMode = mode
                NSLog("[ATHLTCamera] mode: %@", mode)
                promise.resolve()
            }
        }

        // ── flipCamera ───────────────────────────────────────────────────────────
        // Switches between back and front cameras. Front camera gives lower CV
        // accuracy (~20% fewer detections) due to sensor quality and angle.
        AsyncFunction("flipCamera") { (promise: Promise) in
            self.sessionQueue.async { self.doFlipCamera(promise: promise) }
        }

        // ── setDiagnosticMode ────────────────────────────────────────────────────
        // When enabled, emits onDetectionDebug on every analyzed frame so the
        // user can validate that the model is seeing detections before a real session.
        AsyncFunction("setDiagnosticMode") { (enabled: Bool, promise: Promise) in
            self.inferenceQueue.async {
                self.diagnosticMode = enabled
                if !enabled {
                    self.framesAnalyzed = 0
                    self.recentFrameTimestamps.removeAll()
                }
                NSLog("[ATHLTCamera] diagnostic mode: %@", enabled ? "ON" : "OFF")
                promise.resolve()
            }
        }

        // ── startTracking ────────────────────────────────────────────────────────
        AsyncFunction("startTracking") { (promise: Promise) in
            self.inferenceQueue.async {
                self.makes = 0
                self.attempts = 0
                self.ballHistory.removeAll()
                self.lastShotTime = 0
                self.ballNearBasketSince = 0
                self.pendingMissDeadline = 0
                self.isTracking = true
                self.currentMode = "tracking"
                NSLog("[ATHLTCamera] tracking started")
                promise.resolve()
            }
        }

        // ── stopTracking ─────────────────────────────────────────────────────────
        AsyncFunction("stopTracking") { (promise: Promise) in
            self.inferenceQueue.async {
                self.isTracking = false
                self.currentMode = "idle"
                let m = self.makes
                let a = self.attempts
                let pct = a > 0 ? Int(round(Double(m) / Double(a) * 100)) : 0
                NSLog("[ATHLTCamera] tracking stopped — %d/%d (%d%%)", m, a, pct)
                promise.resolve(["makes": m, "attempts": a, "fgPercent": pct])
            }
        }

        // ── isModelLoaded ────────────────────────────────────────────────────────
        Function("isModelLoaded") { () -> Bool in
            return self.isModelLoaded
        }
    }

    // MARK: – startSession ─────────────────────────────────────────────────────

    private func doStartSession(promise: Promise) {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        switch status {
        case .authorized:
            configureSession(position: currentPosition, promise: promise)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                guard let self = self else { return }
                if granted {
                    self.sessionQueue.async {
                        self.configureSession(position: self.currentPosition, promise: promise)
                    }
                } else {
                    promise.resolve(["success": false, "error": "Camera permission denied by user"])
                }
            }
        case .denied, .restricted:
            promise.resolve(["success": false, "error": "Camera permission denied. Enable in iOS Settings → ATHLT → Camera."])
        @unknown default:
            promise.resolve(["success": false, "error": "Unknown camera auth status"])
        }
    }

    private func configureSession(position: AVCaptureDevice.Position, promise: Promise) {
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position) else {
            promise.resolve(["success": false, "error": "No camera found for position \(position.rawValue)"])
            return
        }

        let session = AVCaptureSession()
        session.beginConfiguration()
        session.sessionPreset = .hd1280x720

        do {
            let input = try AVCaptureDeviceInput(device: device)
            guard session.canAddInput(input) else {
                promise.resolve(["success": false, "error": "Cannot add camera input"])
                return
            }
            session.addInput(input)
        } catch {
            promise.resolve(["success": false, "error": "Camera input error: \(error.localizedDescription)"])
            return
        }

        let output = AVCaptureVideoDataOutput()
        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        output.alwaysDiscardsLateVideoFrames = true

        let delegate = ATHLTCaptureDelegate()
        delegate.module = self
        self.captureDelegate = delegate
        output.setSampleBufferDelegate(delegate, queue: sessionQueue)

        guard session.canAddOutput(output) else {
            promise.resolve(["success": false, "error": "Cannot add video output"])
            return
        }
        session.addOutput(output)

        if let conn = output.connection(with: .video) {
            if conn.isVideoOrientationSupported { conn.videoOrientation = .landscapeRight }
            if conn.isVideoMirroringSupported { conn.isVideoMirrored = (position == .front) }
        }

        session.commitConfiguration()
        self.captureSession = session
        self.videoOutput = output
        ATHLTSessionHolder.shared.set(session)
        session.startRunning()

        let running = session.isRunning
        NSLog("[ATHLTCamera] session configured (%@), running: %@",
              position == .front ? "front" : "back", running ? "YES" : "NO")
        promise.resolve(["success": running])
    }

    // MARK: – flipCamera ───────────────────────────────────────────────────────

    private func doFlipCamera(promise: Promise) {
        guard let session = captureSession, let output = videoOutput else {
            let pos = currentPosition == .back ? "back" : "front"
            promise.resolve(["position": pos])
            return
        }

        let newPosition: AVCaptureDevice.Position = (currentPosition == .back) ? .front : .back

        guard let newDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: newPosition),
              let newInput = try? AVCaptureDeviceInput(device: newDevice) else {
            let pos = currentPosition == .back ? "back" : "front"
            NSLog("[ATHLTCamera] flipCamera: could not create input for new position")
            promise.resolve(["position": pos])
            return
        }

        session.beginConfiguration()

        // Remove all existing inputs
        for input in session.inputs {
            session.removeInput(input)
        }

        // Add new camera input
        if session.canAddInput(newInput) {
            session.addInput(newInput)
        }

        // Fix orientation + mirroring for new position
        if let conn = output.connection(with: .video) {
            if conn.isVideoOrientationSupported { conn.videoOrientation = .landscapeRight }
            if conn.isVideoMirroringSupported { conn.isVideoMirrored = (newPosition == .front) }
        }

        session.commitConfiguration()
        currentPosition = newPosition

        let posStr = newPosition == .front ? "front" : "back"
        NSLog("[ATHLTCamera] camera flipped to: %@", posStr)
        promise.resolve(["position": posStr])
    }

    // MARK: – loadModel ────────────────────────────────────────────────────────

    private func doLoadModel(promise: Promise) {
        NSLog("[ATHLTCamera] loadModel — scanning bundle")

        guard let url = Bundle.main.url(forResource: "best", withExtension: "mlmodelc")
                     ?? Bundle.main.url(forResource: "best", withExtension: "mlpackage") else {
            let found = (Bundle.main.urls(forResourcesWithExtension: "mlmodelc", subdirectory: nil) ?? [])
                .map { $0.lastPathComponent }.joined(separator: ", ")
            let msg = "best.mlmodelc not found. mlmodelc files present: [\(found)]"
            NSLog("[ATHLTCamera] %@", msg)
            promise.resolve(["loaded": false, "error": msg])
            return
        }

        let config = MLModelConfiguration()
        config.computeUnits = .all

        do {
            let mlModel = try MLModel(contentsOf: url, configuration: config)
            visionModel  = try VNCoreMLModel(for: mlModel)
            isModelLoaded = true
            NSLog("[ATHLTCamera] model loaded: %@", url.lastPathComponent)
            promise.resolve(["loaded": true, "modelName": url.lastPathComponent])
        } catch {
            NSLog("[ATHLTCamera] model load FAILED: %@", error.localizedDescription)
            promise.resolve(["loaded": false, "error": error.localizedDescription])
        }
    }

    // MARK: – Frame handling ───────────────────────────────────────────────────

    func handleSampleBuffer(_ buffer: CMSampleBuffer) {
        frameCounter += 1
        guard frameCounter % frameSkip == 0 else { return }
        guard currentMode != "idle", isModelLoaded, let model = visionModel else { return }
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(buffer) else { return }

        let ts = CMSampleBufferGetPresentationTimeStamp(buffer)
        let timestampSec: Double = ts.timescale > 0
            ? Double(ts.value) / Double(ts.timescale)
            : Date().timeIntervalSinceReferenceDate

        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        let capturedBuffer = pixelBuffer
        let capturedModel  = model
        let capturedTS     = timestampSec

        inferenceQueue.async { [weak self] in
            defer { CVPixelBufferUnlockBaseAddress(capturedBuffer, .readOnly) }
            self?.runInference(pixelBuffer: capturedBuffer, model: capturedModel, timestamp: capturedTS)
        }
    }

    // MARK: – CoreML inference ─────────────────────────────────────────────────

    private func runInference(pixelBuffer: CVPixelBuffer, model: VNCoreMLModel, timestamp: Double) {
        let request = VNCoreMLRequest(model: model)
        request.imageCropAndScaleOption = .scaleFit

        let handler = VNImageRequestHandler(
            cvPixelBuffer: pixelBuffer,
            orientation: .right,
            options: [:]
        )

        do {
            try handler.perform([request])
        } catch {
            NSLog("[ATHLTCamera] inference error: %@", error.localizedDescription)
            return
        }

        guard let observations = request.results as? [VNRecognizedObjectObservation] else {
            if let rawResults = request.results, !rawResults.isEmpty {
                NSLog("[ATHLTCamera] WARNING: model outputs %@, not VNRecognizedObjectObservation. Re-export with nms=True.",
                      String(describing: type(of: rawResults[0])))
            }
            return
        }

        processObservations(observations, timestamp: timestamp)
    }

    // MARK: – Dispatch by mode ─────────────────────────────────────────────────

    private func processObservations(_ observations: [VNRecognizedObjectObservation], timestamp: Double) {
        // FPS tracking (always — negligible overhead, used by diagnostic display)
        recentFrameTimestamps.append(timestamp)
        if recentFrameTimestamps.count > 10 { recentFrameTimestamps.removeFirst() }
        framesAnalyzed += 1

        // Diagnostic event: emits ANY detection so user can validate model output
        if diagnosticMode {
            emitDiagnosticEvent(observations)
        }

        if currentMode == "detection" {
            handleDetectionMode(observations, timestamp: timestamp)
            return
        }

        guard isTracking else { return }
        handleTrackingMode(observations, timestamp: timestamp)
    }

    // MARK: – FPS helper ───────────────────────────────────────────────────────

    private func computeFPS() -> Double {
        guard recentFrameTimestamps.count >= 2 else { return 0 }
        let elapsed = recentFrameTimestamps.last! - recentFrameTimestamps.first!
        guard elapsed > 0 else { return 0 }
        return Double(recentFrameTimestamps.count - 1) / elapsed
    }

    // MARK: – Diagnostic event ─────────────────────────────────────────────────

    private func emitDiagnosticEvent(_ observations: [VNRecognizedObjectObservation]) {
        let now = Date().timeIntervalSinceReferenceDate
        guard (now - lastDiagnosticEventTime) >= diagnosticEventThrottle else { return }
        lastDiagnosticEventTime = now

        // Find top detection across ALL classes (not filtered — shows what model sees)
        var topClass = "none"
        var topConf: Double = 0

        for obs in observations {
            if let top = obs.labels.first, Double(top.confidence) > topConf {
                topClass = top.identifier
                topConf = Double(top.confidence)
            }
        }

        sendEvent("onDetectionDebug", [
            "class":          topClass,
            "confidence":     topConf,
            "framesAnalyzed": framesAnalyzed,
            "fps":            computeFPS(),
        ])
    }

    // MARK: – Hoop detection (detection mode) ──────────────────────────────────

    private func handleDetectionMode(_ observations: [VNRecognizedObjectObservation], timestamp: Double) {
        let hoopConf: Float = 0.4
        var bestBasket: VNRecognizedObjectObservation? = nil
        var bestConf: Float = 0

        for obs in observations {
            guard let top = obs.labels.first else { continue }
            let name = top.identifier.lowercased()
            if (name == "basket" || name == "hoop" || name == "rim") && top.confidence >= hoopConf {
                if top.confidence > bestConf { bestBasket = obs; bestConf = top.confidence }
            }
        }

        guard let found = bestBasket else { return }

        let now = Date().timeIntervalSinceReferenceDate
        guard (now - lastHoopEventTime) >= hoopEventThrottle else { return }
        lastHoopEventTime = now

        let bb = found.boundingBox
        let jsX = Double(bb.origin.x)
        let jsY = Double(1.0 - bb.origin.y - bb.height)
        let jsW = Double(bb.width)
        let jsH = Double(bb.height)

        NSLog("[ATHLTCamera] hoop detected (conf=%.2f)", Double(bestConf))
        sendEvent("onHoopDetected", [
            "detected":   true,
            "confidence": Double(bestConf),
            "bbox": ["x": jsX, "y": jsY, "width": jsW, "height": jsH],
        ])
    }

    // MARK: – Shot detection (tracking mode) ──────────────────────────────────

    private func handleTrackingMode(_ observations: [VNRecognizedObjectObservation], timestamp: Double) {
        let minConf: Float = 0.35
        let makeConf: Float = 0.45

        var ball:         VNRecognizedObjectObservation?
        var basket:       VNRecognizedObjectObservation?
        var ballInBasket: VNRecognizedObjectObservation?

        for obs in observations {
            guard let top = obs.labels.first, top.confidence >= minConf else { continue }
            let name = top.identifier.lowercased()
            switch name {
            case "ball":
                if ball == nil || top.confidence > (ball?.labels.first?.confidence ?? 0) { ball = obs }
            case "basket":
                if basket == nil || top.confidence > (basket?.labels.first?.confidence ?? 0) { basket = obs }
            case "ball_in_basket":
                if top.confidence >= makeConf,
                   ballInBasket == nil || top.confidence > (ballInBasket?.labels.first?.confidence ?? 0) {
                    ballInBasket = obs
                }
            default: break
            }
        }

        if let b = basket { lastBasket = b.boundingBox }

        if let b = ball {
            let bb = b.boundingBox
            ballHistory.append(BallRecord(
                centerX: Double(bb.midX),
                centerY: Double(1.0 - bb.midY),
                timestamp: timestamp
            ))
            if ballHistory.count > maxBallHistory { ballHistory.removeFirst() }
        }

        guard (timestamp - lastShotTime) > shotCooldown else { return }

        if let bib = ballInBasket {
            let conf = Double(bib.labels.first?.confidence ?? 0.5)
            recordShot(type: "make", confidence: conf, bbox: bib.boundingBox, timestamp: timestamp)
            return
        }

        if let lastBasketBB = lastBasket, let ballObs = ball {
            let ballBB = ballObs.boundingBox
            let threshW = max(lastBasketBB.width * 2.0, 0.12)
            let threshH = max(lastBasketBB.height * 3.0, 0.15)
            let nearX = abs(ballBB.midX - lastBasketBB.midX) < threshW
            let nearY = abs(ballBB.midY - lastBasketBB.midY) < threshH

            if nearX && nearY {
                if ballNearBasketSince == 0 { ballNearBasketSince = timestamp }
                pendingMissDeadline = timestamp + 1.0
            } else {
                ballNearBasketSince = 0; pendingMissDeadline = 0
            }
        } else if ball == nil && pendingMissDeadline > 0 {
            if timestamp >= pendingMissDeadline
                && ballNearBasketSince > 0
                && (timestamp - ballNearBasketSince) >= missDetectionWindow {
                let bbox = lastBasket ?? CGRect(x: 0.45, y: 0.45, width: 0.1, height: 0.1)
                recordShot(type: "miss", confidence: 0.6, bbox: bbox, timestamp: timestamp)
            }
            if timestamp > pendingMissDeadline + 0.5 {
                ballNearBasketSince = 0; pendingMissDeadline = 0
            }
        }
    }

    // MARK: – Record shot ──────────────────────────────────────────────────────

    private func recordShot(type: String, confidence: Double, bbox: CGRect, timestamp: Double) {
        lastShotTime = timestamp
        ballHistory.removeAll()
        ballNearBasketSince = 0
        pendingMissDeadline = 0

        if type == "make" { makes += 1 }
        attempts += 1

        NSLog("[ATHLTCamera] %@ — %d/%d (conf=%.2f)", type, makes, attempts, confidence)

        let jsX = Double(bbox.origin.x)
        let jsY = Double(1.0 - bbox.origin.y - bbox.height)
        let jsW = Double(bbox.width)
        let jsH = Double(bbox.height)

        sendEvent("onShotDetected", [
            "type":       type,
            "confidence": confidence,
            "timestamp":  timestamp * 1000.0,
            "bbox": ["x": jsX, "y": jsY, "width": jsW, "height": jsH],
            "makes":    makes,
            "attempts": attempts,
        ])
    }
}
