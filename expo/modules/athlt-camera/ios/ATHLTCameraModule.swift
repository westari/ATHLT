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

// ─── BallTrackingPipeline ──────────────────────────────────────────────────────
//
// Trajectory-based shot detection modeled on open-source basketball CV research
// (avishah3/AI-Basketball-Shot-Detection-Tracker, nitinhemaraj/Basketball-shot-detection).
//
// Core idea:
//   1. Lock the hoop bbox once during setup — never re-detect during a session.
//   2. Maintain a rolling 60-frame ball position buffer with data cleaning.
//   3. Detect shot-in-flight when ball rises above the hoop and is near its X.
//   4. Score the shot at the moment ball descends back to hoop-center Y:
//        • Use linear regression on the last 5 positions to predict exact X at crossing.
//        • MAKE if predicted/actual X lands inside the hoop bbox (±55% half-width).
//        • MISS otherwise.
//   5. Enforce a 2-second cooldown between scored shots.
//
// All coordinates in this class are top-left origin (y=0 at top, y=1 at bottom),
// the inverse of Vision's native bottom-left origin. Conversion happens in ingestBall()
// and lockHoop() at the boundary.

final class BallTrackingPipeline {

    // MARK: – Tuning constants
    private static let bufferMax      = 60      // frames at ~5fps → ~12s history
    private static let ageSeconds     = 4.0     // drop positions older than this
    private static let jumpThresh     = 0.28    // max Euclidean jump in normalized coords
    private static let minBallConf    = 0.25    // lowered: blurry balls get low conf; jump filter handles FP
    static let minHoopConf: Float = 0.30  // lowered: hoop detection threshold (internal for module access)
    private static let cooldownSec    = 2.0     // minimum seconds between scored shots
    private static let flightTimeout  = 2.5     // abort in-flight state after this long
    private static let makeTolerance  = 0.55    // X within hoopWidth * tolerance → MAKE

    // MARK: – Ball point (top-left normalized coords)
    struct BallPoint {
        let x: Double
        let y: Double
        let t: Double      // seconds since epoch
        let conf: Double
    }

    // MARK: – Hoop (locked once; top-left normalized)
    private(set) var hoop: CGRect?       = nil
    private(set) var hoopLocked: Bool    = false

    // MARK: – Ball position buffer
    private var buffer:   [BallPoint] = []
    private var prevBall: BallPoint?  = nil   // for jump-rejection

    /// Most-recent accepted ball position — exposed for debug stats.
    var latestBall: BallPoint? { buffer.last }

    // MARK: – Shot-in-flight state
    private(set) var inFlight: Bool   = false
    private var peakY:       Double = 1.0    // minimum y seen so far (y=0 at top)
    private var flightStart: Double = 0.0

    // MARK: – Counters (exposed for stopTracking return value)
    private(set) var makes:    Int = 0
    private(set) var attempts: Int = 0
    private var lastShotT: Double = 0.0

    // MARK: – Hoop locking ─────────────────────────────────────────────────────
    //
    // Convert Vision bbox (bottom-left origin) → top-left coords, then lock.
    // Once locked, hoop position is fixed for the session regardless of what
    // the model detects in subsequent frames — this prevents jitter.

    func lockHoop(visionBBox: CGRect) {
        guard !hoopLocked else { return }
        let x = Double(visionBBox.origin.x)
        let y = 1.0 - Double(visionBBox.origin.y) - Double(visionBBox.height)
        let w = Double(visionBBox.width)
        let h = Double(visionBBox.height)
        hoop = CGRect(x: x, y: y, width: w, height: h)
        hoopLocked = true
        NSLog("[BallTracking] hoop LOCKED (auto) — origin(%.3f,%.3f) size(%.3f×%.3f)", x, y, w, h)
    }

    // Set hoop from a manual tap on the camera preview.
    // Coordinates are top-left normalized (same convention used throughout the pipeline).
    // Overrides any previous auto-detected hoop — force-sets hoopLocked regardless of
    // prior state so the user can always correct a bad auto-detection.
    func setManualHoop(x: Double, y: Double, width: Double, height: Double) {
        hoop = CGRect(x: x, y: y, width: width, height: height)
        hoopLocked = true
        NSLog("[BallTracking] hoop LOCKED (manual) — origin(%.3f,%.3f) size(%.3f×%.3f)", x, y, width, height)
    }

