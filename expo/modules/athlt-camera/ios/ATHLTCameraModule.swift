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

// ─── HoopTracker ──────────────────────────────────────────────────────────────
//
// Owns the hoop bounding box for a session. Accumulates evidence before locking
// (avoids locking onto the wrong object), then applies EMA smoothing after locking
// to handle slow camera drift. Detects camera repositioning and re-locks to the
// new position. Manual tap always overrides automatic detection.
//
// All stored geometry uses top-left origin (y=0 top, y=1 bottom).
// Vision observations arrive in bottom-left origin — toTopLeft() converts at ingestion.

final class HoopTracker {

    // MARK: – Tuning constants (all magic numbers live here, documented)

    /// Min confidence per frame to count toward the lock accumulation window.
    /// Lower = locks faster but risks locking on a wrong object. 0.35 is conservative.
    static let lockConfThreshold: Float = 0.35

    /// Number of consecutive high-confidence frames at a stable position required
    /// before committing the lock. Prevents single-frame false positives.
    static let lockConsecutiveRequired: Int = 5

    /// EMA smoothing factor applied to hoop position after lock.
    /// 0.10 = new detections contribute 10% each frame → very stable against jitter.
    /// Increase toward 0.25 if the phone moves frequently and lock drifts too slowly.
    static let emaAlpha: Double = 0.10

    /// Frames without a valid hoop detection before the lock is marked "stale".
    /// Stale = keep using last known position, but flag it for the debug panel.
    static let staleFrameThreshold: Int = 30

    /// If the hoop is consistently detected this far (normalized) from the locked
    /// position, the camera was repositioned — trigger a re-lock.
    static let relockDistanceThreshold: Double = 0.20

    /// Consecutive frames with a far-away detection needed to trigger re-lock.
    /// Prevents a single bad detection frame from wiping the lock.
    static let relockConsecutiveRequired: Int = 8

    /// Max center displacement (normalized) between consecutive accumulation frames.
    /// If the candidate position jumps beyond this, restart the accumulation window.
    static let candidateJumpThreshold: Double = 0.12

    // MARK: – Geometry (top-left origin, normalized 0..1)

    struct HoopGeometry {
        var center:     CGPoint  // midpoint of the hoop bbox
        var bbox:       CGRect   // full bounding box
        var rimLineY:   Double   // Y of the rim opening (top edge of bbox; ball crosses this line)
        var rimMinX:    Double   // left edge of the rim opening
        var rimMaxX:    Double   // right edge of the rim opening
        var rimCenterX: Double   // horizontal midpoint of the rim
        var rimWidth:   Double   // width of the rim opening (used for make tolerance math)
    }

    // MARK: – Public state

    private(set) var geometry:  HoopGeometry? = nil
    private(set) var isLocked:  Bool = false
    private(set) var isStale:   Bool = false   // locked but camera may have drifted away
    private(set) var isManual:  Bool = false   // true when locked via user tap

    /// 0.0–1.0 progress toward initial lock (for UI loading indicator).
    var lockProgress: Double {
        guard !isLocked else { return 1.0 }
        guard Self.lockConsecutiveRequired > 0 else { return 0.0 }
        return Double(candidateFrames) / Double(Self.lockConsecutiveRequired)
    }

    // MARK: – Private accumulation state

    private var candidateFrames:    Int     = 0
    private var candidateSumX:      Double  = 0
    private var candidateSumY:      Double  = 0
    private var candidateSumW:      Double  = 0
    private var candidateSumH:      Double  = 0
    private var lastCandidateMidX:  Double? = nil
    private var lastCandidateMidY:  Double? = nil

    // MARK: – Private post-lock maintenance state

    private var framesSinceDetection: Int = 0
    private var relockFrames:          Int = 0

    // MARK: – Ingestion ────────────────────────────────────────────────────────
    //
    // Call once per analyzed frame. Pass the best basket/hoop VNRecognizedObjectObservation
    // (nil if none was detected or confidence was below caller's pre-filter threshold).
    // visionBBox is in Vision coordinates (bottom-left origin, normalized 0..1).

    func ingest(visionBBox: CGRect?, confidence: Float) {
        guard !isManual else { return }   // manual lock is immutable until resetAll()

        if isLocked {
            handlePostLockUpdate(visionBBox: visionBBox, confidence: confidence)
        } else {
            handleAccumulation(visionBBox: visionBBox, confidence: confidence)
        }
    }

    // MARK: – Manual lock ──────────────────────────────────────────────────────
    //
    // Called when the user taps the camera preview to mark the hoop.
    // Coordinates are top-left normalized — the caller converts from screen pixels.
    // Overrides any in-progress accumulation or existing auto lock immediately.

    func setManual(x: Double, y: Double, width: Double, height: Double) {
        let bbox = CGRect(x: x, y: y, width: width, height: height)
        geometry = makeGeometry(from: bbox)
        isLocked = true
        isManual = true
        isStale  = false
        framesSinceDetection = 0
        relockFrames = 0
        resetAccumulation()
        NSLog("[HoopTracker] LOCKED (manual) center=(%.3f,%.3f) rim=(%.3f–%.3f @ y=%.3f)",
              x + width / 2, y + height / 2, x, x + width, y)
    }

    // MARK: – Session management ───────────────────────────────────────────────

    /// Called on startTracking. Keeps hoop lock across detection→tracking transition.
    func resetSession() {
        framesSinceDetection = 0
        relockFrames = 0
        isStale = false
        // geometry, isLocked, isManual intentionally preserved
    }

    /// Called on stopSession. Wipes everything including the lock.
    func resetAll() {
        geometry     = nil
        isLocked     = false
        isStale      = false
        isManual     = false
        framesSinceDetection = 0
        relockFrames = 0
        resetAccumulation()
        NSLog("[HoopTracker] full reset")
    }

    // MARK: – Pre-lock: accumulation ───────────────────────────────────────────

    private func handleAccumulation(visionBBox: CGRect?, confidence: Float) {
        guard let bb = visionBBox, confidence >= Self.lockConfThreshold else {
            if candidateFrames > 0 {
                NSLog("[HoopTracker] accumulation reset (no detection / conf %.2f < %.2f)", confidence, Self.lockConfThreshold)
                resetAccumulation()
            }
            return
        }

        let tl   = toTopLeft(visionBBox: bb)
        let midX = Double(tl.midX)
        let midY = Double(tl.midY)

        // Reject if candidate position jumped significantly (probably a different object).
        if let lastX = lastCandidateMidX, let lastY = lastCandidateMidY {
            let dx = abs(midX - lastX)
            let dy = abs(midY - lastY)
            if dx > Self.candidateJumpThreshold || dy > Self.candidateJumpThreshold {
                NSLog("[HoopTracker] accumulation reset (position jump dx=%.3f dy=%.3f)", dx, dy)
                resetAccumulation()
                // Count this frame as the new start (don't waste it)
                candidateFrames   = 1
                candidateSumX     = midX;  candidateSumY = midY
                candidateSumW     = Double(tl.width);  candidateSumH = Double(tl.height)
                lastCandidateMidX = midX;  lastCandidateMidY = midY
                return
            }
        }

        candidateFrames   += 1
        candidateSumX     += midX
        candidateSumY     += midY
        candidateSumW     += Double(tl.width)
        candidateSumH     += Double(tl.height)
        lastCandidateMidX  = midX
        lastCandidateMidY  = midY

        NSLog("[HoopTracker] accumulating %d/%d (conf=%.2f pos=%.3f,%.3f)",
              candidateFrames, Self.lockConsecutiveRequired, confidence, midX, midY)

        guard candidateFrames >= Self.lockConsecutiveRequired else { return }

        // Average all accumulated positions for a stable initial lock.
        let n    = Double(candidateFrames)
        let avgX = candidateSumX / n
        let avgY = candidateSumY / n
        let avgW = candidateSumW / n
        let avgH = candidateSumH / n
        let avgBBox = CGRect(x: avgX - avgW / 2, y: avgY - avgH / 2, width: avgW, height: avgH)

        geometry             = makeGeometry(from: avgBBox)
        isLocked             = true
        isStale              = false
        framesSinceDetection = 0
        resetAccumulation()

        if let g = geometry {
            NSLog("[HoopTracker] LOCKED (auto, %d-frame avg) center=(%.3f,%.3f) rim=(%.3f–%.3f @ y=%.3f)",
                  Int(n), Double(g.center.x), Double(g.center.y), g.rimMinX, g.rimMaxX, g.rimLineY)
        }
    }

