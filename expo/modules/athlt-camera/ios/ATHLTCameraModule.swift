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
    /// Aligned with handleDetectionMode's minConf filter so frames that pass the
    /// pre-filter always have a chance to accumulate toward the lock.
    /// Lowered from 0.45 → 0.35: outdoor hoops routinely produce conf 0.30–0.44
    /// which caused every accumulation attempt to reset before committing.
    static let lockConfThreshold: Float = 0.35

    /// Number of frames (meeting confidence + stability requirements) needed to commit.
    /// Lowered from 5 → 3 for faster lock; the jump-threshold and miss-tolerance guards
    /// still prevent false locks on transient non-hoop objects.
    static let lockConsecutiveRequired: Int = 3

    /// Consecutive MISSED frames (below conf or nil) allowed before resetting accumulation.
    /// Was 0 (any miss reset). Now 1 — a single blurry frame won't wipe a partially-built lock.
    static let maxConsecutiveMisses: Int = 1

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

    private var candidateFrames:       Int     = 0
    private var candidateSumX:         Double  = 0
    private var candidateSumY:         Double  = 0
    private var candidateSumW:         Double  = 0
    private var candidateSumH:         Double  = 0
    private var lastCandidateMidX:     Double? = nil
    private var lastCandidateMidY:     Double? = nil
    private var consecutiveMissFrames: Int     = 0   // misses since last hit; allows 1 before reset

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
            consecutiveMissFrames += 1
            if consecutiveMissFrames > Self.maxConsecutiveMisses && candidateFrames > 0 {
                // Enough consecutive misses to invalidate the current candidate window.
                NSLog("[HoopTracker] accumulation reset (%d consec misses, conf=%.2f < %.2f, had %d frames)",
                      consecutiveMissFrames, confidence, Self.lockConfThreshold, candidateFrames)
                resetAccumulation()
            }
            // ≤ maxConsecutiveMisses: hold the current count — one blurry frame shouldn't reset.
            return
        }
        consecutiveMissFrames = 0

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
        candidateFrames       = 0
        candidateSumX         = 0
        candidateSumY         = 0
        candidateSumW         = 0
        candidateSumH         = 0
        lastCandidateMidX     = nil
        lastCandidateMidY     = nil
        consecutiveMissFrames = 0
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
// Each path can independently detect a make or miss. A shared 1.0s cooldown prevents
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
    //
    // Two engagement zones — intentionally different widths:
    //   nearHoopXFactor / nearRimEngageRadius  — BROAD: triggers tracking evaluation
    //   makeZoneHalfWidth                       — TIGHT: required to confirm a MAKE
    // Keeping these separate catches layups and close shots in the broad zone while
    // requiring the ball to physically pass through the rim opening for a make.

    // ── Lateral make/engagement ───────────────────────────────────────────────────

    /// Ball must be within this multiple of rimWidth of rim center to enter Path A/B tracking.
    /// 2.5× is generous — covers all reasonable shot angles including close-in layups.
    static let nearHoopXFactor: Double = 2.5

    /// Tight normalized half-width of the make zone, centered on rimCenterX.
    /// A ball confirmed below the rim must land within this X range for MAKE, else MISS.
    /// ~0.07 ≈ 7% of frame width ≈ the inner rim opening at a typical shooting distance.
    /// This is a FIXED constant — it does NOT scale with rimWidth (which can be huge for
    /// manual-tap boxes). Front-rim bounces and side misses that fall outside score MISS.
    static let makeZoneHalfWidth: Double = 0.07

    // ── Vertical engagement ───────────────────────────────────────────────────────

    /// Normalized half-height of the engagement zone around rimLineY.
    /// Ball within this distance (above OR below) of rimLineY + near X → start tracking.
    /// 0.20 catches layups approaching from below the rim as well as arcing shots from above.
    static let nearRimEngageRadius: Double = 0.20

    // ── Hoop bbox expansion ───────────────────────────────────────────────────────

    /// Hoop bbox expansion factor for Path B's lateral detection region.
    /// 0.20 = 20% larger on each side than the model bbox.
    static let hoopRegionExpansion: Double = 0.20

    // ── Path A thresholds ─────────────────────────────────────────────────────────

    /// Path A: ball must descend this far BELOW rimLineY while descending inside the make zone
    /// before a make is confirmed. Prevents a rim-kiss that reverses from scoring as a make.
    static let makeConfirmMargin: Double = 0.04

    /// Path A: abandon in-flight tracking after this many seconds with no scoring trigger.
    static let flightTimeoutSeconds: Double = 3.0

    // ── Path B thresholds ─────────────────────────────────────────────────────────

    /// Path B: frames the ball must be above the rim before a region entry can score.
    /// 1 = one frame is enough — handles fast layups at 10fps where the ball is only
    /// briefly visible above the rim before going through.
    static let pathBMinFramesAbove: Int = 1

    /// Path B: MAKE scored when ball descends this fraction of hoop height below rimLineY
    /// while within the tight make zone.
    static let pathBMakeDepthFraction: Double = 0.40

    /// Path B: reset if ball stays in region longer than this many frames.
    static let pathBMaxFramesInRegion: Int = 18

    // ── Path C thresholds ─────────────────────────────────────────────────────────

    /// Path C: max frames lost before disappearance-heuristic fires.
    static let pathCMaxDisappearanceFrames: Int = 8

    /// Path C: outer X proximity gate. Ball must have disappeared within this distance
    /// of rim center. Balls outside this range are ignored entirely.
    static let pathCHoopProximity: Double = 0.15

    // ── Shot window (net-based make/miss arbiter) ─────────────────────────────────

    /// Window stays open this long before timing out.
    static let shotWindowDurationSeconds: Double = 2.5

    /// Net interspersion threshold. MAKE requires this AND makeMotionMinimum.
    /// Raised from 0.14 after live test showed ball-at-net produced I=0.17, M=0.04.
    /// After netValMin fix (outdoor background no longer counts as "net"), false-make
    /// interspersion drops to ~0.05–0.08; real makes should still reach 0.15–0.30.
    static let makeInterspersionThreshold: Double = 0.20

    /// Minimum net motion required alongside interspersion. Ball-at-net produced M=0.04;
    /// a real make causes net to sway → M well above this floor.
    static let makeMotionMinimum: Double = 0.07

    /// Very high interspersion overrides the motion floor (fast swish, net barely moves).
    /// After background fix, reaching 0.45 means ≥16/36 cells have real ball+net overlap.
    static let makeHighInterspersionOverride: Double = 0.45

    /// Ball must have been descending (dy ≥ this) at some point during the window.
    /// Guards against balls thrown horizontally at the net (dy ≈ 0).
    static let makeMinDownwardVelocity: Double = 0.05

    // ── Cooldown ──────────────────────────────────────────────────────────────────

    /// Minimum seconds between any two scored shots.
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

    // MARK: – Shot window state (net-based make/miss arbiter)
    private var shotWindowOpen:              Bool   = false
    private var shotWindowStart:             Double = 0.0
    private var windowCandidateType:         String = "miss"
    private var windowPeakInterspersion:     Double = 0.0
    private var windowPeakMotion:            Double = 0.0
    private var windowBallBelowRimFrames:    Int    = 0
    private var windowNetPixelsSampled:      Int    = 0
    private var windowPeakDownwardVelocity:  Double = 0.0   // peak dy>0 (descending) during window
    private(set) var windowPeakInterspersionPublic: Double = 0.0

    // MARK: – Shared cooldown + counters
    private var lastShotTimestamp = 0.0
    private(set) var makes    = 0
    private(set) var attempts = 0

    // MARK: – Observability
    private(set) var scoringState = "idle — no hoop"
    private(set) var lastShotPath = "none"

    // MARK: – Interface for ATHLTCameraModule (preserves existing call sites)
    var hoopLocked:   Bool                          { hoopTracker.isLocked }
    var hoop:         CGRect?                       { hoopTracker.geometry?.bbox }
    var hoopGeometry: HoopTracker.HoopGeometry?     { hoopTracker.geometry }
    var inFlight:     Bool                          { shotWindowOpen || pathA_inFlight }
    var latestBall:   BallTracker.BallPoint?        { ballTracker.latestBall }

    func considerHoop(visionBBox: CGRect?, confidence: Float) {
        hoopTracker.ingest(visionBBox: visionBBox, confidence: confidence)
    }

    func setManualHoop(x: Double, y: Double, width: Double, height: Double) {
        hoopTracker.setManual(x: x, y: y, width: width, height: height)
    }

    // MARK: – Session management ─────────────────────────────────────────────────

    func resetSession() {
        ballTracker.resetSession()
        hoopTracker.resetSession()
        resetPathA(); resetPathB(); resetShotWindow()
        makes             = 0
        attempts          = 0
        lastShotTimestamp = 0.0
        scoringState      = "session reset — waiting for ball"
        lastShotPath      = "none"
        windowPeakInterspersionPublic = 0
        NSLog("[Pipeline] session reset — hoop locked: %@", hoopTracker.isLocked ? "YES" : "NO")
    }

    func resetAll() {
        ballTracker.resetAll()
        hoopTracker.resetAll()
        resetPathA(); resetPathB(); resetShotWindow()
        makes             = 0
        attempts          = 0
        lastShotTimestamp = 0.0
        scoringState      = "idle — no hoop"
        lastShotPath      = "none"
        windowPeakInterspersionPublic = 0
        NSLog("[Pipeline] full reset")
    }

    // MARK: – Primary update ──────────────────────────────────────────────────────
    //
    // Called once per analyzed frame from handleTrackingMode.
    // Returns (type, confidence) if a shot scored this frame, nil otherwise.

    func update(
        ball:             VNRecognizedObjectObservation?,
        basket:           VNRecognizedObjectObservation?,
        timestamp:        Double,
        netInterspersion: Double = 0,
        netMotion:        Double = 0,
        netPixelsSampled: Int    = 0
    ) -> (type: String, confidence: Double)? {

        let hoopConf = basket?.labels.first?.confidence ?? 0
        hoopTracker.ingest(visionBBox: basket?.boundingBox, confidence: hoopConf)
        ballTracker.ingest(obs: ball, timestamp: timestamp)

        guard hoopTracker.isLocked, let hoop = hoopTracker.geometry else {
            let pct = Int(hoopTracker.lockProgress * 100)
            scoringState = "no hoop locked — scoring disabled (\(pct)% accumulated)"
            resetPathA(); resetPathB(); resetShotWindow()
            return nil
        }

        let coolRemaining = Self.shotCooldownSeconds - (timestamp - lastShotTimestamp)
        if coolRemaining > 0 {
            scoringState = String(format: "cooldown — %.1fs remaining", coolRemaining)
            return nil
        }

        // ── Shot window: net is the sole make/miss arbiter ────────────────────────
        // Path A/B/C detecting a make candidate opens the window.
        // The window accumulates net-pixel signals and decides MAKE or MISS.
        // MISS signals (rim bounce, side miss, rim out) bypass the window.
        if shotWindowOpen {
            if let r = evaluateShotWindow(
                timestamp: timestamp,
                netInterspersion: netInterspersion,
                netMotion: netMotion,
                netPixelsSampled: netPixelsSampled,
                latest: ballTracker.latestBall,
                hoop: hoop
            ) {
                return registerShot(type: r.type, confidence: r.confidence,
                                    path: "Net", timestamp: timestamp)
            }
            return nil
        }

        // PATH C: fires on disappearance while Path A flight was active.
        if pathA_inFlight,
           ballTracker.framesLost >= 2,
           ballTracker.framesLost <= Self.pathCMaxDisappearanceFrames {
            if let r = evaluatePathC(hoop: hoop, timestamp: timestamp) {
                if r.type == "miss" {
                    return registerShot(type: "miss", confidence: r.confidence,
                                        path: "C", timestamp: timestamp)
                } else {
                    openShotWindow(candidateType: "make", timestamp: timestamp)
                    return nil
                }
            }
        }

        if pathA_inFlight && timestamp - pathA_flightStart > Self.flightTimeoutSeconds {
            NSLog("[PathA] timeout after %.1fs", timestamp - pathA_flightStart)
            scoringState = "Path A timeout — resetting"
            resetPathA()
        }

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
            if r.type == "miss" {
                return registerShot(type: "miss", confidence: r.confidence,
                                    path: "A", timestamp: timestamp)
            } else {
                openShotWindow(candidateType: "make", timestamp: timestamp)
                return nil
            }
        }

        // PATH B — ball through hoop region
        if let r = evaluatePathB(latest: latest, hoop: hoop, timestamp: timestamp) {
            if r.type == "miss" {
                return registerShot(type: "miss", confidence: r.confidence,
                                    path: "B", timestamp: timestamp)
            } else {
                openShotWindow(candidateType: "make", timestamp: timestamp)
                return nil
            }
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

        // Tight make-zone bounds (shown in State line so they can be verified live)
        let makeZoneMinX = rimCenterX - Self.makeZoneHalfWidth
        let makeZoneMaxX = rimCenterX + Self.makeZoneHalfWidth

        // ── FLIGHT START ──────────────────────────────────────────────────────────
        if !pathA_inFlight {
            // Broad engagement zone: ball within nearRimEngageRadius of the rim line
            // (above OR below) and within nearHoopXFactor × rimWidth laterally.
            // The Y zone covers both high-arc shots (from above) and layups (from below).
            let nearRimY = abs(ballY - rimLineY) < Self.nearRimEngageRadius
            let nearX    = abs(ballX - rimCenterX) < rimWidth * Self.nearHoopXFactor
            if nearRimY && nearX {
                pathA_inFlight    = true
                pathA_peakY       = ballY
                pathA_flightStart = timestamp
                pathA_wasRising   = vel.isRising
                pathA_peaked      = false
                if ballY >= rimLineY {
                    // Ball already below rim when flight starts — layup or close-range shot.
                    // Jump straight to awaiting state; watch for make vs miss immediately.
                    pathA_awaitingResult = true
                    NSLog("[PathA] FLIGHT START below-rim y=%.3f rimY=%.3f zone %.3f–%.3f — awaiting result",
                          ballY, rimLineY, makeZoneMinX, makeZoneMaxX)
                } else {
                    NSLog("[PathA] FLIGHT START y=%.3f rimY=%.3f x=%.3f rimX=%.3f vel.dy=%.3f zone %.3f–%.3f",
                          ballY, rimLineY, ballX, rimCenterX, vel.dy, makeZoneMinX, makeZoneMaxX)
                }
            } else {
                scoringState = String(format: "tracking (%.2f,%.2f) — engage zone rimX=%.2f±%.2f rimY=%.2f±%.2f",
                                      ballX, ballY,
                                      rimCenterX, rimWidth * Self.nearHoopXFactor,
                                      rimLineY, Self.nearRimEngageRadius)
            }
            return nil
        }

        // Track peak (smallest y = highest on screen)
        if ballY < pathA_peakY { pathA_peakY = ballY }
        if !pathA_peaked {
            if vel.isRising  { pathA_wasRising = true }
            if pathA_wasRising && vel.isFalling {
                pathA_peaked = true
                NSLog("[PathA] PEAKED y=%.3f (%.3f above rim)", pathA_peakY, rimLineY - pathA_peakY)
            }
        }

        let stillNearX = abs(ballX - rimCenterX) < rimWidth * Self.nearHoopXFactor * 1.5
        let inMakeZone = ballX >= makeZoneMinX && ballX <= makeZoneMaxX

        // ── AWAITING RESULT: ball crossed rim — watching for make or miss ──────────
        if pathA_awaitingResult {
            let belowRimEnough = ballY > rimLineY + Self.makeConfirmMargin
            // Confirmed MAKE: ball observed clearly below rim, descending, inside tight zone.
            // This is from DIRECT OBSERVATION — no regression prediction.
            let confirmedMake  = belowRimEnough && vel.isFalling && inMakeZone
            // Side miss: ball fell below rim but OUTSIDE the tight make zone.
            let sideMiss       = belowRimEnough && !inMakeZone
            // Rim bounce: ball reversed back above the rim line.
            let rimBounce      = ballY < rimLineY
            // Rim out: ball exited the broad lateral zone entirely.
            let rimOut         = !stillNearX

            if confirmedMake {
                NSLog("[PathA] MAKE — x=%.3f in zone %.3f–%.3f, %.3f below rim [observed, not predicted]",
                      ballX, makeZoneMinX, makeZoneMaxX, ballY - rimLineY)
                return scorePathA(observedX: ballX, hoop: hoop, timestamp: timestamp)
            }
            if sideMiss {
                NSLog("[PathA] MISS — x=%.3f outside make zone %.3f–%.3f (side miss / front rim)",
                      ballX, makeZoneMinX, makeZoneMaxX)
                scoringState = String(format: "MISS Path A — outside make zone x=%.3f (zone %.3f–%.3f)",
                                      ballX, makeZoneMinX, makeZoneMaxX)
                resetPathA(); resetPathB()
                return ("miss", 0.65)
            }
            if rimBounce {
                // Don't call MISS if ball is ascending near the top of frame — a layup
                // going up through the net or a ball that went through and exited upward.
                // Let it stay in awaitingResult; the window will open on confirmedMake
                // or fall back to miss after the flight timeout.
                let ascendingNearTopEdge = vel.isRising && ballY < 0.22
                if ascendingNearTopEdge {
                    NSLog("[PathA] ascending near top y=%.3f — not calling rim bounce, holding", ballY)
                    scoringState = String(format: "Path A awaiting: ascending at top y=%.3f — holding", ballY)
                    return nil
                }
                NSLog("[PathA] MISS — rim bounce (ball reversed above rim)")
                scoringState = "MISS Path A — rim bounce"
                resetPathA(); resetPathB()
                return ("miss", 0.65)
            }
            if rimOut {
                NSLog("[PathA] MISS — rim out (ball exited sideways)")
                scoringState = "MISS Path A — rim out"
                resetPathA(); resetPathB()
                return ("miss", 0.60)
            }
            scoringState = String(format: "Path A awaiting: y=%.3f x=%.3f (make %.3f–%.3f) %@",
                                  ballY, ballX, makeZoneMinX, makeZoneMaxX,
                                  vel.isFalling ? "[desc]" : "[ascending]")
            return nil
        }

        // ── Ball just reached the rim line — enter awaiting state ─────────────────
        let crossedRim = ballY >= rimLineY
        if crossedRim && stillNearX {
            pathA_awaitingResult = true
            NSLog("[PathA] rim crossed — awaiting y=%.3f rimY=%.3f make zone %.3f–%.3f",
                  ballY, rimLineY, makeZoneMinX, makeZoneMaxX)
            scoringState = String(format: "Path A awaiting: y=%.3f crossed rim (make zone %.3f–%.3f)",
                                  ballY, makeZoneMinX, makeZoneMaxX)
            return nil
        }

        // In-flight diagnostic log
        NSLog("[PathA] in-flight: ball=(%.3f,%.3f) rimY=%.3f rimX=%.3f±%.3f | crossed=%@ nearX=%@",
              ballX, ballY, rimLineY, rimCenterX, rimWidth * Self.nearHoopXFactor,
              crossedRim ? "YES" : "no", stillNearX ? "YES" : "no")
        scoringState = String(format: "Path A in-flight: y=%.3f peak=%.3f rim=%.3f %@",
                              ballY, pathA_peakY, rimLineY,
                              pathA_peaked ? "[peaked]" : (pathA_wasRising ? "[rising→]" : "[watching]"))
        return nil
    }

    private func scorePathA(
        observedX: Double,
        hoop:      HoopTracker.HoopGeometry,
        timestamp: Double
    ) -> (type: String, confidence: Double) {

        let pts    = ballTracker.recentSmoothed(within: 1.5, at: timestamp, maxCount: 7)
        let r2     = pts.count >= 3 ? ballTracker.rSquared(points: pts) : 0.5

        // Make/miss from OBSERVED ball position — ball was already confirmed below the rim
        // at observedX via direct observation, not extrapolated from regression prediction.
        let zoneMin  = hoop.rimCenterX - Self.makeZoneHalfWidth
        let zoneMax  = hoop.rimCenterX + Self.makeZoneHalfWidth
        let inside   = observedX >= zoneMin && observedX <= zoneMax
        let shotType = inside ? "make" : "miss"
        let shotConf = max(0.45, 0.45 + r2 * 0.50)

        NSLog("[PathA] %@ observedX=%.3f zone=%.3f–%.3f inside=%@ r2=%.2f conf=%.2f",
              shotType.uppercased(), observedX, zoneMin, zoneMax,
              inside ? "YES" : "NO", r2, shotConf)
        scoringState = String(format: "%@ Path A observedX=%.3f zone=%.3f–%.3f r2=%.2f",
                              shotType.uppercased(), observedX, zoneMin, zoneMax, r2)
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
        let vel      = ballTracker.velocity
        let rimLineY = hoop.rimLineY
        let rimH     = Double(hoop.bbox.height)

        let ex         = (hoop.rimMaxX - hoop.rimMinX) * Self.hoopRegionExpansion
        let regionMinX = hoop.rimMinX - ex
        let regionMaxX = hoop.rimMaxX + ex
        let aboveRim   = ballY < rimLineY
        let inXRange   = ballX >= regionMinX && ballX <= regionMaxX

        // Tight make zone used to confirm makes in Path B (same standard as Path A)
        let makeZoneMinX = hoop.rimCenterX - Self.makeZoneHalfWidth
        let makeZoneMaxX = hoop.rimCenterX + Self.makeZoneHalfWidth
        let inMakeZoneX  = ballX >= makeZoneMinX && ballX <= makeZoneMaxX

        switch pathB_phase {

        case .idle:
            if inXRange {
                if aboveRim {
                    // Classic approach from above the rim
                    pathB_phase       = .above
                    pathB_framesAbove = 1
                } else if vel.isRising {
                    // Ball below rim but rising into hoop X range — layup going up.
                    // Pre-fill framesAbove so a single above-rim frame triggers inRegion.
                    pathB_phase       = .above
                    pathB_framesAbove = Self.pathBMinFramesAbove
                }
            }

        case .above:
            if aboveRim && inXRange {
                pathB_framesAbove += 1
                scoringState = String(format: "Path B: above rim %d frame(s) y=%.3f", pathB_framesAbove, ballY)
            } else if !aboveRim && inXRange && pathB_framesAbove >= Self.pathBMinFramesAbove {
                pathB_phase          = .inRegion
                pathB_framesInRegion = 1
                NSLog("[PathB] ENTERED from above (framesAbove=%d) x=%.3f y=%.3f zone %.3f–%.3f",
                      pathB_framesAbove, ballX, ballY, makeZoneMinX, makeZoneMaxX)
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

            let makeDepth = rimLineY + rimH * Self.pathBMakeDepthFraction

            // Ball descended through the hoop — confirm make/miss by tight X zone
            if ballY >= makeDepth {
                if inMakeZoneX {
                    NSLog("[PathB] MAKE — x=%.3f in zone %.3f–%.3f, %.0f%% through hoop",
                          ballX, makeZoneMinX, makeZoneMaxX, Self.pathBMakeDepthFraction * 100)
                    scoringState = String(format: "MAKE Path B — x=%.3f zone %.3f–%.3f conf=0.82",
                                          ballX, makeZoneMinX, makeZoneMaxX)
                    resetPathA(); resetPathB()
                    return ("make", 0.82)
                } else {
                    NSLog("[PathB] MISS — through hoop region but outside make zone (x=%.3f zone %.3f–%.3f)",
                          ballX, makeZoneMinX, makeZoneMaxX)
                    scoringState = String(format: "MISS Path B — outside make zone x=%.3f (zone %.3f–%.3f)",
                                          ballX, makeZoneMinX, makeZoneMaxX)
                    resetPathA(); resetPathB()
                    return ("miss", 0.60)
                }
            }

            // Ball exited region sideways (rim-out miss)
            if !inXRange {
                NSLog("[PathB] MISS — rim out (ball left region sideways)")
                scoringState = "MISS Path B — rim out"
                resetPathA(); resetPathB()
                return ("miss", 0.65)
            }

            scoringState = String(format: "Path B: %d frames in region y=%.3f / %.3f needed (zone %.3f–%.3f)",
                                  pathB_framesInRegion, ballY, makeDepth, makeZoneMinX, makeZoneMaxX)
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

        // Ball was at or below the rim. Check X proximity (outer gate).
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

        // Apply tight make zone: ball vanished inside the make zone → MAKE (net occlusion);
        // ball vanished near rim but outside make zone → MISS (likely front-rim / side).
        let inMakeZone = dx <= Self.makeZoneHalfWidth
        if inMakeZone {
            NSLog("[PathC] MAKE — ball vanished in make zone (%.3f,%.3f) vel.dy=%.3f zone±%.3f",
                  last.x, last.y, vel.dy, Self.makeZoneHalfWidth)
            scoringState = String(format: "MAKE Path C — vanished in make zone (net occlusion) conf=0.55")
            resetPathA(); resetPathB()
            return ("make", 0.55)
        } else {
            NSLog("[PathC] MISS — vanished near rim but outside make zone (dx=%.3f zone±%.3f)",
                  dx, Self.makeZoneHalfWidth)
            scoringState = String(format: "MISS Path C — vanished outside make zone (dx=%.3f zone±%.3f)",
                                  dx, Self.makeZoneHalfWidth)
            resetPathA(); resetPathB()
            return ("miss", 0.45)
        }
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

    // MARK: – Shot window ──────────────────────────────────────────────────────
    //
    // Path A/B/C detect a make-candidate trajectory and open the window.
    // Each subsequent frame passes net-pixel signals; the window fires MAKE as
    // soon as the interspersion or motion threshold is crossed, or MISS on timeout.
    // If net sampling was unavailable (netPixelsSampled==0 throughout), falls back
    // to the trajectory candidate type — trajectory is still reliable for misses.

    private func openShotWindow(candidateType: String, timestamp: Double) {
        guard !shotWindowOpen else { return }
        shotWindowOpen               = true
        shotWindowStart              = timestamp
        windowCandidateType          = candidateType
        windowPeakInterspersion      = 0
        windowPeakMotion             = 0
        windowBallBelowRimFrames     = 0
        windowNetPixelsSampled       = 0
        // Seed downward velocity from the ball's velocity at window open time.
        // A real shot is descending when it enters the net region.
        windowPeakDownwardVelocity   = max(0.0, ballTracker.velocity.dy)
        windowPeakInterspersionPublic = 0
        NSLog("[Window] OPENED — candidate=%@ ts=%.3f entryDY=%.3f",
              candidateType, timestamp, ballTracker.velocity.dy)
        scoringState = "shot window open — net deciding (\(candidateType) candidate)"
    }

    private func resetShotWindow() {
        shotWindowOpen               = false
        shotWindowStart              = 0
        windowCandidateType          = "miss"
        windowPeakInterspersion      = 0
        windowPeakMotion             = 0
        windowBallBelowRimFrames     = 0
        windowNetPixelsSampled       = 0
        windowPeakDownwardVelocity   = 0
    }

    private func evaluateShotWindow(
        timestamp:        Double,
        netInterspersion: Double,
        netMotion:        Double,
        netPixelsSampled: Int,
        latest:           BallTracker.BallPoint?,
        hoop:             HoopTracker.HoopGeometry
    ) -> (type: String, confidence: Double)? {

        // Accumulate peak signals
        if netInterspersion > windowPeakInterspersion { windowPeakInterspersion = netInterspersion }
        if netMotion > windowPeakMotion { windowPeakMotion = netMotion }
        if netPixelsSampled > 0 { windowNetPixelsSampled = netPixelsSampled }
        windowPeakInterspersionPublic = windowPeakInterspersion

        // Track peak downward velocity — ball must be descending through net for a real make.
        let frameVel = ballTracker.velocity
        if frameVel.dy > windowPeakDownwardVelocity { windowPeakDownwardVelocity = frameVel.dy }

        // Track ball below rim for rim-bounce detection
        if let ball = latest, ball.y > hoop.rimLineY {
            windowBallBelowRimFrames += 1
        }

        // Rim bounce → immediate MISS — but NOT if ball is ascending near top of frame.
        // A layup going up through the net exits the top of frame ascending; that is NOT
        // a rim bounce. Only call MISS if ball is descending OR not near the top edge.
        if let ball = latest, ball.y < hoop.rimLineY, windowBallBelowRimFrames > 0 {
            let vel = ballTracker.velocity
            let ascendingNearTopEdge = vel.isRising && ball.y < 0.22
            if ascendingNearTopEdge {
                scoringState = String(format: "window: ascending at top (y=%.3f) — holding for net signal", ball.y)
                NSLog("[Window] ascending at top y=%.3f — holding (not rim bounce)", ball.y)
            } else {
                NSLog("[Window] MISS — rim bounce (ball above rim after %d below-rim frames)",
                      windowBallBelowRimFrames)
                scoringState = "MISS — rim bounce during shot window"
                resetShotWindow()
                return ("miss", 0.65)
            }
        }

        // Net-signal MAKE — three independent gates, all must pass.
        //
        // Gate 1 — interspersion: ball+net pixels co-located in same grid cells.
        //   Raised from 0.14 → 0.20 after live test: ball thrown AT net produced I=0.17.
        //   After netValMin fix (outdoor background no longer fakes "net"), false-make
        //   interspersion drops to ~0.05–0.08; real makes should still reach 0.15–0.30.
        //   Very high interspersion (≥0.45) overrides the motion gate (fast clean swish).
        //
        // Gate 2 — motion: net must be moving when ball passes through.
        //   Ball thrown at net → M=0.04 (net barely moves, ball bounces off).
        //   Real make → M > 0.07 (net swishes inward as ball passes).
        //
        // Gate 3 — downward velocity: ball must be descending at some point in the window.
        //   Ball thrown horizontally at net → dy ≈ 0–0.05.
        //   Real arcing shot descending through hoop → dy well above 0.05.
        if windowNetPixelsSampled > 0 {
            let enoughInterspersion = windowPeakInterspersion >= Self.makeInterspersionThreshold
            let enoughMotion        = windowPeakMotion        >= Self.makeMotionMinimum
            let highInterspersion   = windowPeakInterspersion >= Self.makeHighInterspersionOverride
            let descending          = windowPeakDownwardVelocity >= Self.makeMinDownwardVelocity

            if enoughInterspersion || highInterspersion {
                // Interspersion gate cleared — check motion and direction gates
                if !enoughMotion && !highInterspersion {
                    // Motion gate: log why we're holding (visible in scoringState on DBG panel)
                    scoringState = String(format: "make held: I=%.2f OK, M=%.2f < %.2f (motion floor)",
                                          windowPeakInterspersion, windowPeakMotion, Self.makeMotionMinimum)
                } else if !descending {
                    // Direction gate: ball wasn't moving downward
                    scoringState = String(format: "make held: I=%.2f M=%.2f OK, dy=%.2f < %.2f (need descending)",
                                          windowPeakInterspersion, windowPeakMotion,
                                          windowPeakDownwardVelocity, Self.makeMinDownwardVelocity)
                    NSLog("[Window] MAKE BLOCKED — not descending: peakDY=%.3f < %.3f",
                          windowPeakDownwardVelocity, Self.makeMinDownwardVelocity)
                } else {
                    // All gates cleared — fire MAKE
                    let conf = min(1.0,
                        windowPeakInterspersion * 0.65 +
                        windowPeakMotion        * 0.20 +
                        0.15  // trajectory baseline
                    )
                    NSLog("[Window] MAKE — intersp=%.3f motion=%.3f dy=%.3f conf=%.3f px=%d",
                          windowPeakInterspersion, windowPeakMotion, windowPeakDownwardVelocity,
                          conf, windowNetPixelsSampled)
                    scoringState = String(format: "MAKE — net I=%.2f M=%.2f conf=%.2f",
                                          windowPeakInterspersion, windowPeakMotion, conf)
                    resetShotWindow()
                    return ("make", conf)
                }
            }
        }

        // Window timeout
        let elapsed = timestamp - shotWindowStart
        if elapsed >= Self.shotWindowDurationSeconds {
            if windowNetPixelsSampled == 0 {
                // Net unavailable — fall back to trajectory
                let type = windowCandidateType
                NSLog("[Window] TIMEOUT — net unavailable (px=0) → trajectory fallback: %@", type)
                scoringState = "TIMEOUT — net unavailable → trajectory: \(type)"
                resetShotWindow()
                return (type, 0.50)
            } else {
                // Net working, no signal → ball was in front of rim
                NSLog("[Window] MISS — timeout no net signal intersp=%.3f px=%d elapsed=%.1fs",
                      windowPeakInterspersion, windowNetPixelsSampled, elapsed)
                scoringState = String(format: "MISS — no net signal after %.1fs (I=%.3f)",
                                      elapsed, windowPeakInterspersion)
                resetShotWindow()
                return ("miss", 0.55)
            }
        }

        scoringState = String(format: "window %.1fs/%.1fs peakI=%.3f px=%d",
                              elapsed, Self.shotWindowDurationSeconds,
                              windowPeakInterspersion, windowNetPixelsSampled)
        return nil
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

// ─── NetRegionAnalyzer ─────────────────────────────────────────────────────────
//
// Samples the net region below a locked hoop in a BGRA CVPixelBuffer.
// PRIMARY make signal: orange (ball) pixels interspersed with white (net cord)
// pixels in the same 6×6 grid cells proves the ball is physically inside the mesh,
// not in front of the rim — impossible to distinguish from 2D trajectory alone.
//
// Approach from: Ballogy patent US11839805B2 (net-pixel color interspersion).

final class NetRegionAnalyzer {

    // MARK: – Tuning constants ─────────────────────────────────────────────────

    // Net region geometry relative to hoop dimensions (top-left origin, y=0 top)
    static let netHeightFactor: Double = 1.0   // net depth = rimWidth × 1.0 below rim
    static let netWidthFactor:  Double = 1.1   // net slightly wider than rim opening

    // Sampling stride — 2 = denser (every other pixel), better coverage at slight perf cost
    static let sampleStride: Int = 2

    // Interspersion grid (N×N cells, ball+net in same cell = mixed)
    static let gridDivisions: Int = 6   // 6×6 = 36 cells

    // Ball-orange HSV thresholds — tuned for WORN/FADED basketball (brownish-tan, low saturation).
    // A worn ball shifts from vibrant orange toward dull brownish-tan: hue ~10–30°, low sat.
    // If b= stays near 0 on real makes, lower ballSatMin further (try 0.08) or widen hue range.
    // (hue 0–360°, saturation/value 0–1)
    static let ballHueMin: Double =  5.0   // allow dark reddish-orange (worn balls shift reddish)
    static let ballHueMax: Double = 38.0   // worn balls go brownish, not yellow — tighter top end
    static let ballSatMin: Double = 0.12   // LOW: worn/faded ball has very little color saturation
    static let ballValMin: Double = 0.18   // allow shadowed ball inside net

    // Net white/off-white HSV thresholds.
    // Live test showed outdoor trees/fence classified as "net" (n=1826, rgb≈131,140,134).
    // That gray-green has val≈0.55 and sat≈0.06 — passes old thresholds but isn't net cord.
    // Raising netValMin to 0.60 excludes dim outdoor backgrounds (val≈0.55) while keeping
    // bright net cord (val≈0.75+). Tightening netSatMax removes slightly-saturated foliage.
    static let netSatMax: Double = 0.25    // tightened from 0.35 — excludes more non-white backgrounds
    static let netValMin: Double = 0.60    // raised from 0.50 — excludes dark outdoor backgrounds (val≈0.55)

    // Motion detection — frame-to-frame delta
    static let motionChannelThreshold: Int = 22   // per-channel delta to count as "changed"
    static let minPixelsForMotion:      Int = 10   // minimum samples required

    // MARK: – Diagnostic output (all read on inferenceQueue only) ─────────────

    private(set) var lastInterspersion:  Double = 0
    private(set) var lastMotion:         Double = 0
    private(set) var lastPixelsSampled:  Int    = 0   // >0 confirms sampling is working
    private(set) var lastBallPixels:     Int    = 0
    private(set) var lastNetPixels:      Int    = 0
    private(set) var lastAvgR:           Double = 0
    private(set) var lastAvgG:           Double = 0
    private(set) var lastAvgB:           Double = 0
    private(set) var lastRegionPxX:      Int    = 0
    private(set) var lastRegionPxY:      Int    = 0
    private(set) var lastRegionPxW:      Int    = 0
    private(set) var lastRegionPxH:      Int    = 0

    private var prevNetSamples: [UInt32] = []
    private var analyzeCallCount: Int = 0

    // MARK: – Analysis ─────────────────────────────────────────────────────────

    /// Samples the net region below `hoop` and returns (interspersion, motion) ∈ [0..1].
    /// pixelBuffer must be locked with .readOnly by the caller before this call.
    func analyze(
        pixelBuffer: CVPixelBuffer,
        hoop: HoopTracker.HoopGeometry
    ) -> (interspersion: Double, motion: Double) {
        analyzeCallCount += 1

        guard let baseAddr = CVPixelBufferGetBaseAddress(pixelBuffer) else {
            zeroResult(); return (0, 0)
        }

        let bufW = CVPixelBufferGetWidth(pixelBuffer)
        let bufH = CVPixelBufferGetHeight(pixelBuffer)
        let bpr  = CVPixelBufferGetBytesPerRow(pixelBuffer)
        let bytes = baseAddr.bindMemory(to: UInt8.self, capacity: bpr * bufH)

        // Derive net region in normalized coords.
        // Net hangs BELOW the rim (larger Y = lower on screen, top-left origin).
        let halfW   = (hoop.rimWidth / 2.0) * NetRegionAnalyzer.netWidthFactor
        let netMinX = max(0.0, hoop.rimCenterX - halfW)
        let netMaxX = min(1.0, hoop.rimCenterX + halfW)
        let netMinY = hoop.rimLineY
        let netMaxY = min(1.0, hoop.rimLineY + hoop.rimWidth * NetRegionAnalyzer.netHeightFactor)

        let pxMinX = max(0,        Int(netMinX * Double(bufW)))
        let pxMaxX = min(bufW - 1, Int(netMaxX * Double(bufW)))
        let pxMinY = max(0,        Int(netMinY * Double(bufH)))
        let pxMaxY = min(bufH - 1, Int(netMaxY * Double(bufH)))

        lastRegionPxX = pxMinX; lastRegionPxY = pxMinY
        lastRegionPxW = max(0, pxMaxX - pxMinX)
        lastRegionPxH = max(0, pxMaxY - pxMinY)

        guard pxMaxX > pxMinX + 2, pxMaxY > pxMinY + 2 else {
            NSLog("[NetAnalyzer] WARN region too small: px(%d,%d)–(%d,%d) norm(%.3f,%.3f)–(%.3f,%.3f) buf=%d×%d",
                  pxMinX, pxMinY, pxMaxX, pxMaxY,
                  netMinX, netMinY, netMaxX, netMaxY, bufW, bufH)
            zeroResult(); return (0, 0)
        }

        let regionW = max(1, pxMaxX - pxMinX)
        let regionH = max(1, pxMaxY - pxMinY)
        let stride  = NetRegionAnalyzer.sampleStride
        let grid    = NetRegionAnalyzer.gridDivisions

        var cellHasBall = [Bool](repeating: false, count: grid * grid)
        var cellHasNet  = [Bool](repeating: false, count: grid * grid)
        var curSamples: [UInt32] = []
        curSamples.reserveCapacity((regionW / stride + 1) * (regionH / stride + 1))

        var sumR: Double = 0; var sumG: Double = 0; var sumB: Double = 0
        var ballCount = 0; var netCount = 0

        var py = pxMinY
        while py <= pxMaxY {
            var px = pxMinX
            while px <= pxMaxX {
                // BGRA layout: byte 0=B, 1=G, 2=R, 3=A
                let off = py * bpr + px * 4
                let b   = bytes[off]
                let g   = bytes[off + 1]
                let r   = bytes[off + 2]

                sumR += Double(r); sumG += Double(g); sumB += Double(b)

                let (h, s, v) = bgr2hsv(r: r, g: g, b: b)
                let isBall = h >= NetRegionAnalyzer.ballHueMin
                          && h <= NetRegionAnalyzer.ballHueMax
                          && s >= NetRegionAnalyzer.ballSatMin
                          && v >= NetRegionAnalyzer.ballValMin
                let isNet  = s <= NetRegionAnalyzer.netSatMax
                          && v >= NetRegionAnalyzer.netValMin

                if isBall { ballCount += 1 }
                if isNet  { netCount  += 1 }

                if isBall || isNet {
                    let cx = min(grid - 1, (px - pxMinX) * grid / regionW)
                    let cy = min(grid - 1, (py - pxMinY) * grid / regionH)
                    let ci = cy * grid + cx
                    if isBall { cellHasBall[ci] = true }
                    if isNet  { cellHasNet[ci]  = true }
                }

                curSamples.append(UInt32(b) | (UInt32(g) << 8) | (UInt32(r) << 16))
                px += stride
            }
            py += stride
        }

        let totalSampled = curSamples.count
        lastPixelsSampled = totalSampled
        lastBallPixels    = ballCount
        lastNetPixels     = netCount
        if totalSampled > 0 {
            lastAvgR = sumR / Double(totalSampled)
            lastAvgG = sumG / Double(totalSampled)
            lastAvgB = sumB / Double(totalSampled)
        } else {
            lastAvgR = 0; lastAvgG = 0; lastAvgB = 0
        }

        // Periodic diagnostic log (~every 5s at 10fps analyzed)
        if analyzeCallCount % 50 == 1 {
            NSLog("[NetAnalyzer] px=%d ball=%d net=%d rgb=(%.0f,%.0f,%.0f) reg=(%d,%d,%dx%d) buf=%dx%d",
                  totalSampled, ballCount, netCount, lastAvgR, lastAvgG, lastAvgB,
                  pxMinX, pxMinY, regionW, regionH, bufW, bufH)
        }
        if totalSampled == 0 {
            NSLog("[NetAnalyzer] WARN: 0 pixels sampled! reg=(%d,%d,%dx%d) buf=%dx%d",
                  pxMinX, pxMinY, regionW, regionH, bufW, bufH)
        }

        // ── Interspersion: fraction of cells with BOTH ball and net pixels ─────
        var mixedCells = 0
        for i in 0..<(grid * grid) {
            if cellHasBall[i] && cellHasNet[i] { mixedCells += 1 }
        }
        let interspersion = Double(mixedCells) / Double(grid * grid)

        // ── Motion: fraction of sampled pixels that changed vs previous frame ──
        var motion = 0.0
        let n = min(curSamples.count, prevNetSamples.count)
        if n >= NetRegionAnalyzer.minPixelsForMotion {
            var changed = 0
            for i in 0..<n {
                let cur  = curSamples[i]
                let prev = prevNetSamples[i]
                let db = abs(Int(cur & 0xFF)         - Int(prev & 0xFF))
                let dg = abs(Int((cur >> 8)  & 0xFF) - Int((prev >> 8)  & 0xFF))
                let dr = abs(Int((cur >> 16) & 0xFF) - Int((prev >> 16) & 0xFF))
                if db > NetRegionAnalyzer.motionChannelThreshold
                || dg > NetRegionAnalyzer.motionChannelThreshold
                || dr > NetRegionAnalyzer.motionChannelThreshold {
                    changed += 1
                }
            }
            motion = Double(changed) / Double(n)
        }
        prevNetSamples = curSamples

        lastInterspersion = interspersion
        lastMotion        = motion
        return (interspersion, motion)
    }

    // MARK: – Helpers ──────────────────────────────────────────────────────────

    private func zeroResult() {
        lastInterspersion = 0; lastMotion = 0
        lastPixelsSampled = 0; lastBallPixels = 0; lastNetPixels = 0
        lastAvgR = 0; lastAvgG = 0; lastAvgB = 0
        prevNetSamples = []
    }

    private func bgr2hsv(r: UInt8, g: UInt8, b: UInt8) -> (h: Double, s: Double, v: Double) {
        let rf = Double(r) / 255.0
        let gf = Double(g) / 255.0
        let bf = Double(b) / 255.0

        let cmax  = max(rf, gf, bf)
        let cmin  = min(rf, gf, bf)
        let delta = cmax - cmin

        let v = cmax
        let s = cmax > 1e-6 ? delta / cmax : 0.0

        var h = 0.0
        if delta > 1e-6 {
            if cmax == rf {
                h = 60.0 * ((gf - bf) / delta)
                if h < 0 { h += 360.0 }
            } else if cmax == gf {
                h = 60.0 * ((bf - rf) / delta + 2.0)
            } else {
                h = 60.0 * ((rf - gf) / delta + 4.0)
            }
        }

        return (h, s, v)
    }

    func reset() {
        lastInterspersion = 0; lastMotion = 0
        lastPixelsSampled = 0; lastBallPixels = 0; lastNetPixels = 0
        lastAvgR = 0; lastAvgG = 0; lastAvgB = 0
        lastRegionPxX = 0; lastRegionPxY = 0; lastRegionPxW = 0; lastRegionPxH = 0
        prevNetSamples = []
        analyzeCallCount = 0
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
    private let pipeline    = BallTrackingPipeline()

    // MARK: – Net region analysis (all accessed on inferenceQueue only)
    private let netAnalyzer           = NetRegionAnalyzer()
    private var lastNetInterspersion:  Double = 0
    private var lastNetMotion:         Double = 0
    private var lastNetPixelsSampled:  Int    = 0
    private var lastMakeConfidence:    Double = 0

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
                self.netAnalyzer.reset()
                self.isTracking              = true
                self.currentMode             = "tracking"
                // Reset debug stat counters for this session
                self.totalBallDetections     = 0
                self.totalHoopDetections     = 0
                self.peakBallConfidence      = 0.0
                self.peakHoopConfidence      = 0.0
                self.lastDebugStatsTime      = 0.0
                self.totalFramesAnalyzed     = 0
                self.lastRawObsClass         = "none"
                self.lastRawObsConf          = 0.0
                self.lastNetInterspersion    = 0
                self.lastNetMotion           = 0
                self.lastNetPixelsSampled    = 0
                self.lastMakeConfidence      = 0
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

        // ── Net region analysis — same pixel buffer, same frame ──────────────────
        // Run BEFORE processObservations so net signals are ready when handleTrackingMode
        // calls pipeline.update(). Only during tracking when hoop is locked.
        if currentMode == "tracking", pipeline.hoopLocked, let geo = pipeline.hoopGeometry {
            let (intersp, motion) = netAnalyzer.analyze(pixelBuffer: pixelBuffer, hoop: geo)
            lastNetInterspersion = intersp
            lastNetMotion        = motion
            lastNetPixelsSampled = netAnalyzer.lastPixelsSampled
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
        let minConf: Float = 0.35   // aligned with HoopTracker.lockConfThreshold
        var bestBasket: VNRecognizedObjectObservation?
        var bestConf:   Float = 0

        for obs in observations {
            guard let top = obs.labels.first else { continue }
            if ATHLTCameraModule.isBasketClass(top.identifier) && top.confidence >= minConf {
                if top.confidence > bestConf { bestBasket = obs; bestConf = top.confidence }
            }
        }

        // Always feed hoop evidence to the tracker — passing nil when no hoop detected
        // lets HoopTracker reset its accumulation counter on missed frames, which is
        // required for the "N consecutive frames" lock protocol to work correctly.
        pipeline.considerHoop(visionBBox: bestBasket?.boundingBox, confidence: bestConf)

        guard let found = bestBasket else { return }

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

        // Feed to pipeline — net params were captured in runInference this same frame
        if let result = pipeline.update(
            ball: ball, basket: basket, timestamp: timestamp,
            netInterspersion: lastNetInterspersion,
            netMotion: lastNetMotion,
            netPixelsSampled: lastNetPixelsSampled
        ) {
            if result.type == "make" { lastMakeConfidence = result.confidence }
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

        // Net region in normalized coords — same geometry formula as NetRegionAnalyzer.analyze().
        // Computed from hoop geometry whenever the hoop is locked (even in detection mode)
        // so the JS overlay can show the net zone BEFORE tracking starts for placement verification.
        var netNormX = -1.0
        var netNormY = -1.0
        var netNormW =  0.0
        var netNormH =  0.0
        if let geo = pipeline.hoopGeometry {
            let halfW  = (geo.rimWidth / 2.0) * NetRegionAnalyzer.netWidthFactor
            let nMinX  = max(0.0, geo.rimCenterX - halfW)
            let nMaxX  = min(1.0, geo.rimCenterX + halfW)
            let nMinY  = geo.rimLineY
            let nMaxY  = min(1.0, geo.rimLineY + geo.rimWidth * NetRegionAnalyzer.netHeightFactor)
            netNormX   = nMinX
            netNormY   = nMinY
            netNormW   = nMaxX - nMinX
            netNormH   = nMaxY - nMinY
        }

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
            // Net-region analysis
            "netInterspersion":    lastNetInterspersion,
            "netMotion":           lastNetMotion,
            "makeConfidence":      lastMakeConfidence,
            // Net diagnostics (tell us if sampling is working)
            "netPixelsSampled":    netAnalyzer.lastPixelsSampled,
            "netBallPixels":       netAnalyzer.lastBallPixels,
            "netNetPixels":        netAnalyzer.lastNetPixels,
            "netAvgR":             netAnalyzer.lastAvgR,
            "netAvgG":             netAnalyzer.lastAvgG,
            "netAvgB":             netAnalyzer.lastAvgB,
            "netRegionPxX":        netAnalyzer.lastRegionPxX,
            "netRegionPxY":        netAnalyzer.lastRegionPxY,
            "netRegionPxW":        netAnalyzer.lastRegionPxW,
            "netRegionPxH":        netAnalyzer.lastRegionPxH,
            // Normalized net region coords — available whenever hoop is locked.
            // Use these for the JS overlay box; -1 means no hoop locked.
            "netRegionNormX":      netNormX,
            "netRegionNormY":      netNormY,
            "netRegionNormW":      netNormW,
            "netRegionNormH":      netNormH,
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