    // MARK: – Session management ───────────────────────────────────────────────

    // Called on startTracking. Keeps hoop lock from detection mode.
    func resetSession() {
        buffer.removeAll()
        prevBall    = nil
        inFlight    = false
        peakY       = 1.0
        flightStart = 0.0
        makes       = 0
        attempts    = 0
        lastShotT   = 0.0
        NSLog("[BallTracking] session reset — hoop locked: %@", hoopLocked ? "YES" : "NO")
    }

    // Called on stopSession (full teardown). Clears everything including hoop.
    func resetAll() {
        resetSession()
        hoop       = nil
        hoopLocked = false
        NSLog("[BallTracking] full reset")
    }

    // MARK: – Primary update (call once per analyzed frame) ────────────────────
    //
    // Pass the best ball and basket VNRecognizedObjectObservation for this frame
    // (nil if the class wasn't detected). Returns a shot result if one was scored.

    func update(
        ball:      VNRecognizedObjectObservation?,
        basket:    VNRecognizedObjectObservation?,
        timestamp: Double
    ) -> (type: String, confidence: Double)? {

        // Auto-lock hoop from basket detections if not already locked.
        // Used as a fallback when user skips the detection-mode setup.
        if !hoopLocked, let b = basket, let top = b.labels.first,
           top.confidence >= Self.minHoopConf {
            lockHoop(visionBBox: b.boundingBox)
        }

        ingestBall(obs: ball, timestamp: timestamp)
        return evaluate(timestamp: timestamp)
    }

    // MARK: – Ball ingestion with data cleaning ────────────────────────────────

    private func ingestBall(obs: VNRecognizedObjectObservation?, timestamp: Double) {
        // Prune stale entries
        let cutoff = timestamp - Self.ageSeconds
        buffer.removeAll { $0.t < cutoff }

        guard let obs = obs,
              let top = obs.labels.first,
              Double(top.confidence) >= Self.minBallConf else { return }

        let bb = obs.boundingBox
        let x  = Double(bb.midX)
        let y  = 1.0 - Double(bb.midY)   // flip to top-left (y increases downward)

        // Jump rejection: Euclidean distance > threshold → likely a noisy false positive.
        if let prev = prevBall {
            let dist = (pow(x - prev.x, 2) + pow(y - prev.y, 2)).squareRoot()
            if dist > Self.jumpThresh {
                NSLog("[BallTracking] jump rejected: dist=%.3f", dist)
                return
            }
        }

        let pt = BallPoint(x: x, y: y, t: timestamp, conf: Double(top.confidence))
        buffer.append(pt)
        if buffer.count > Self.bufferMax {
            buffer.removeFirst(buffer.count - Self.bufferMax)
        }
        prevBall = pt
    }

    // MARK: – Shot evaluation ──────────────────────────────────────────────────