    // MARK: – Post-lock: EMA smoothing + drift detection + re-lock ─────────────

    private func handlePostLockUpdate(visionBBox: CGRect?, confidence: Float) {
        guard var g = geometry else { return }

        guard let bb = visionBBox, confidence >= Self.lockConfThreshold else {
            framesSinceDetection += 1
            if framesSinceDetection >= Self.staleFrameThreshold && !isStale {
                isStale = true
                NSLog("[HoopTracker] STALE — no detection for %d frames (using last known position)",
                      framesSinceDetection)
            }
            relockFrames = 0  // no competing candidate visible; don't count toward re-lock
            return
        }

        // Hoop re-appeared (or continued being detected).
        framesSinceDetection = 0
        if isStale {
            isStale = false
            NSLog("[HoopTracker] RECOVERED — hoop re-detected")
        }

        let tl      = toTopLeft(visionBBox: bb)
        let newMidX = Double(tl.midX)
        let newMidY = Double(tl.midY)
        let locX    = Double(g.center.x)
        let locY    = Double(g.center.y)
        let dist    = ((newMidX - locX) * (newMidX - locX) + (newMidY - locY) * (newMidY - locY)).squareRoot()

        if dist > Self.relockDistanceThreshold {
            relockFrames += 1
            NSLog("[HoopTracker] far detection dist=%.3f (%d/%d for re-lock)",
                  dist, relockFrames, Self.relockConsecutiveRequired)

            if relockFrames >= Self.relockConsecutiveRequired {
                // Camera repositioned — re-lock to new hoop position.
                NSLog("[HoopTracker] RE-LOCK triggered — camera repositioned")
                isLocked  = false
                isStale   = false
                isManual  = false
                geometry  = nil
                relockFrames = 0
                resetAccumulation()
                handleAccumulation(visionBBox: bb, confidence: confidence)
            }
            return  // Don't apply EMA until we decide whether to re-lock
        }

        // Nearby detection — apply EMA to smooth the locked position.
        relockFrames = 0
        let a = Self.emaAlpha
        let sX = Double(g.bbox.origin.x) * (1 - a) + Double(tl.origin.x) * a
        let sY = Double(g.bbox.origin.y) * (1 - a) + Double(tl.origin.y) * a
        let sW = Double(g.bbox.width)    * (1 - a) + Double(tl.width)    * a
        let sH = Double(g.bbox.height)   * (1 - a) + Double(tl.height)   * a
        geometry = makeGeometry(from: CGRect(x: sX, y: sY, width: sW, height: sH))
    }

    // MARK: – Coordinate conversion ────────────────────────────────────────────

    private func toTopLeft(visionBBox bb: CGRect) -> CGRect {
        CGRect(
            x:      Double(bb.origin.x),
            y:      1.0 - Double(bb.origin.y) - Double(bb.height),
            width:  Double(bb.width),
            height: Double(bb.height)
        )
    }

    // Derives full HoopGeometry from a top-left-origin bbox.
    // The rim opening is the TOP edge of the bbox — where the ball enters the hoop.
    private func makeGeometry(from tl: CGRect) -> HoopGeometry {
        HoopGeometry(
            center:     CGPoint(x: tl.midX, y: tl.midY),
            bbox:       tl,
            rimLineY:   Double(tl.minY),
            rimMinX:    Double(tl.minX),
            rimMaxX:    Double(tl.maxX),
            rimCenterX: Double(tl.midX),
            rimWidth:   Double(tl.width)
        )
    }

    private func resetAccumulation() {
        candidateFrames   = 0
        candidateSumX     = 0
        candidateSumY     = 0
        candidateSumW     = 0
        candidateSumH     = 0
        lastCandidateMidX = nil
        lastCandidateMidY = nil
    }
}

// ─── BallTracker ──────────────────────────────────────────────────────────────
//
// Owns the ball position buffer for a tracking session. Handles entry persistence
// (prevents false-positive tracks from single-frame detections), jump rejection
// (prevents teleporting ball positions from polluting the buffer), track death
// (cleans up when ball is genuinely lost), velocity tracking, size tracking,
// and the math helpers (regression, R²) used by the scoring paths.
//
// All stored positions use top-left origin (y=0 top, y=1 bottom).
// Vision observations are in bottom-left origin — conversion happens at ingest().

final class BallTracker {

    // MARK: – Tuning constants

    /// Confidence required during the entry persistence window (pre-track).
    /// Higher bar catches false positives early — a jersey number needs 3 clean
    /// high-confidence frames to start a track; a real ball gets that easily.
    static let entryConfidence: Double = 0.40

    /// Confidence required once a track is established (mid-flight).
    /// Lower than entry because motion blur and partial occlusion reduce model
    /// confidence on a real fast-moving ball. Jump filter handles residual FP.
    static let trackConfidence: Double = 0.25

    /// Consecutive frames at entryConfidence needed to start a track (legacy — kept for the
    /// scoringState string; actual gate now uses the 2-of-3 sliding window below).
    static let entryConsecutiveRequired: Int = 2

    /// Single-frame confidence threshold for immediate track establishment.
    /// A very high-confidence single detection can bypass the 2-of-3 window so that a ball
    /// visible for only 1–2 frames (fast release near the rim) still starts a track.
    static let highConfEntryThreshold: Double = 0.60

    /// Max normalized Euclidean distance between consecutive ball positions.
    /// A ball at full court speed covers ~0.20 of frame width per 100ms.
    /// 0.35 gives generous headroom while still blocking teleporting detections.
    static let jumpThreshold: Double = 0.35

    /// Relaxed jump threshold used when ball was lost for lostFramesForRelaxedJump+ frames.
    /// Ball may have genuinely moved far while untracked (fast shot, camera pan).
    /// Still bounded to prevent completely random re-acquisition.
    static let reacquireJumpThreshold: Double = 0.55

    /// If ball has been lost for this many frames, switch to relaxed jump threshold
    /// to allow re-acquisition after a gap. Still tight enough to filter noise.
    static let lostFramesForRelaxedJump: Int = 4

    /// If ball is missing for this many frames, kill the track (clear tracking state).
    /// At ~10fps: 12 frames ≈ 1.2s. Any real in-flight shot resolves well within this.
    static let trackDeathFrames: Int = 12

