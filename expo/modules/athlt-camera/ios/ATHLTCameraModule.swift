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
// Both ATHLTCameraModule and ATHLTCameraView are in the same pod but are separate
// classes. We share the AVCaptureSession via this singleton so the view can
// render the preview layer without needing a direct reference to the module.

final class ATHLTSessionHolder {
    static let shared = ATHLTSessionHolder()
    private(set) var session: AVCaptureSession?

    private init() {}

    func set(_ session: AVCaptureSession?) {
        self.session = session
        NotificationCenter.default.post(
            name: .athltSessionChanged,
            object: session
        )
    }
}

// ─── Ball position record for trajectory tracking ──────────────────────────────

private struct BallRecord {
    let centerX: Double  // normalized 0..1
    let centerY: Double  // normalized 0..1, origin top-left
    let timestamp: Double  // seconds since reference date
}

// ─── Capture delegate (separate NSObject so Module class stays pure Swift) ─────

private final class ATHLTCaptureDelegate: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    // Weak to avoid retain cycle: module → delegate → module
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
    private let sessionQueue = DispatchQueue(
        label: "com.athlt.camera.session",
        qos: .userInteractive
    )
    private let inferenceQueue = DispatchQueue(
        label: "com.athlt.camera.inference",
        qos: .userInteractive
    )

    private var captureSession: AVCaptureSession?
    private var videoOutput: AVCaptureVideoDataOutput?
    private var captureDelegate: ATHLTCaptureDelegate?

    // MARK: – CoreML
    private var visionModel: VNCoreMLModel?
    private var isModelLoaded = false

    // MARK: – Tracking state (all mutations on inferenceQueue)
    private var isTracking = false
    private var makes = 0
    private var attempts = 0

    // MARK: – Frame throttle: ~5fps from 30fps input
    private var frameCounter = 0
    private let frameSkip = 6      // process every 6th frame ≈ 5fps

    // MARK: – Shot detection state
    private var ballHistory: [BallRecord] = []
    private let maxBallHistory = 30  // ~6 seconds at 5fps

    private var lastBasket: CGRect?          // last known basket bbox (Vision coords: origin bottom-left)
    private var lastShotTime: Double = 0     // seconds
    private let shotCooldown: Double = 1.5

    // Miss detection: track how long ball has been near basket
    private var ballNearBasketSince: Double = 0
    private var pendingMissDeadline: Double = 0
    private let missDetectionWindow: Double = 0.8  // ball must be near basket this long before we wait for disappearance

    // MARK: – Module definition ─────────────────────────────────────────────────

    public func definition() -> ModuleDefinition {
        Name("ATHLTCamera")

        Events("onShotDetected", "onError", "onCameraState")

        // Native view. A Prop is required for ExpoModulesCore to generate
        // the Fabric (New Architecture) component descriptor during prebuild.
        // An empty View{} body is treated as a legacy-only view manager.
        View(ATHLTCameraView.self) {
            // Placeholder prop — session lifecycle is handled by ATHLTSessionHolder,
            // not by a React prop. This Prop exists solely so the Fabric codegen
            // generates a proper component descriptor for ATHLTCameraView.
            Prop("isActive") { (_: ATHLTCameraView, _: Bool) in }
        }

        // ── startSession ────────────────────────────────────────────────────────
        AsyncFunction("startSession") { (promise: Promise) in
            self.sessionQueue.async {
                self.doStartSession(promise: promise)
            }
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
            self.inferenceQueue.async {
                self.doLoadModel(promise: promise)
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
                NSLog("[ATHLTCamera] tracking started")
                promise.resolve()
            }
        }

        // ── stopTracking ─────────────────────────────────────────────────────────
        AsyncFunction("stopTracking") { (promise: Promise) in
            self.inferenceQueue.async {
                self.isTracking = false
                let m = self.makes
                let a = self.attempts
                let pct = a > 0 ? Int(round(Double(m) / Double(a) * 100)) : 0
                NSLog("[ATHLTCamera] tracking stopped — %d/%d (%.0f%%)", m, a, Double(pct))
                promise.resolve([
                    "makes":     m,
                    "attempts":  a,
                    "fgPercent": pct,
                ])
            }
        }

        // ── isModelLoaded (sync, for guards) ────────────────────────────────────
        Function("isModelLoaded") { () -> Bool in
            return self.isModelLoaded
        }
    }

    // MARK: – startSession implementation ──────────────────────────────────────

    private func doStartSession(promise: Promise) {
        let status = AVCaptureDevice.authorizationStatus(for: .video)

        switch status {
        case .authorized:
            configureSession(promise: promise)

        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                guard let self = self else { return }
                if granted {
                    self.sessionQueue.async { self.configureSession(promise: promise) }
                } else {
                    promise.resolve(["success": false, "error": "Camera permission denied by user"])
                }
            }

        case .denied, .restricted:
            promise.resolve([
                "success": false,
                "error": "Camera permission denied. Enable in iOS Settings → ATHLT → Camera."
            ])

        @unknown default:
            promise.resolve(["success": false, "error": "Unknown camera auth status"])
        }
    }

    private func configureSession(promise: Promise) {
        guard let device = AVCaptureDevice.default(
            .builtInWideAngleCamera, for: .video, position: .back
        ) else {
            promise.resolve(["success": false, "error": "No back camera found on this device"])
            return
        }

        let session = AVCaptureSession()
        session.beginConfiguration()
        session.sessionPreset = .hd1280x720   // 720p is plenty for YOLO inference

        // ── Input ──
        do {
            let input = try AVCaptureDeviceInput(device: device)
            guard session.canAddInput(input) else {
                promise.resolve(["success": false, "error": "Cannot add camera input to session"])
                return
            }
            session.addInput(input)
        } catch {
            promise.resolve(["success": false, "error": "Camera input error: \(error.localizedDescription)"])
            return
        }

        // ── Video data output ──
        let output = AVCaptureVideoDataOutput()
        output.videoSettings = [
            // BGRA is what Vision/CoreML prefer — no extra conversion step
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        // Drop frames we can't process in time — prevents memory pile-up
        output.alwaysDiscardsLateVideoFrames = true

        let delegate = ATHLTCaptureDelegate()
        delegate.module = self
        self.captureDelegate = delegate

        // Capture queue owns frame delivery; we dispatch inference to inferenceQueue
        output.setSampleBufferDelegate(delegate, queue: sessionQueue)

        guard session.canAddOutput(output) else {
            promise.resolve(["success": false, "error": "Cannot add video output to session"])
            return
        }
        session.addOutput(output)

        // ── Lock orientation to landscapeRight on the connection ──
        if let conn = output.connection(with: .video) {
            if conn.isVideoOrientationSupported {
                conn.videoOrientation = .landscapeRight
            }
            // Disable mirroring for back camera
            if conn.isVideoMirroringSupported {
                conn.isVideoMirrored = false
            }
        }

        session.commitConfiguration()

        self.captureSession = session
        self.videoOutput   = output

        // Broadcast session so ATHLTCameraView picks it up
        ATHLTSessionHolder.shared.set(session)

        session.startRunning()

        let running = session.isRunning
        NSLog("[ATHLTCamera] session configured, running: %@", running ? "YES" : "NO")
        promise.resolve(["success": running])
    }

    // MARK: – loadModel implementation ─────────────────────────────────────────

    private func doLoadModel(promise: Promise) {
        NSLog("[ATHLTCamera] loadModel — scanning bundle")

        // The withCoreMLModel plugin compiles best.mlpackage → best.mlmodelc during Xcode build
        guard let url = Bundle.main.url(forResource: "best", withExtension: "mlmodelc")
                     ?? Bundle.main.url(forResource: "best", withExtension: "mlpackage") else {

            let found = (Bundle.main.urls(forResourcesWithExtension: "mlmodelc", subdirectory: nil) ?? [])
                .map { $0.lastPathComponent }.joined(separator: ", ")
            let msg = "best.mlmodelc not found in app bundle. mlmodelc files present: [\(found)]"
            NSLog("[ATHLTCamera] %@", msg)
            promise.resolve(["loaded": false, "error": msg])
            return
        }

        NSLog("[ATHLTCamera] model URL: %@", url.path)

        let config = MLModelConfiguration()
        config.computeUnits = .all   // CPU + GPU + ANE

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

    // MARK: – Frame handling (called from captureDelegate on sessionQueue) ──────

    func handleSampleBuffer(_ buffer: CMSampleBuffer) {
        // Frame throttle
        frameCounter += 1
        guard frameCounter % frameSkip == 0 else { return }

        // Skip inference if not tracking or model not ready
        guard isTracking, isModelLoaded, let model = visionModel else { return }

        guard let pixelBuffer = CMSampleBufferGetImageBuffer(buffer) else { return }

        // Dispatch to dedicated inference queue — never run CoreML on the capture queue
        let ts = CMSampleBufferGetPresentationTimeStamp(buffer)
        let timestampSec: Double = ts.timescale > 0
            ? Double(ts.value) / Double(ts.timescale)
            : Date().timeIntervalSinceReferenceDate

        // Retain pixel buffer for async dispatch (CMSampleBuffer is not safe to
        // pass across queue boundaries without locking)
        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        let capturedBuffer = pixelBuffer
        let capturedModel  = model
        let capturedTS     = timestampSec

        inferenceQueue.async { [weak self] in
            defer { CVPixelBufferUnlockBaseAddress(capturedBuffer, .readOnly) }
            self?.runInference(
                pixelBuffer: capturedBuffer,
                model: capturedModel,
                timestamp: capturedTS
            )
        }
    }

    // MARK: – CoreML inference ──────────────────────────────────────────────────

    private func runInference(
        pixelBuffer: CVPixelBuffer,
        model: VNCoreMLModel,
        timestamp: Double
    ) {
        let request = VNCoreMLRequest(model: model)
        request.imageCropAndScaleOption = .scaleFit

        // orientation: .right — for a landscape-right locked camera, the raw
        // sensor buffer arrives in portrait orientation (height > width).
        // Telling Vision the image is rotated .right makes it appear landscape.
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
            // Model output raw tensors (no NMS baked in) — log and skip
            if let rawResults = request.results, !rawResults.isEmpty {
                NSLog("[ATHLTCamera] WARNING: model outputs %@, not VNRecognizedObjectObservation. Re-export with nms=True.",
                      String(describing: type(of: rawResults[0])))
            }
            return
        }

        processObservations(observations, timestamp: timestamp)
    }

    // MARK: – Shot detection state machine ─────────────────────────────────────

    private func processObservations(
        _ observations: [VNRecognizedObjectObservation],
        timestamp: Double
    ) {
        let minConf: Float = 0.35
        let makeConf: Float = 0.45   // higher bar for ball_in_basket

        // ── Classify detections ──
        var ball:         VNRecognizedObjectObservation?
        var basket:       VNRecognizedObjectObservation?
        var ballInBasket: VNRecognizedObjectObservation?

        for obs in observations {
            guard let top = obs.labels.first, top.confidence >= minConf else { continue }
            let name = top.identifier.lowercased()

            switch name {
            case "ball":
                // Keep highest-confidence ball
                if ball == nil || top.confidence > (ball?.labels.first?.confidence ?? 0) {
                    ball = obs
                }
            case "basket":
                if basket == nil || top.confidence > (basket?.labels.first?.confidence ?? 0) {
                    basket = obs
                }
            case "ball_in_basket":
                if top.confidence >= makeConf {
                    if ballInBasket == nil || top.confidence > (ballInBasket?.labels.first?.confidence ?? 0) {
                        ballInBasket = obs
                    }
                }
            default:
                break
            }
        }

        // Update basket position cache
        if let b = basket {
            lastBasket = b.boundingBox
        }

        // Update ball trajectory history
        if let b = ball {
            let bb = b.boundingBox
            // Vision bounding box: origin bottom-left. Convert to top-left for consistency.
            let record = BallRecord(
                centerX: Double(bb.midX),
                centerY: Double(1.0 - bb.midY),   // flip y to top-left
                timestamp: timestamp
            )
            ballHistory.append(record)
            if ballHistory.count > maxBallHistory { ballHistory.removeFirst() }
        }

        // ── Cooldown check ──
        guard (timestamp - lastShotTime) > shotCooldown else { return }

        // ── MAKE: ball_in_basket detected ──
        if let bib = ballInBasket {
            let conf = Double(bib.labels.first?.confidence ?? 0.5)
            recordShot(type: "make", confidence: conf, bbox: bib.boundingBox, timestamp: timestamp)
            return
        }

        // ── MISS heuristic ──
        // Ball near basket → ball disappears → no ball_in_basket → MISS
        if let lastBasketBB = lastBasket, let ballObs = ball {
            let ballBB = ballObs.boundingBox
            let basketCX = lastBasketBB.midX
            let basketCY = lastBasketBB.midY

            // Is ball within 2× basket width of basket center?
            let threshW = max(lastBasketBB.width * 2.0, 0.12)
            let threshH = max(lastBasketBB.height * 3.0, 0.15)
            let nearX = abs(ballBB.midX - basketCX) < threshW
            let nearY = abs(ballBB.midY - basketCY) < threshH

            if nearX && nearY {
                if ballNearBasketSince == 0 {
                    ballNearBasketSince = timestamp
                }
                // Set a deadline: if ball disappears within this window, it's a miss
                pendingMissDeadline = timestamp + 1.0
            } else {
                // Ball not near basket — cancel any pending miss
                ballNearBasketSince = 0
                pendingMissDeadline = 0
            }
        } else if ball == nil && pendingMissDeadline > 0 {
            // Ball is gone
            if timestamp >= pendingMissDeadline
                && ballNearBasketSince > 0
                && (timestamp - ballNearBasketSince) >= missDetectionWindow {
                // Ball was near basket long enough and then vanished → MISS
                let bbox = lastBasket ?? CGRect(x: 0.45, y: 0.45, width: 0.1, height: 0.1)
                recordShot(type: "miss", confidence: 0.6, bbox: bbox, timestamp: timestamp)
            }
            if timestamp > pendingMissDeadline + 0.5 {
                // Deadline passed with no ball — reset
                ballNearBasketSince = 0
                pendingMissDeadline = 0
            }
        }
    }

    // MARK: – Record shot + emit event ─────────────────────────────────────────

    private func recordShot(type: String, confidence: Double, bbox: CGRect, timestamp: Double) {
        lastShotTime = timestamp
        ballHistory.removeAll()
        ballNearBasketSince = 0
        pendingMissDeadline = 0

        if type == "make" {
            makes += 1
        }
        attempts += 1

        NSLog("[ATHLTCamera] %@ detected — %d/%d (conf=%.2f)", type, makes, attempts, confidence)

        // Vision bbox: origin bottom-left → convert to top-left for JS
        let jsX = Double(bbox.origin.x)
        let jsY = Double(1.0 - bbox.origin.y - bbox.height)
        let jsW = Double(bbox.width)
        let jsH = Double(bbox.height)

        sendEvent("onShotDetected", [
            "type":       type,
            "confidence": confidence,
            "timestamp":  timestamp * 1000.0,   // ms
            "bbox": ["x": jsX, "y": jsY, "width": jsW, "height": jsH],
            "makes":    makes,
            "attempts": attempts,
        ])
    }
}