    private func evaluate(timestamp: Double) -> (type: String, confidence: Double)? {
        guard let hoop = hoop else { return nil }
        guard timestamp - lastShotT > Self.cooldownSec else { return nil }

        // Smoothed positions from the last 2 seconds
        let recent = buffer.filter { timestamp - $0.t < 2.0 }

        // Handle ball disappearance while in flight
        if inFlight && recent.isEmpty {
            let elapsed = timestamp - flightStart
            if elapsed > 0.5 {
                // Ball vanished while in flight near hoop — assume make
                let scored = resolveDisappearance(hoop: hoop, timestamp: timestamp)
                if scored != nil { return scored }
            }
            if elapsed > Self.flightTimeout { resetFlight() }
            return nil
        }

        guard recent.count >= 3 else {
            if inFlight && timestamp - flightStart > Self.flightTimeout { resetFlight() }
            return nil
        }

        // 3-frame moving average to smooth noise
        let smoothed = movingAverage(recent)
        guard let latest = smoothed.last else { return nil }

        let hoopTopY  = Double(hoop.minY)
        let hoopMidY  = Double(hoop.midY)
        let hoopMidX  = Double(hoop.midX)
        let hoopW     = Double(hoop.width)

        // ── Flight detection ──────────────────────────────────────────────────
        // Ball must be above hoop top AND within 1.5× hoop width of center.
        // Small y value = high on screen in top-left coords.
        let aboveHoop = latest.y < hoopTopY
        let nearHoopX = abs(latest.x - hoopMidX) < hoopW * 1.5

        if aboveHoop && nearHoopX && !inFlight {
            inFlight    = true
            peakY       = latest.y
            flightStart = timestamp
            NSLog("[BallTracking] FLIGHT START y=%.3f hoopTop=%.3f x=%.3f hoopX=%.3f",
                  latest.y, hoopTopY, latest.x, hoopMidX)
        }

        guard inFlight else { return nil }

        // Track highest point reached (smallest y in top-left coords)
        if latest.y < peakY { peakY = latest.y }

        // Timeout guard
        if timestamp - flightStart > Self.flightTimeout {
            NSLog("[BallTracking] flight timeout — aborting")
            resetFlight()
            return nil
        }

        // ── Scoring moment ────────────────────────────────────────────────────
        // Ball has descended back to hoop-center Y after having peaked above hoop top.
        // Condition: ball.y >= hoopMidY  AND  ball previously peaked above hoopTopY.
        if latest.y >= hoopMidY && peakY < hoopTopY {
            return scoreAtCrossing(smoothed: smoothed, hoop: hoop,
                                   hoopMidX: hoopMidX, hoopMidY: hoopMidY,
                                   hoopW: hoopW, timestamp: timestamp)
        }

        return nil
    }

    // ── Score when ball crosses hoop mid-Y ────────────────────────────────────

    private func scoreAtCrossing(
        smoothed: [BallPoint],
        hoop: CGRect,
        hoopMidX: Double,
        hoopMidY: Double,
        hoopW: Double,
        timestamp: Double
    ) -> (type: String, confidence: Double) {

        // Use linear regression over the last 5 smoothed positions to predict
        // the exact ball X when it crossed hoopMidY. This handles the case where
        // the ball moves faster than our ~5fps capture rate between frames.
        let pts = Array(smoothed.suffix(5))
        let crossX = predictXAtY(points: pts, targetY: hoopMidY)

        let inside   = abs(crossX - hoopMidX) <= hoopW * Self.makeTolerance
        let shotType = inside ? "make" : "miss"
        let shotConf = inside ? 0.80 : 0.72

        if inside { makes += 1 }
        attempts += 1
        lastShotT = timestamp
        resetFlight()

        NSLog("[BallTracking] %@ | crossX=%.3f hoopMidX=%.3f hoopW=%.3f inside=%@ | %d/%d",
              shotType.uppercased(), crossX, hoopMidX, hoopW,
              inside ? "YES" : "NO", makes, attempts)

        return (shotType, shotConf)
    }

    // ── Disappearance-based make detection ────────────────────────────────────
    // When ball vanishes near the hoop while in flight → likely dropped through.

    private func resolveDisappearance(hoop: CGRect, timestamp: Double) -> (type: String, confidence: Double)? {
        guard let lastKnown = buffer.last else { return nil }

        let hoopMidX = Double(hoop.midX)
        let hoopMaxY = Double(hoop.maxY)
        let hoopW    = Double(hoop.width)

        // Last known position must have been inside/near hoop bbox
        let nearX = abs(lastKnown.x - hoopMidX) < hoopW * 0.8
        let nearY = lastKnown.y < hoopMaxY + Double(hoop.height)

        guard nearX && nearY else {
            // Disappeared far from hoop — flight tracking was probably wrong; reset
            resetFlight()
            return nil
        }

        makes    += 1
        attempts += 1
        lastShotT = timestamp
        resetFlight()
        NSLog("[BallTracking] MAKE (ball disappeared near hoop) — %d/%d", makes, attempts)
        return ("make", 0.62)
    }

    // MARK: – 3-frame moving average ──────────────────────────────────────────