    /// Rolling buffer capacity. At ~10fps, 90 frames ≈ 9s of position history.
    /// Large enough to capture full arc from release to landing.
    static let bufferMax: Int = 90

    /// Drop buffer entries older than this many seconds regardless of count.
    static let ageSeconds: Double = 5.0

    /// Number of recent buffer frames used for velocity computation.
    /// Small window → more responsive to direction changes during flight.
    static let velocityWindowFrames: Int = 5

    // MARK: – Data types

    struct BallPoint {
        let x:     Double   // center X (top-left normalized)
        let y:     Double   // center Y (top-left normalized)
        let t:     Double   // presentation timestamp in seconds
        let conf:  Double   // model confidence 0..1
        let bboxW: Double   // bbox width  (for size trend)
        let bboxH: Double   // bbox height (for size trend)
    }

    struct Velocity {
        let dx:    Double   // normalized units/second; positive = moving right
        let dy:    Double   // normalized units/second; positive = moving down (top-left coords)
        let speed: Double   // magnitude = hypot(dx, dy)

        static let zero = Velocity(dx: 0, dy: 0, speed: 0)

        /// True when the ball is moving upward (negative dy in top-left = rising).
        var isRising: Bool  { dy < -0.05 }   // 0.05 dead zone filters hover noise
        /// True when the ball is moving downward.
        var isFalling: Bool { dy >  0.05 }
        /// True if velocity is large enough to be a real moving ball (not noise).
        var isSignificant: Bool { speed > 0.10 }
    }

    // MARK: – Public state

    private(set) var buffer:        [BallPoint] = []
    private(set) var isEstablished: Bool        = false
    private(set) var framesLost:    Int         = 0
    private(set) var velocity:      Velocity    = .zero

    /// The most recent accepted raw ball position.
    var latestBall: BallPoint? { buffer.last }

    // MARK: – Private state

    private var consecutiveFrames: Int       = 0   // kept for legacy NSLog only
    private var recentGateFrames: [Bool]     = []   // sliding 3-frame window for 2-of-3 gate
    private var prevBall:         BallPoint? = nil   // for jump check and prevBall during gate

    // MARK: – Ingestion ────────────────────────────────────────────────────────
    //
    // Call once per analyzed frame. obs = best ball-class VNRecognizedObjectObservation,
    // or nil if no ball was detected. Returns true if a position was accepted into buffer.

    @discardableResult
    func ingest(obs: VNRecognizedObjectObservation?, timestamp: Double) -> Bool {
        // Prune stale entries before anything else.
        let cutoff = timestamp - Self.ageSeconds
        buffer.removeAll { $0.t < cutoff }

        guard let obs = obs, let top = obs.labels.first else {
            handleMissedFrame(timestamp: timestamp)
            return false
        }

        let conf = Double(top.confidence)
        let requiredConf = isEstablished ? Self.trackConfidence : Self.entryConfidence
        guard conf >= requiredConf else {
            handleMissedFrame(timestamp: timestamp)
            return false
        }

        // Convert Vision bbox (bottom-left) to top-left.
        let bb   = obs.boundingBox
        let x    = Double(bb.midX)
        let y    = 1.0 - Double(bb.midY)
        let bboxW = Double(bb.width)
        let bboxH = Double(bb.height)

        // Jump rejection. Use the relaxed threshold if ball was recently lost
        // (re-acquisition: ball moved while we couldn't track it).
        if let prev = prevBall {
            let dist      = hypot(x - prev.x, y - prev.y)
            let threshold = framesLost >= Self.lostFramesForRelaxedJump
                ? Self.reacquireJumpThreshold
                : Self.jumpThreshold
            if dist > threshold {
                NSLog("[BallTracker] jump rejected dist=%.3f threshold=%.3f (lost=%d)",
                      dist, threshold, framesLost)
                handleMissedFrame(timestamp: timestamp)
                return false
            }
        }

        // Entry persistence gate.
        // prevBall is updated here so jump filter stays calibrated during the gate window,
        // but we don't add the position to the buffer until the gate passes.
        // Gate rules:
        //   1. Single frame at conf >= highConfEntryThreshold → establish immediately.
        //   2. Otherwise: 2 of the last 3 frames must pass entryConfidence threshold.
        if !isEstablished {
            prevBall = BallPoint(x: x, y: y, t: timestamp, conf: conf, bboxW: bboxW, bboxH: bboxH)

            if conf >= Self.highConfEntryThreshold {
                isEstablished    = true
                recentGateFrames = []
                NSLog("[BallTracker] track ESTABLISHED (high-conf=%.2f) pos=%.3f,%.3f", conf, x, y)
            } else {
                recentGateFrames.append(true)
                if recentGateFrames.count > 3 { recentGateFrames.removeFirst() }
                let hits = recentGateFrames.filter { $0 }.count
                if hits >= 2 {
                    isEstablished    = true
                    recentGateFrames = []
                    NSLog("[BallTracker] track ESTABLISHED (2-of-3 gate) conf=%.2f pos=%.3f,%.3f",
                          conf, x, y)
                } else {
                    NSLog("[BallTracker] entry gate hits=%d/2 window=%@",
                          hits, recentGateFrames.map { $0 ? "1" : "0" }.joined())
                    return false
                }
            }
        }

        // Accept position into buffer.
        let pt = BallPoint(x: x, y: y, t: timestamp, conf: conf, bboxW: bboxW, bboxH: bboxH)
        buffer.append(pt)
        if buffer.count > Self.bufferMax { buffer.removeFirst(buffer.count - Self.bufferMax) }
        prevBall   = pt
        framesLost = 0
        velocity   = computeVelocity()
        return true
    }

    // MARK: – Missed frame handling ────────────────────────────────────────────

    private func handleMissedFrame(timestamp: Double) {
        framesLost += 1
        if !isEstablished {
            recentGateFrames.append(false)
            if recentGateFrames.count > 3 { recentGateFrames.removeFirst() }
        }
        if isEstablished && framesLost >= Self.trackDeathFrames {
            NSLog("[BallTracker] track DEAD — %d frames without detection", framesLost)
            killTrack()
        }
    }

    // MARK: – Track death ──────────────────────────────────────────────────────
    //
    // Resets tracking state but does NOT clear the buffer — the scoring logic
    // needs buffer.last for the disappearance heuristic (Path C). Old entries
    // are pruned by the ageSeconds cutoff on the next ingest() call.

    func killTrack() {
        isEstablished     = false
        framesLost        = 0
        consecutiveFrames = 0
        recentGateFrames  = []
        prevBall          = nil
        velocity          = .zero
    }

    // MARK: – Session management ───────────────────────────────────────────────

    /// Called on startTracking. Clears the buffer for a fresh shooting session.
    func resetSession() {
        buffer.removeAll()
        isEstablished     = false
        framesLost        = 0
        consecutiveFrames = 0
        recentGateFrames  = []
        prevBall          = nil
        velocity          = .zero
    }

    func resetAll() { resetSession() }

    // MARK: – Smoothing ────────────────────────────────────────────────────────