    private func movingAverage(_ pts: [BallPoint]) -> [BallPoint] {
        guard pts.count >= 3 else { return pts }
        var out: [BallPoint] = []
        for i in 0..<pts.count {
            let lo = max(0, i - 1)
            let hi = min(pts.count - 1, i + 1)
            let w  = Double(hi - lo + 1)
            var ax = 0.0, ay = 0.0, ac = 0.0
            for j in lo...hi { ax += pts[j].x; ay += pts[j].y; ac += pts[j].conf }
            out.append(BallPoint(x: ax/w, y: ay/w, t: pts[i].t, conf: ac/w))
        }
        return out
    }

    // MARK: – Linear regression — predict X at target Y ───────────────────────
    //
    // Fits independent linear models:
    //   y(t) = m_y · t + b_y
    //   x(t) = m_x · t + b_x
    //
    // Solves for t when y(t) = targetY, then evaluates x at that t.
    // This gives the predicted ball X position when it crosses the hoop mid-line.
    //
    // Returns the last known X as a fallback if regression is degenerate.

    private func predictXAtY(points: [BallPoint], targetY: Double) -> Double {
        let n = Double(points.count)
        guard n >= 2 else { return points.last?.x ?? 0.5 }

        var sumT  = 0.0, sumY = 0.0, sumX  = 0.0
        var sumTY = 0.0, sumTX = 0.0, sumT2 = 0.0

        for p in points {
            sumT  += p.t
            sumY  += p.y
            sumX  += p.x
            sumTY += p.t * p.y
            sumTX += p.t * p.x
            sumT2 += p.t * p.t
        }

        let denom = n * sumT2 - sumT * sumT
        guard abs(denom) > 1e-12 else { return points.last?.x ?? 0.5 }

        let mY = (n * sumTY - sumT * sumY) / denom
        let bY = (sumY - mY * sumT) / n

        let mX = (n * sumTX - sumT * sumX) / denom
        let bX = (sumX - mX * sumT) / n

        // Solve y(t) = targetY → t = (targetY - bY) / mY
        guard abs(mY) > 1e-12 else { return points.last?.x ?? 0.5 }
        let tCross = (targetY - bY) / mY

        // Clamp result to valid normalized range
        let predictedX = mX * tCross + bX
        return max(0.0, min(1.0, predictedX))
    }

    // MARK: – Helpers

    private func resetFlight() {
        inFlight    = false
        peakY       = 1.0
        flightStart = 0.0
    }
}

// ─── Capture delegate ──────────────────────────────────────────────────────────

private final class ATHLTCaptureDelegate: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    weak var module: ATHLTCameraModule?
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        module?.handleSampleBuffer(sampleBuffer)
    }
}

// ─── Main Expo Module ──────────────────────────────────────────────────────────

public class ATHLTCameraModule: Module {

    // MARK: – Session infrastructure
    private let sessionQueue   = DispatchQueue(label: "com.athlt.camera.session",   qos: .userInteractive)
    private let inferenceQueue = DispatchQueue(label: "com.athlt.camera.inference", qos: .userInteractive)

    private var captureSession:  AVCaptureSession?
    private var videoOutput:     AVCaptureVideoDataOutput?
    private var captureDelegate: ATHLTCaptureDelegate?

    // MARK: – Camera position
    private var currentPosition: AVCaptureDevice.Position = .back

    // MARK: – CoreML
    private var visionModel:   VNCoreMLModel?
    private var isModelLoaded = false

    // MARK: – Camera mode
    private var currentMode: String = "idle"   // "idle" | "detection" | "tracking"
    private var isTracking  = false

    // MARK: – Frame throttle (~5fps from 30fps input)
    private var frameCounter = 0
    private let frameSkip    = 6

    // MARK: – Shot detection pipeline
    private let pipeline = BallTrackingPipeline()

    // MARK: – Hoop detection throttle (detection mode)
    private var lastHoopEventTime: Double = 0
    private let hoopEventThrottle: Double = 0.5

    // MARK: – Diagnostic mode
    private var diagnosticMode          = false
    private var framesAnalyzed          = 0
    private var recentFrameTimestamps: [Double] = []
    private var lastDiagnosticEventTime: Double = 0
    private let diagnosticEventThrottle: Double = 0.25

    // MARK: – Debug stats (session-aggregate counters, reset on startTracking)
    private var totalBallDetections: Int   = 0
    private var totalHoopDetections: Int   = 0
    private var peakBallConfidence: Double = 0.0
    private var peakHoopConfidence: Double = 0.0
    private var lastDebugStatsTime: Double = 0.0
    private let debugStatsThrottle: Double = 1.0   // emit once per second

    // MARK: – Module definition ─────────────────────────────────────────────────

    public func definition() -> ModuleDefinition {
        Name("ATHLTCamera")

        Events("onShotDetected", "onError", "onCameraState", "onHoopDetected", "onDetectionDebug", "onDebugStats")

        View(ATHLTCameraView.self) {
            Prop("isActive") { (_: ATHLTCameraView, _: Bool) in }
        }

        AsyncFunction("startSession") { (promise: Promise) in
            self.sessionQueue.async { self.doStartSession(promise: promise) }
        }

        AsyncFunction("stopSession") { (promise: Promise) in
            self.sessionQueue.async {
                self.videoOutput?.setSampleBufferDelegate(nil, queue: nil)
                self.captureSession?.stopRunning()
                self.captureSession = nil
                self.videoOutput    = nil
                self.captureDelegate = nil
                ATHLTSessionHolder.shared.set(nil)
                // Full pipeline reset — hoop must be re-detected on next session
                self.inferenceQueue.async { self.pipeline.resetAll() }
                NSLog("[ATHLTCamera] session stopped")
                promise.resolve(["success": true])
            }
        }

        AsyncFunction("loadModel") { (promise: Promise) in
            self.inferenceQueue.async { self.doLoadModel(promise: promise) }
        }

        // ── setMode ─────────────────────────────────────────────────────────────
        AsyncFunction("setMode") { (mode: String, promise: Promise) in
            self.inferenceQueue.async {
                self.currentMode = mode
                NSLog("[ATHLTCamera] mode: %@", mode)
                promise.resolve()
            }
        }

        // ── setManualHoopRegion ──────────────────────────────────────────────────
        // Called when the user taps on the camera preview to manually mark the hoop.
        // x, y, width, height are top-left normalized coords (0..1 range).
        // Overrides any existing auto-detected hoop.
        AsyncFunction("setManualHoopRegion") { (x: Double, y: Double, width: Double, height: Double, promise: Promise) in
            self.inferenceQueue.async {
                self.pipeline.setManualHoop(x: x, y: y, width: width, height: height)
                promise.resolve()
            }
        }

        // ── flipCamera ───────────────────────────────────────────────────────────
        AsyncFunction("flipCamera") { (promise: Promise) in
            self.sessionQueue.async { self.doFlipCamera(promise: promise) }
        }

        // ── setDiagnosticMode ────────────────────────────────────────────────────
        AsyncFunction("setDiagnosticMode") { (enabled: Bool, promise: Promise) in
            self.inferenceQueue.async {
                self.diagnosticMode = enabled
                if !enabled { self.framesAnalyzed = 0; self.recentFrameTimestamps.removeAll() }
                NSLog("[ATHLTCamera] diagnostic: %@", enabled ? "ON" : "OFF")
                promise.resolve()
            }
        }

        // ── startTracking ────────────────────────────────────────────────────────
        // Resets counters and ball buffer but KEEPS the hoop lock from detection mode.
        AsyncFunction("startTracking") { (promise: Promise) in
            self.inferenceQueue.async {
                self.pipeline.resetSession()
                self.isTracking           = true
                self.currentMode          = "tracking"
                // Reset debug stat counters for this session
                self.totalBallDetections  = 0
                self.totalHoopDetections  = 0
                self.peakBallConfidence   = 0.0
                self.peakHoopConfidence   = 0.0
                self.lastDebugStatsTime   = 0.0
                NSLog("[ATHLTCamera] tracking started — hoop locked: %@",
                      self.pipeline.hoopLocked ? "YES" : "NO (will auto-detect)")
                promise.resolve()
            }
        }

        // ── stopTracking ─────────────────────────────────────────────────────────
        AsyncFunction("stopTracking") { (promise: Promise) in
            self.inferenceQueue.async {
                self.isTracking  = false
                self.currentMode = "idle"
                let m   = self.pipeline.makes
                let a   = self.pipeline.attempts
                let pct = a > 0 ? Int(round(Double(m) / Double(a) * 100)) : 0
                NSLog("[ATHLTCamera] tracking stopped — %d/%d (%d%%)", m, a, pct)
                promise.resolve(["makes": m, "attempts": a, "fgPercent": pct])
            }
        }

        Function("isModelLoaded") { () -> Bool in self.isModelLoaded }
    }