    /// 3-frame moving average over the full buffer. Smooths jitter while preserving
    /// timing (each smoothed point keeps its original timestamp for regression).
    func smoothedPositions() -> [BallPoint] {
        guard buffer.count >= 2 else { return buffer }
        var out: [BallPoint] = []
        out.reserveCapacity(buffer.count)
        for i in 0..<buffer.count {
            let lo = max(0, i - 1)
            let hi = min(buffer.count - 1, i + 1)
            let w  = Double(hi - lo + 1)
            var ax = 0.0, ay = 0.0, ac = 0.0, abw = 0.0, abh = 0.0
            for j in lo...hi {
                ax += buffer[j].x;  ay += buffer[j].y;  ac += buffer[j].conf
                abw += buffer[j].bboxW;  abh += buffer[j].bboxH
            }
            out.append(BallPoint(x: ax/w, y: ay/w, t: buffer[i].t,
                                 conf: ac/w, bboxW: abw/w, bboxH: abh/w))
        }
        return out
    }

    /// Returns up to maxCount recent smoothed positions within [timestamp - seconds, now].
    func recentSmoothed(within seconds: Double, at timestamp: Double, maxCount: Int = 10) -> [BallPoint] {
        let cutoff = timestamp - seconds
        let recent = smoothedPositions().filter { $0.t >= cutoff }
        guard recent.count > maxCount else { return recent }
        return Array(recent.suffix(maxCount))
    }

    // MARK: – Size trend ───────────────────────────────────────────────────────
    //
    // Compares bbox area at the start vs end of the last N buffer entries.
    // Real shots moving away from the camera produce a shrinking bbox.
    // A static false positive has roughly constant size.

    func bboxSizeTrend(frames n: Int = 6) -> Double {
        let pts = Array(buffer.suffix(n))
        guard pts.count >= 2,
              let first = pts.first, let last = pts.last else { return 0.0 }
        let firstArea = first.bboxW * first.bboxH
        guard firstArea > 1e-8 else { return 0.0 }
        let lastArea = last.bboxW * last.bboxH
        return (lastArea - firstArea) / firstArea
    }

    // MARK: – Velocity ─────────────────────────────────────────────────────────

    private func computeVelocity() -> Velocity {
        let pts = Array(buffer.suffix(Self.velocityWindowFrames))
        guard pts.count >= 2,
              let first = pts.first, let last = pts.last else { return .zero }
        let dt = last.t - first.t
        guard dt > 1e-6 else { return .zero }
        let dx = (last.x - first.x) / dt
        let dy = (last.y - first.y) / dt
        return Velocity(dx: dx, dy: dy, speed: hypot(dx, dy))
    }

    // MARK: – Regression math (used by all three scoring paths) ───────────────

    /// Linear OLS regression over points. Fits y(t) and x(t) independently.
    /// Solves for the timestamp t* when y(t*) = targetY, then returns x(t*).
    /// Falls back to last known X when regression is degenerate:
    ///   - fewer than 2 points
    ///   - all timestamps identical (denom ≈ 0)
    ///   - ball moving purely horizontally (mY ≈ 0 → can't invert y(t))
    func predictXAtY(points: [BallPoint], targetY: Double) -> Double {
        let n = Double(points.count)
        guard n >= 2 else { return points.last?.x ?? 0.5 }
        var sumT = 0.0, sumY = 0.0, sumX = 0.0
        var sumTY = 0.0, sumTX = 0.0, sumT2 = 0.0
        for p in points {
            sumT  += p.t;  sumY  += p.y;  sumX  += p.x
            sumTY += p.t * p.y;  sumTX += p.t * p.x;  sumT2 += p.t * p.t
        }
        let denom = n * sumT2 - sumT * sumT
        guard abs(denom) > 1e-12 else { return points.last?.x ?? 0.5 }
        let mY = (n * sumTY - sumT * sumY) / denom
        let bY = (sumY - mY * sumT) / n
        let mX = (n * sumTX - sumT * sumX) / denom
        let bX = (sumX - mX * sumT) / n
        guard abs(mY) > 1e-12 else { return points.last?.x ?? 0.5 }
        let tCross = (targetY - bY) / mY
        return max(0.0, min(1.0, mX * tCross + bX))
    }

    /// R² goodness-of-fit for the linear y(t) model over the given points.
    /// 1.0 = ball descended in a perfectly straight line (ideal arc crossing).
    /// 0.0 = scattered, noisy positions (low-quality detection; treat result skeptically).
    /// Returns 0.5 when there aren't enough points to compute meaningfully.
    func rSquared(points: [BallPoint]) -> Double {
        let n = Double(points.count)
        guard n >= 3 else { return 0.5 }
        var sumT = 0.0, sumY = 0.0, sumTY = 0.0, sumT2 = 0.0
        for p in points { sumT += p.t; sumY += p.y; sumTY += p.t * p.y; sumT2 += p.t * p.t }
        let denom = n * sumT2 - sumT * sumT
        guard abs(denom) > 1e-12 else { return 0.9 }
        let mY = (n * sumTY - sumT * sumY) / denom
        let bY = (sumY - mY * sumT) / n
        let meanY = sumY / n
        var ssRes = 0.0, ssTot = 0.0
        for p in points {
            ssRes += pow(p.y - (mY * p.t + bY), 2)
            ssTot += pow(p.y - meanY, 2)
        }
        guard ssTot > 1e-12 else { return 0.9 }
        return max(0.0, min(1.0, 1.0 - ssRes / ssTot))
    }
}

// ─── BallTrackingPipeline (Shot Scorer) ──────────────────────────────────────────
//
// Composes HoopTracker and BallTracker into three independent shot-scoring paths.
// Each path can independently detect a make or miss. A shared 1.5s cooldown prevents
// one physical shot from being counted multiple times across paths or frames.
//
// PATH A — Trajectory arc: ball rises above rim, peaks, descends through the rim line.
//          Fits linear regression to predict exact crossing X. Best for jumpers and 3s.
//
// PATH B — Through hoop region: tracks the "above rim → enter region → below" pattern.
//          Best for layups, runners, floaters, and close shots with shallow arcs.
//
// PATH C — Disappearance heuristic: ball in confirmed Path A flight vanishes near rim.
//          The net physically occludes the ball on a swish. Lower confidence. Last resort.
//
// All coordinates: top-left origin (y=0 top, y=1 bottom). Vision observations are
// converted at ingestion boundaries inside HoopTracker and BallTracker.

final class BallTrackingPipeline {

    // MARK: – Sub-components (composition over inheritance)
    let hoopTracker = HoopTracker()
    let ballTracker = BallTracker()

    // MARK: – Tuning constants (every threshold named and documented)

    /// Hoop bbox expansion factor for Path B's detection region.
    /// 0.20 = 20% larger on each side. The model's bbox rarely perfectly frames the rim opening.
    static let hoopRegionExpansion: Double = 0.20

    /// Ball must be within this multiple of rimWidth of the rim center to start Path A flight
    /// or enter the Path B region. 2.5× is generous but still eliminates far-field noise.
    static let nearHoopXFactor: Double = 2.5

    /// Path A launch: ball may be this far BELOW rimLineY and still count as "at launch height."
    /// Handles the common detection offset where the model places the ball slightly low.
    static let launchToleranceY: Double = 0.04

    /// Path A: ball must have peaked this far above rimLineY to qualify as a real shot arc.
    /// Eliminates slow dribble-bounces near the hoop that would otherwise trigger Path A.
    static let minimumPeakAboveRim: Double = 0.03

    /// Path A: abandon in-flight tracking after this many seconds with no scoring trigger.
    /// Real shots resolve in < 1.5s. 3.0s allows very high arcs and slow balls.
    static let flightTimeoutSeconds: Double = 3.0

    /// Path A: crossing X must be within makeTolerance * rimWidth of rim center → MAKE.
    /// 0.55 = ±55% of half-rim-width. Slightly generous to handle detection jitter.
    static let makeTolerance: Double = 0.55

    /// Path B: ball must have been above the rim for at least this many consecutive analyzed
    /// frames before a region entry can score. Prevents a ball already below the rim from
    /// triggering a make by passing through the expanded region from below.
    static let pathBMinFramesAbove: Int = 2

    /// Path B: MAKE scored when ball descends this fraction of hoopHeight below rimLineY.
    /// 0.40 = ball went 40% through the hoop. Prevents a top-of-rim brush from scoring.
    static let pathBMakeDepthFraction: Double = 0.40

    /// Path B: reset if ball stays in region longer than this many frames without resolving.
    /// Ball sitting on the rim or rolling along it does NOT count as a make.
    static let pathBMaxFramesInRegion: Int = 18

    /// Path C: ball must disappear within this many frames after going in-flight.
    /// More frames = ball was probably held or dribbled, not shot.
    static let pathCMaxDisappearanceFrames: Int = 8

    /// Path C: last known ball position must be within this normalized distance of
    /// rim center on both axes for disappearance to be inferred as a make.
    static let pathCHoopProximity: Double = 0.15

    /// Path A: ball must descend this far BELOW rimLineY (while still descending) before
    /// a make is confirmed. Prevents a rim-kiss that reverses upward from scoring as a make.
    /// ~0.04 ≈ 4% of frame height, roughly the depth of the net opening.
    static let makeConfirmMargin: Double = 0.04

    /// Shared cooldown across all paths: minimum seconds between any two scored shots.
    /// 1.5s prevents one physical shot from being double-counted by multiple paths.
    static let shotCooldownSeconds: Double = 1.5

    // MARK: – Path A state (trajectory arc)
    private var pathA_inFlight       = false
    private var pathA_peakY          = 1.0     // smallest y seen while in flight (highest on screen)
    private var pathA_flightStart    = 0.0
    private var pathA_wasRising      = false   // observed upward velocity before peak
    private var pathA_peaked         = false   // transitioned rising → falling
    private var pathA_awaitingResult = false   // ball crossed rim line — waiting for make/miss confirm

    // MARK: – Path B state (ball through hoop region)
    private enum PathBPhase { case idle, above, inRegion }
    private var pathB_phase          = PathBPhase.idle
    private var pathB_framesAbove    = 0
    private var pathB_framesInRegion = 0

    // MARK: – Shared cooldown + counters
    private var lastShotTimestamp = 0.0
    private(set) var makes    = 0
    private(set) var attempts = 0

    // MARK: – Observability
    private(set) var scoringState = "idle — no hoop"
    private(set) var lastShotPath = "none"

    // MARK: – Interface for ATHLTCameraModule (preserves existing call sites)
    var hoopLocked: Bool                   { hoopTracker.isLocked }
    var hoop:       CGRect?                { hoopTracker.geometry?.bbox }
    var inFlight:   Bool                   { pathA_inFlight }
    var latestBall: BallTracker.BallPoint? { ballTracker.latestBall }

    func considerHoop(visionBBox: CGRect, confidence: Float) {
        hoopTracker.ingest(visionBBox: visionBBox, confidence: confidence)
    }

    func setManualHoop(x: Double, y: Double, width: Double, height: Double) {
        hoopTracker.setManual(x: x, y: y, width: width, height: height)
    }

    // MARK: – Session management ─────────────────────────────────────────────────

    func resetSession() {
        ballTracker.resetSession()
        hoopTracker.resetSession()
        resetPathA(); resetPathB()
        makes             = 0
        attempts          = 0
        lastShotTimestamp = 0.0
        scoringState      = "session reset — waiting for ball"
        lastShotPath      = "none"
        NSLog("[Pipeline] session reset — hoop locked: %@", hoopTracker.isLocked ? "YES" : "NO")
    }

    func resetAll() {
        ballTracker.resetAll()
        hoopTracker.resetAll()
        resetPathA(); resetPathB()
        makes             = 0
        attempts          = 0
        lastShotTimestamp = 0.0
        scoringState      = "idle — no hoop"
        lastShotPath      = "none"
        NSLog("[Pipeline] full reset")
    }

    // MARK: – Primary update ──────────────────────────────────────────────────────
    //
    // Called once per analyzed frame from handleTrackingMode.
    // Returns (type, confidence) if a shot scored this frame, nil otherwise.

    func update(
        ball:      VNRecognizedObjectObservation?,
        basket:    VNRecognizedObjectObservation?,
        timestamp: Double
    ) -> (type: String, confidence: Double)? {

        // Always update both trackers (nil inputs mark missed frames / possible stale hoop)
        let hoopConf = basket?.labels.first?.confidence ?? 0
        hoopTracker.ingest(visionBBox: basket?.boundingBox, confidence: hoopConf)
        ballTracker.ingest(obs: ball, timestamp: timestamp)

        // Require an explicitly LOCKED hoop — geometry alone is not enough.
        // isLocked is only true after HoopTracker's persistence consensus (5 frames)
        // or a manual tap. Prevents false-positive scoring against an object the model
        // briefly saw as "basket" before the consensus window completed.
        guard hoopTracker.isLocked, let hoop = hoopTracker.geometry else {
            let pct = Int(hoopTracker.lockProgress * 100)
            scoringState = "no hoop locked — scoring disabled (\(pct)% accumulated)"
            resetPathA(); resetPathB()
            return nil
        }

        // Shared cooldown
        let coolRemaining = Self.shotCooldownSeconds - (timestamp - lastShotTimestamp)
        if coolRemaining > 0 {
            scoringState = String(format: "cooldown — %.1fs remaining", coolRemaining)
            return nil
        }

        // PATH C: fires on disappearance while Path A flight was active.
        // Check BEFORE the established guard since ball may not be visible.
        if pathA_inFlight,
           ballTracker.framesLost >= 2,
           ballTracker.framesLost <= Self.pathCMaxDisappearanceFrames {
            if let r = evaluatePathC(hoop: hoop, timestamp: timestamp) {
                return registerShot(type: r.type, confidence: r.confidence,
                                    path: "C", timestamp: timestamp)
            }
        }

        // Path A timeout cleanup
        if pathA_inFlight && timestamp - pathA_flightStart > Self.flightTimeoutSeconds {
            NSLog("[PathA] timeout after %.1fs", timestamp - pathA_flightStart)
            scoringState = "Path A timeout — resetting"
            resetPathA()
        }

        // Require established ball track with a detection this frame
        guard ballTracker.isEstablished, ballTracker.framesLost == 0,
              let latest = ballTracker.latestBall else {
            if !ballTracker.isEstablished {
                scoringState = "waiting for ball (2-of-3 frames or high-conf)"
            } else {
                scoringState = pathA_inFlight
                    ? "Path A in-flight — ball temporarily lost"
                    : "ball established — no detection this frame"
            }
            return nil
        }

        // PATH A — trajectory arc
        if let r = evaluatePathA(latest: latest, hoop: hoop, timestamp: timestamp) {
            return registerShot(type: r.type, confidence: r.confidence,
                                path: "A", timestamp: timestamp)
        }

        // PATH B — ball through hoop region
        if let r = evaluatePathB(latest: latest, hoop: hoop, timestamp: timestamp) {
            return registerShot(type: r.type, confidence: r.confidence,
                                path: "B", timestamp: timestamp)
        }

        return nil
    }