    // MARK: – startSession ─────────────────────────────────────────────────────

    private func doStartSession(promise: Promise) {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        switch status {
        case .authorized:
            configureSession(position: currentPosition, promise: promise)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                guard let self else { return }
                if granted { self.sessionQueue.async { self.configureSession(position: self.currentPosition, promise: promise) } }
                else { promise.resolve(["success": false, "error": "Camera permission denied"]) }
            }
        default:
            promise.resolve(["success": false, "error": "Camera permission denied. Enable in iOS Settings."])
        }
    }

    private func configureSession(position: AVCaptureDevice.Position, promise: Promise) {
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position) else {
            promise.resolve(["success": false, "error": "No camera found"])
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
            promise.resolve(["success": false, "error": "Input error: \(error.localizedDescription)"])
            return
        }

        let output = AVCaptureVideoDataOutput()
        output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        output.alwaysDiscardsLateVideoFrames = true

        let delegate = ATHLTCaptureDelegate()
        delegate.module = self
        captureDelegate = delegate
        output.setSampleBufferDelegate(delegate, queue: sessionQueue)

        guard session.canAddOutput(output) else {
            promise.resolve(["success": false, "error": "Cannot add video output"])
            return
        }
        session.addOutput(output)

        if let conn = output.connection(with: .video) {
            if conn.isVideoOrientationSupported  { conn.videoOrientation = .landscapeRight }
            if conn.isVideoMirroringSupported    { conn.isVideoMirrored  = (position == .front) }
        }

        session.commitConfiguration()
        captureSession = session
        videoOutput    = output
        ATHLTSessionHolder.shared.set(session)
        session.startRunning()

        NSLog("[ATHLTCamera] session configured (%@), running: %@",
              position == .front ? "front" : "back", session.isRunning ? "YES" : "NO")
        promise.resolve(["success": session.isRunning])
    }

    // MARK: – flipCamera ───────────────────────────────────────────────────────

    private func doFlipCamera(promise: Promise) {
        guard let session = captureSession, let output = videoOutput else {
            promise.resolve(["position": currentPosition == .back ? "back" : "front"])
            return
        }

        let newPos: AVCaptureDevice.Position = (currentPosition == .back) ? .front : .back
        guard let newDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: newPos),
              let newInput  = try? AVCaptureDeviceInput(device: newDevice) else {
            promise.resolve(["position": currentPosition == .back ? "back" : "front"])
            return
        }

        session.beginConfiguration()
        for input in session.inputs { session.removeInput(input) }
        if session.canAddInput(newInput) { session.addInput(newInput) }
        if let conn = output.connection(with: .video) {
            if conn.isVideoOrientationSupported { conn.videoOrientation = .landscapeRight }
            if conn.isVideoMirroringSupported   { conn.isVideoMirrored  = (newPos == .front) }
        }
        session.commitConfiguration()
        currentPosition = newPos

        let posStr = newPos == .front ? "front" : "back"
        NSLog("[ATHLTCamera] camera flipped → %@", posStr)
        promise.resolve(["position": posStr])
    }

    // MARK: – loadModel ────────────────────────────────────────────────────────

    private func doLoadModel(promise: Promise) {
        guard let url = Bundle.main.url(forResource: "best", withExtension: "mlmodelc")
                     ?? Bundle.main.url(forResource: "best", withExtension: "mlpackage") else {
            let found = (Bundle.main.urls(forResourcesWithExtension: "mlmodelc", subdirectory: nil) ?? [])
                .map { $0.lastPathComponent }.joined(separator: ", ")
            let msg = "best.mlmodelc not found. Present: [\(found)]"
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
            NSLog("[ATHLTCamera] model FAILED: %@", error.localizedDescription)
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
        let cap = pixelBuffer
        let mod = model
        let t   = timestampSec

        inferenceQueue.async { [weak self] in
            defer { CVPixelBufferUnlockBaseAddress(cap, .readOnly) }
            self?.runInference(pixelBuffer: cap, model: mod, timestamp: t)
        }
    }

    // MARK: – CoreML inference ─────────────────────────────────────────────────

    private func runInference(pixelBuffer: CVPixelBuffer, model: VNCoreMLModel, timestamp: Double) {
        let request = VNCoreMLRequest(model: model)
        request.imageCropAndScaleOption = .scaleFit

        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .right, options: [:])
        do {
            try handler.perform([request])
        } catch {
            NSLog("[ATHLTCamera] inference error: %@", error.localizedDescription)
            return
        }

        guard let observations = request.results as? [VNRecognizedObjectObservation] else {
            if let raw = request.results, !raw.isEmpty {
                NSLog("[ATHLTCamera] WARNING: model returns %@, not VNRecognizedObjectObservation. Re-export with nms=True.",
                      String(describing: type(of: raw[0])))
            }
            return
        }

        processObservations(observations, timestamp: timestamp)
    }

    // MARK: – Mode dispatch ────────────────────────────────────────────────────

    private func processObservations(_ observations: [VNRecognizedObjectObservation], timestamp: Double) {
        // FPS tracking (always on)
        recentFrameTimestamps.append(timestamp)
        if recentFrameTimestamps.count > 10 { recentFrameTimestamps.removeFirst() }
        framesAnalyzed += 1

        // Count ALL detections before any threshold filtering so debug stats
        // show what the model actually sees, even low-confidence outputs.
        for obs in observations {
            guard let top = obs.labels.first else { continue }
            let name = top.identifier.lowercased()
            let conf = Double(top.confidence)
            if name == "ball" {
                totalBallDetections += 1
                if conf > peakBallConfidence { peakBallConfidence = conf }
            } else if name == "basket" || name == "hoop" || name == "rim" {
                totalHoopDetections += 1
                if conf > peakHoopConfidence { peakHoopConfidence = conf }
            }
        }

        if diagnosticMode { emitDiagnosticEvent(observations) }

        // Emit debug stats once per second while tracking (JS debug panel reads these)
        if isTracking {
            let now = Date().timeIntervalSinceReferenceDate
            if now - lastDebugStatsTime >= debugStatsThrottle {
                lastDebugStatsTime = now
                emitDebugStats()
            }
        }

        switch currentMode {
        case "detection": handleDetectionMode(observations, timestamp: timestamp)
        case "tracking":  handleTrackingMode(observations, timestamp: timestamp)
        default: break
        }
    }

    // MARK: – Hoop detection (detection mode) ──────────────────────────────────
    //
    // Finds the basket/hoop/rim class, locks it on the pipeline, and emits
    // onHoopDetected for the JS overlay. Once locked, emits continue for UI
    // feedback even though the pipeline ignores them.

    private func handleDetectionMode(_ observations: [VNRecognizedObjectObservation], timestamp: Double) {
        let minConf: Float = 0.30   // lowered to match minHoopConf lock threshold
        var bestBasket: VNRecognizedObjectObservation?
        var bestConf:   Float = 0

        for obs in observations {
            guard let top = obs.labels.first else { continue }
            let name = top.identifier.lowercased()
            if (name == "basket" || name == "hoop" || name == "rim") && top.confidence >= minConf {
                if top.confidence > bestConf { bestBasket = obs; bestConf = top.confidence }
            }
        }

        guard let found = bestBasket else { return }

        // Lock hoop on pipeline when confidence is high enough
        if !pipeline.hoopLocked, bestConf >= BallTrackingPipeline.minHoopConf {
            pipeline.lockHoop(visionBBox: found.boundingBox)
        }

        // Throttle onHoopDetected events
        let now = Date().timeIntervalSinceReferenceDate
        guard (now - lastHoopEventTime) >= hoopEventThrottle else { return }
        lastHoopEventTime = now

        let bb  = found.boundingBox
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

    // MARK: – Shot tracking (tracking mode) ────────────────────────────────────
    //
    // Classifies detections into ball / basket, feeds them to the BallTrackingPipeline,
    // and emits onShotDetected if the pipeline determines a shot was scored.
    // Note: ball_in_basket class is no longer relied upon — the pipeline determines
    // makes/misses from trajectory intersection with the locked hoop region.

    private func handleTrackingMode(_ observations: [VNRecognizedObjectObservation], timestamp: Double) {
        let minConf: Float = 0.30
        var ball:   VNRecognizedObjectObservation?
        var basket: VNRecognizedObjectObservation?

        for obs in observations {
            guard let top = obs.labels.first, top.confidence >= minConf else { continue }
            switch top.identifier.lowercased() {
            case "ball":
                if ball == nil || top.confidence > (ball?.labels.first?.confidence ?? 0) { ball = obs }
            case "basket", "hoop", "rim":
                if basket == nil || top.confidence > (basket?.labels.first?.confidence ?? 0) { basket = obs }
            default: break
            }
        }

        // Feed to pipeline — ball may be nil (no detection this frame)
        if let result = pipeline.update(ball: ball, basket: basket, timestamp: timestamp) {
            emitShotEvent(type: result.type, confidence: result.confidence, timestamp: timestamp)
        }
    }

    // MARK: – Shot event emission ──────────────────────────────────────────────

    private func emitShotEvent(type: String, confidence: Double, timestamp: Double) {
        let bbox = pipeline.hoop ?? CGRect(x: 0.45, y: 0.45, width: 0.1, height: 0.1)

        NSLog("[ATHLTCamera] SHOT %@ — %d/%d (conf=%.2f)",
              type.uppercased(), pipeline.makes, pipeline.attempts, confidence)

        sendEvent("onShotDetected", [
            "type":       type,
            "confidence": confidence,
            "timestamp":  timestamp * 1000.0,
            "bbox": [
                "x":      Double(bbox.origin.x),
                "y":      Double(bbox.origin.y),
                "width":  Double(bbox.width),
                "height": Double(bbox.height),
            ],
            "makes":    pipeline.makes,
            "attempts": pipeline.attempts,
        ])
    }

    // MARK: – Debug stats event ────────────────────────────────────────────────
    //
    // Emitted once per second during tracking so the JS debug panel can show
    // real-time counters without the user needing Xcode logs.

    private func emitDebugStats() {
        let h      = pipeline.hoop
        let latest = pipeline.latestBall

        sendEvent("onDebugStats", [
            "totalBallDetections": totalBallDetections,
            "totalHoopDetections": totalHoopDetections,
            "peakBallConf":  peakBallConfidence,
            "peakHoopConf":  peakHoopConfidence,
            "ballX":         latest?.x ?? -1.0,
            "ballY":         latest?.y ?? -1.0,
            "hoopLocked":    pipeline.hoopLocked,
            "hoopX":         Double(h?.midX ?? -1),
            "hoopY":         Double(h?.midY ?? -1),
            "hoopW":         Double(h?.width  ?? 0),
            "hoopH":         Double(h?.height ?? 0),
            "inFlight":      pipeline.inFlight,
            "makes":         pipeline.makes,
            "attempts":      pipeline.attempts,
        ])
    }

    // MARK: – Diagnostic event ─────────────────────────────────────────────────

    private func emitDiagnosticEvent(_ observations: [VNRecognizedObjectObservation]) {
        let now = Date().timeIntervalSinceReferenceDate
        guard (now - lastDiagnosticEventTime) >= diagnosticEventThrottle else { return }
        lastDiagnosticEventTime = now

        var topClass = "none"
        var topConf: Double = 0
        for obs in observations {
            if let top = obs.labels.first, Double(top.confidence) > topConf {
                topClass = top.identifier
                topConf  = Double(top.confidence)
            }
        }

        let fps: Double
        if recentFrameTimestamps.count >= 2 {
            let elapsed = recentFrameTimestamps.last! - recentFrameTimestamps.first!
            fps = elapsed > 0 ? Double(recentFrameTimestamps.count - 1) / elapsed : 0
        } else { fps = 0 }

        sendEvent("onDetectionDebug", [
            "class":          topClass,
            "confidence":     topConf,
            "framesAnalyzed": framesAnalyzed,
            "fps":            fps,
        ])
    }
}