    // MARK: – PATH A: Trajectory arc ─────────────────────────────────────────────

    private func evaluatePathA(
        latest:    BallTracker.BallPoint,
        hoop:      HoopTracker.HoopGeometry,
        timestamp: Double
    ) -> (type: String, confidence: Double)? {

        let ballX      = latest.x
        let ballY      = latest.y
        let vel        = ballTracker.velocity
        let rimLineY   = hoop.rimLineY
        let rimCenterX = hoop.rimCenterX
        let rimWidth   = hoop.rimWidth

        if !pathA_inFlight {
            let atOrAboveRim = ballY < rimLineY + Self.launchToleranceY
            let nearX        = abs(ballX - rimCenterX) < rimWidth * Self.nearHoopXFactor
            if atOrAboveRim && nearX {
                pathA_inFlight    = true
                pathA_peakY       = ballY
                pathA_flightStart = timestamp
                pathA_wasRising   = vel.isRising
                pathA_peaked      = false
                NSLog("[PathA] FLIGHT START y=%.3f rimY=%.3f x=%.3f rimX=%.3f vel.dy=%.3f",
                      ballY, rimLineY, ballX, rimCenterX, vel.dy)
            } else {
                scoringState = String(format: "tracking (%.2f,%.2f) — not near rim [rimX=%.2f ±%.2f]",
                                      ballX, ballY, rimCenterX, rimWidth * Self.nearHoopXFactor)
            }
            return nil
        }

        if ballY < pathA_peakY { pathA_peakY = ballY }

        if !pathA_peaked {
            if vel.isRising  { pathA_wasRising = true }
            if pathA_wasRising && vel.isFalling {
                pathA_peaked = true
                NSLog("[PathA] PEAKED y=%.3f (%.3f above rim)", pathA_peakY, rimLineY - pathA_peakY)
            }
        }

        let peakedAboveRim = pathA_peakY < rimLineY - Self.minimumPeakAboveRim
        let stillNearX     = abs(ballX - rimCenterX) < rimWidth * Self.nearHoopXFactor * 1.5

        // --- Already waiting to confirm make vs miss ---
        if pathA_awaitingResult {
            let confirmedMake = ballY > rimLineY + Self.makeConfirmMargin && vel.isFalling
            let rimBounce     = ballY < rimLineY   // reversed back above rim
            let rimOut        = !stillNearX

            if confirmedMake {
                NSLog("[PathA] MAKE confirmed — ball %.3f below rim (margin=%.2f)",
                      ballY - rimLineY, Self.makeConfirmMargin)
                return scorePathA(hoop: hoop, timestamp: timestamp)
            }
            if rimBounce {
                NSLog("[PathA] MISS — rim bounce (ball reversed above rim)")
                scoringState = "MISS Path A — rim bounce"
                resetPathA(); resetPathB()
                return ("miss", 0.65)
            }
            if rimOut {
                NSLog("[PathA] MISS — rim out (ball exited sideways during await)")
                scoringState = "MISS Path A — rim out"
                resetPathA(); resetPathB()
                return ("miss", 0.60)
            }
            scoringState = String(format: "Path A awaiting: y=%.3f / need %.3f %@",
                                  ballY, rimLineY + Self.makeConfirmMargin,
                                  vel.isFalling ? "[desc]" : "[ascending]")
            return nil
        }

        // --- Check if ball just reached the rim line ---
        let crossedRim = ballY >= rimLineY
        if crossedRim && peakedAboveRim && stillNearX {
            pathA_awaitingResult = true
            NSLog("[PathA] rim crossed — awaiting make/miss confirmation y=%.3f rimY=%.3f", ballY, rimLineY)
            scoringState = String(format: "Path A awaiting: y=%.3f crossed rim", ballY)
            return nil
        }

        // Log every in-flight frame so Xcode console shows ball.y vs rimLineY in real time.
        NSLog("[PathA] in-flight: ball=(%.3f,%.3f) rimY=%.3f rimX=%.3f±%.3f | crossed=%@ peaked=%@ nearX=%@",
              ballX, ballY, rimLineY, rimCenterX, rimWidth * Self.nearHoopXFactor,
              crossedRim ? "YES" : "no", peakedAboveRim ? "YES" : "no", stillNearX ? "YES" : "no")

        scoringState = String(format: "Path A: y=%.3f peak=%.3f rim=%.3f %@",
                              ballY, pathA_peakY, rimLineY,
                              pathA_peaked ? "[peaked]" : (pathA_wasRising ? "[rising→]" : "[watching]"))
        return nil
    }

    private func scorePathA(
        hoop:      HoopTracker.HoopGeometry,
        timestamp: Double
    ) -> (type: String, confidence: Double) {

        let pts    = ballTracker.recentSmoothed(within: 1.5, at: timestamp, maxCount: 7)
        let crossX = pts.count >= 2
            ? ballTracker.predictXAtY(points: pts, targetY: hoop.rimLineY)
            : (ballTracker.latestBall?.x ?? hoop.rimCenterX)
        let r2     = pts.count >= 3 ? ballTracker.rSquared(points: pts) : 0.5

        let inside   = abs(crossX - hoop.rimCenterX) <= hoop.rimWidth * Self.makeTolerance
        let shotType = inside ? "make" : "miss"
        let shotConf = max(0.45, 0.45 + r2 * 0.50)

        NSLog("[PathA] %@ crossX=%.3f rimCtr=%.3f rimW=%.3f inside=%@ r2=%.2f conf=%.2f",
              shotType.uppercased(), crossX, hoop.rimCenterX, hoop.rimWidth,
              inside ? "YES" : "NO", r2, shotConf)
        scoringState = String(format: "%@ Path A crossX=%.3f r2=%.2f conf=%.2f",
                              shotType.uppercased(), crossX, r2, shotConf)
        resetPathA(); resetPathB()
        return (shotType, shotConf)
    }

    // MARK: – PATH B: Ball through hoop region ────────────────────────────────────

    private func evaluatePathB(
        latest:    BallTracker.BallPoint,
        hoop:      HoopTracker.HoopGeometry,
        timestamp: Double
    ) -> (type: String, confidence: Double)? {

        let ballX    = latest.x
        let ballY    = latest.y
        let rimLineY = hoop.rimLineY
        let rimH     = Double(hoop.bbox.height)

        let ex         = (hoop.rimMaxX - hoop.rimMinX) * Self.hoopRegionExpansion
        let regionMinX = hoop.rimMinX - ex
        let regionMaxX = hoop.rimMaxX + ex
        let aboveRim   = ballY < rimLineY
        let inXRange   = ballX >= regionMinX && ballX <= regionMaxX

        switch pathB_phase {

        case .idle:
            if aboveRim && inXRange {
                pathB_phase       = .above
                pathB_framesAbove = 1
            }

        case .above:
            if aboveRim && inXRange {
                pathB_framesAbove += 1
                scoringState = String(format: "Path B: above rim %d frames y=%.3f", pathB_framesAbove, ballY)
            } else if !aboveRim && inXRange && pathB_framesAbove >= Self.pathBMinFramesAbove {
                pathB_phase          = .inRegion
                pathB_framesInRegion = 1
                NSLog("[PathB] ENTERED from above (framesAbove=%d) x=%.3f y=%.3f",
                      pathB_framesAbove, ballX, ballY)
                scoringState = "Path B: in hoop region — watching for through or bounce"
            } else {
                pathB_phase = .idle; pathB_framesAbove = 0
            }

        case .inRegion:
            pathB_framesInRegion += 1

            if pathB_framesInRegion > Self.pathBMaxFramesInRegion {
                NSLog("[PathB] timeout in region — resetting")
                resetPathB(); return nil
            }

            // Ball bounced back above the rim → MISS
            if aboveRim {
                NSLog("[PathB] MISS — bounced back above rim (%d frames in region)", pathB_framesInRegion)
                scoringState = "MISS Path B — bounced back above rim"
                resetPathA(); resetPathB()
                return ("miss", 0.70)
            }

            // Ball descended makeDepthFraction through the hoop → MAKE
            let makeDepth = rimLineY + rimH * Self.pathBMakeDepthFraction
            if ballY >= makeDepth && inXRange {
                NSLog("[PathB] MAKE — descended %.0f%% through hoop (y=%.3f)",
                      Self.pathBMakeDepthFraction * 100, ballY)
                scoringState = String(format: "MAKE Path B — %.0f%% through hoop conf=0.82",
                                      Self.pathBMakeDepthFraction * 100)
                resetPathA(); resetPathB()
                return ("make", 0.82)
            }

            // Ball exited region sideways (rim-out miss)
            if !inXRange {
                NSLog("[PathB] MISS — rim out (ball left region sideways)")
                scoringState = "MISS Path B — rim out"
                resetPathA(); resetPathB()
                return ("miss", 0.65)
            }

            scoringState = String(format: "Path B: %d frames in region y=%.3f / %.3f needed",
                                  pathB_framesInRegion, ballY, makeDepth)
        }

        return nil
    }

    // MARK: – PATH C: Disappearance heuristic ─────────────────────────────────────

    private func evaluatePathC(
        hoop:      HoopTracker.HoopGeometry,
        timestamp: Double
    ) -> (type: String, confidence: Double)? {

        guard let last = ballTracker.latestBall else { return nil }

        // Ball vanished ABOVE the rim — it rose out of frame, not through the net.
        // Do NOT reset Path A (the ball may still arc back down) and do NOT start cooldown.
        if last.y < hoop.rimLineY {
            NSLog("[PathC] ignored — ball exited above rim (y=%.3f rimY=%.3f)", last.y, hoop.rimLineY)
            scoringState = String(format: "Path C ignored — ball exited upward (y=%.3f)", last.y)
            return nil
        }

        // Ball was at or below the rim. Must also be within X range of the rim.
        let dx = abs(last.x - hoop.rimCenterX)
        guard dx <= Self.pathCHoopProximity else {
            NSLog("[PathC] disappeared far from rim (dx=%.3f) — abort", dx)
            resetPathA(); return nil
        }

        // Must have been moving downward — an upward-moving ball near the rim is bouncing away.
        let vel = ballTracker.velocity
        guard vel.isFalling else {
            NSLog("[PathC] ignored — near rim but velocity upward (dy=%.4f) — reset", vel.dy)
            scoringState = "Path C ignored — vanished near rim without downward motion"
            resetPathA(); return nil
        }

        NSLog("[PathC] MAKE — in-flight ball vanished at/below rim (%.3f,%.3f) vel.dy=%.3f",
              last.x, last.y, vel.dy)
        scoringState = "MAKE Path C — ball vanished near rim (net occlusion) conf=0.55"
        resetPathA(); resetPathB()
        return ("make", 0.55)
    }

    // MARK: – Shot registration ─────────────────────────────────────────────────

    private func registerShot(
        type: String, confidence: Double, path: String, timestamp: Double
    ) -> (type: String, confidence: Double) {
        if type == "make" { makes += 1 }
        attempts += 1; lastShotTimestamp = timestamp; lastShotPath = path
        NSLog("[Pipeline] SHOT %@ via Path %@ — %d/%d (conf=%.2f)",
              type.uppercased(), path, makes, attempts, confidence)
        return (type, confidence)
    }

    // MARK: – State resets ─────────────────────────────────────────────────────

    private func resetPathA() {
        pathA_inFlight       = false
        pathA_peakY          = 1.0
        pathA_flightStart    = 0.0
        pathA_wasRising      = false
        pathA_peaked         = false
        pathA_awaitingResult = false
    }

    private func resetPathB() {
        pathB_phase = .idle; pathB_framesAbove = 0; pathB_framesInRegion = 0
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
    private let frameSkip    = 3   // ~10fps from 30fps input (was 6 → ~5fps)

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

    // MARK: – Deep-trace counters (reset on startTracking)
    // totalFramesReceived: pre-throttle, pre-guard — incremented on sessionQueue inside handleSampleBuffer.
    //   0 → camera delegate never fired (wiring broken).
    //   >0 but totalFramesAnalyzed==0 → guard on inferenceQueue is blocking.
    // totalFramesAnalyzed: incremented at the very top of runInference (on inferenceQueue).
    //   0 → guard or mode/model condition blocked every frame.
    private var totalFramesReceived: Int = 0   // sessionQueue — camera-alive indicator
    private var totalFramesAnalyzed: Int = 0   // inferenceQueue — inference-ran indicator
    private var lastRawObsClass: String  = "none"
    private var lastRawObsConf: Double   = 0.0

    // MARK: – Module definition ─────────────────────────────────────────────────

    public func definition() -> ModuleDefinition {
        Name("ATHLTCamera")

        Events("onShotDetected", "onError", "onCameraState", "onHoopDetected", "onDetectionDebug", "onDebugStats", "onModelLoadStatus")

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
                self.totalFramesAnalyzed  = 0
                self.lastRawObsClass      = "none"
                self.lastRawObsConf       = 0.0
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
            sendEvent("onModelLoadStatus", ["loaded": false, "modelPath": "", "error": msg])
            promise.resolve(["loaded": false, "error": msg])
            return
        }

        let config = MLModelConfiguration()
        config.computeUnits = .all
        do {
            let mlModel = try MLModel(contentsOf: url, configuration: config)
            visionModel   = try VNCoreMLModel(for: mlModel)
            isModelLoaded = true
            // Auto-enter detection mode so hoop accumulation starts immediately.
            // JS calling setMode("detection") explicitly is now optional — if it
            // arrives later it's a no-op since mode is already "detection".
            // Only override "idle"; never override "tracking" (e.g. model reloaded mid-session).
            if self.currentMode == "idle" { self.currentMode = "detection" }
            NSLog("[ATHLTCamera] model loaded: %@ — mode → %@", url.lastPathComponent, self.currentMode)
            sendEvent("onModelLoadStatus", ["loaded": true, "modelPath": url.lastPathComponent])
            promise.resolve(["loaded": true, "modelName": url.lastPathComponent])
        } catch {
            NSLog("[ATHLTCamera] model FAILED: %@", error.localizedDescription)
            sendEvent("onModelLoadStatus", ["loaded": false, "modelPath": url.lastPathComponent, "error": error.localizedDescription])
            promise.resolve(["loaded": false, "error": error.localizedDescription])
        }
    }

    // MARK: – Frame handling ───────────────────────────────────────────────────
    //
    // FIX: currentMode and isModelLoaded are written on inferenceQueue (via setMode /
    // doLoadModel) but were previously read here on sessionQueue — a data race that
    // made the guard see stale values ("idle" / false) and silently drop all frames.
    // Guard is now inside the inferenceQueue.async block so it reads the same queue
    // where those properties are written.

    func handleSampleBuffer(_ buffer: CMSampleBuffer) {
        // ── Pre-throttle counter — increments every frame the camera delivers. ──
        // If this stays 0 the AVCaptureSession output delegate is not firing at all.
        totalFramesReceived += 1

        frameCounter += 1
        guard frameCounter % frameSkip == 0 else { return }
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(buffer) else { return }

        let ts = CMSampleBufferGetPresentationTimeStamp(buffer)
        let timestampSec: Double = ts.timescale > 0
            ? Double(ts.value) / Double(ts.timescale)
            : Date().timeIntervalSinceReferenceDate

        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        let cap = pixelBuffer
        let t   = timestampSec

        inferenceQueue.async { [weak self] in
            defer { CVPixelBufferUnlockBaseAddress(cap, .readOnly) }
            guard let self else { return }

            // ── Mode / model guard — evaluated on inferenceQueue where both
            //    properties are written. Logs reason on the first 30+ frames
            //    with no analysis, so we can see exactly which check is failing.
            let neverAnalyzed = self.totalFramesAnalyzed == 0 && self.totalFramesReceived >= 30

            guard self.currentMode != "idle" else {
                if neverAnalyzed {
                    NSLog("[ATHLTCamera] GUARD BLOCK: currentMode='idle' after %d frames rx — setMode('detection') not called or lost",
                          self.totalFramesReceived)
                }
                return
            }
            guard self.isModelLoaded, let model = self.visionModel else {
                if neverAnalyzed {
                    NSLog("[ATHLTCamera] GUARD BLOCK: model not loaded after %d frames rx (isModelLoaded=%@, visionModel=%@)",
                          self.totalFramesReceived,
                          self.isModelLoaded ? "YES" : "NO",
                          self.visionModel == nil ? "nil" : "set")
                }
                return
            }

            self.runInference(pixelBuffer: cap, model: model, timestamp: t)
        }
    }

    // MARK: – CoreML inference ─────────────────────────────────────────────────

    private func runInference(pixelBuffer: CVPixelBuffer, model: VNCoreMLModel, timestamp: Double) {
        // Increment BEFORE any other logic — if this never advances, runInference is never called.
        totalFramesAnalyzed += 1

        let request = VNCoreMLRequest(model: model)
        request.imageCropAndScaleOption = .scaleFit

        // COORDINATE SYSTEM FIX: use .up (no rotation) so Vision returns bounding boxes in the
        // native landscape pixel buffer space. The buffer is already landscape-oriented because
        // conn.videoOrientation = .landscapeRight is set on the capture connection.
        // Previously used .right which caused Vision to rotate the buffer 90° CCW internally,
        // producing swapped X/Y axes that mismatched screen-tap hoop coordinates.
        if totalFramesAnalyzed <= 3 {
            let w = CVPixelBufferGetWidth(pixelBuffer)
            let h = CVPixelBufferGetHeight(pixelBuffer)
            NSLog("[ATHLTCamera] pixel buffer: %d×%d (%@)", w, h, w > h ? "landscape ✓" : "portrait — may need orientation fix")
        }
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .up, options: [:])
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
            // No observations at all — update raw trace to reflect empty output
            lastRawObsClass = "none"
            lastRawObsConf  = 0.0
            return
        }

        // Log ALL raw observations BEFORE any confidence filtering.
        // If model is running but silent, these NSLogs will never appear.
        if observations.isEmpty {
            NSLog("[ATHLTCamera] frame %d — model returned 0 observations", totalFramesAnalyzed)
            lastRawObsClass = "none"
            lastRawObsConf  = 0.0
        } else {
            var topClass = "none"
            var topConf: Float = 0
            for obs in observations {
                guard let lbl = obs.labels.first else { continue }
                NSLog("[ATHLTCamera] raw obs: class=%@ conf=%.3f bbox=(%.2f,%.2f,%.2f×%.2f)",
                      lbl.identifier, lbl.confidence,
                      obs.boundingBox.origin.x, obs.boundingBox.origin.y,
                      obs.boundingBox.width, obs.boundingBox.height)
                if lbl.confidence > topConf { topClass = lbl.identifier; topConf = lbl.confidence }
            }
            lastRawObsClass = topClass
            lastRawObsConf  = Double(topConf)
        }

        processObservations(observations, timestamp: timestamp)
    }

    // MARK: – Class name helpers ──────────────────────────────────────────────
    //
    // The exported model's class identifiers depend on the training dataset and
    // export toolchain. We've seen two formats in practice:
    //
    //   Human-readable (ideal):  "Ball", "Basket", "Ball_in_Basket", etc.
    //   Numeric string (bug):    "0", "1", "2", "3", "4"
    //
    // For the SwishAI 5-class dataset (basketball-6vyfz/basketball-detection-srfkd):
    //   0 = Ball           → ball
    //   1 = Ball_in_Basket → ball (also a ball position for tracking)
    //   2 = Player         → ignored
    //   3 = Basket         → basket/hoop
    //   4 = Player_Shooting→ ignored
    //
    // ALL comparisons use lowercased() so case variants like "BALL" also match.

    private static func isBallClass(_ identifier: String) -> Bool {
        switch identifier.lowercased() {
        case "ball", "0", "ball_in_basket", "1": return true
        default: return false
        }
    }

    private static func isBasketClass(_ identifier: String) -> Bool {
        switch identifier.lowercased() {
        case "basket", "hoop", "rim", "basketball hoop", "basketball_hoop", "3": return true
        default: return false
        }
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
            let conf = Double(top.confidence)
            if ATHLTCameraModule.isBallClass(top.identifier) {
                totalBallDetections += 1
                if conf > peakBallConfidence { peakBallConfidence = conf }
            } else if ATHLTCameraModule.isBasketClass(top.identifier) {
                totalHoopDetections += 1
                if conf > peakHoopConfidence { peakHoopConfidence = conf }
            }
        }

        if diagnosticMode { emitDiagnosticEvent(observations) }

        // Emit debug stats once per second in detection AND tracking modes.
        // Gating on isTracking only meant no diagnostics were visible before Start.
        if isTracking || currentMode == "detection" {
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
            if ATHLTCameraModule.isBasketClass(top.identifier) && top.confidence >= minConf {
                if top.confidence > bestConf { bestBasket = obs; bestConf = top.confidence }
            }
        }

        guard let found = bestBasket else { return }

        // Accumulate hoop evidence — pipeline requires hoopLockRequired consecutive
        // frames at hoopLockConfThreshold before committing. Prevents a single
        // high-confidence frame on a non-hoop object from locking the wrong region.
        pipeline.considerHoop(visionBBox: found.boundingBox, confidence: bestConf)

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
            if ATHLTCameraModule.isBallClass(top.identifier) {
                if ball == nil || top.confidence > (ball?.labels.first?.confidence ?? 0) { ball = obs }
            } else if ATHLTCameraModule.isBasketClass(top.identifier) {
                if basket == nil || top.confidence > (basket?.labels.first?.confidence ?? 0) { basket = obs }
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
            "totalFramesReceived":  totalFramesReceived,
            "totalFramesAnalyzed": totalFramesAnalyzed,
            "lastRawObsClass":     lastRawObsClass,
            "lastRawObsConf":      lastRawObsConf,
            "scoringState":        pipeline.scoringState,
            "lastShotPath":        pipeline.lastShotPath,
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

