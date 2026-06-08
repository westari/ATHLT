# Shot Detection Algorithm — ATHLT CV Pipeline

**Last updated:** 2026-06-08  
**File:** `modules/athlt-camera/ios/ATHLTCameraModule.swift`

---

## Architecture overview

```
Camera frame (30fps)
    │  frameSkip = 3  (~10fps analyzed)
    ▼
runInference()          ← CoreML YOLO11n on pixel buffer
    │
    ▼
processObservations()   ← class matching, best ball + best basket extracted
    │
    ├── handleDetectionMode()   ← hoop lock via HoopTracker (before session starts)
    └── handleTrackingMode()    ← full pipeline during session
            │
            ▼
        BallTrackingPipeline.update(ball:basket:timestamp:)
            │
            ├── HoopTracker.ingest()    ← always updates
            ├── BallTracker.ingest()    ← always updates
            │
            ├── PATH C check            ← ball disappeared while A in-flight?
            ├── PATH A evaluate/score   ← trajectory arc
            └── PATH B evaluate         ← ball through hoop region
```

---

## HoopTracker

**Purpose:** Lock the hoop position once, keep it stable throughout the session.

**Lock protocol:**
1. Each frame with a basket detection calls `ingest(visionBBox:confidence:)`.
2. Requires `lockConsecutiveRequired = 5` consecutive frames at `lockConfThreshold ≥ 0.35`.
3. If the candidate position jumps `> candidateJumpThreshold (0.12)` normalized distance between frames, the counter resets — a different object was seen.
4. When 5 consistent frames accumulate, the lock commits. Vision coords (bottom-left origin) are converted to top-left at ingestion.

**Post-lock EMA smoothing:**
After lock, each new basket detection updates geometry with EMA `alpha = 0.10`. This suppresses jitter on a handheld phone while keeping the lock valid if the camera slowly drifts.

**Re-lock detection:**
If `relockConsecutiveRequired = 8` consecutive detections appear `> relockDistanceThreshold (0.20)` away from the locked position, the tracker un-locks and re-accumulates. Handles deliberate camera repositioning mid-session.

**Staleness:**
If no basket detection arrives for `staleFrameThreshold = 30` frames (~3s at 10fps), `isStale` is set. The locked geometry is still used — it doesn't evaporate. `isStale` is exposed for UI warning ("camera moved?").

**Manual override:**
`setManual(x:y:width:height:)` locks immediately, marking `isManual = true`. Survives re-lock detection (manual can only be overridden by another manual call).

**Key derived geometry** (computed at lock time and on EMA updates):
- `rimLineY` = `bbox.minY` — the actual rim opening (top of hoop bbox). **Critical: not bbox.midY.**
- `rimMinX`, `rimMaxX`, `rimCenterX`, `rimWidth` — horizontal rim bounds

---

## BallTracker

**Purpose:** Maintain a clean, noise-rejected ball position history.

**Entry gate (persistence):**
`entryConsecutiveRequired = 3` frames at `entryConfidence ≥ 0.40` before positions enter the buffer. Eliminates single-frame false positives (orange jerseys, logo circles, etc). The jump filter stays calibrated during this window — `framesLost` is reset each time a frame passes confidence threshold.

**Track maintenance:**
Once established, `trackConfidence = 0.25` floor is used. When ball isn't detected, `framesLost` increments. At `trackDeathFrames = 12` consecutive missed frames, the track dies (`isEstablished = false`, `framesLost` reset). The buffer is **not** cleared on track death — Path C needs `latestBall` to check the disappearance location.

**Jump rejection:**
Euclidean distance between new position and `buffer.last` must be `≤ jumpThreshold (0.35)`. If `framesLost ≥ lostFramesForRelaxedJump (4)`, the threshold relaxes to `reacquireJumpThreshold (0.55)` — the ball may legitimately reappear after 4 lost frames at a larger offset.

**Buffer:** Rolling `bufferMax = 90` frames, entries older than `ageSeconds = 5.0` pruned each frame.

**Velocity:** Computed over the last `velocityWindowFrames = 5` frames. `dy < -0.05` = rising (y decreasing in top-left coords). `dy > 0.05` = falling. `speed > 0.10` = significant movement.

**Utility methods:**
- `smoothedPositions()` — 3-frame moving average of entire buffer
- `recentSmoothed(within:at:maxCount:)` — recent N seconds, smoothed, capped
- `predictXAtY(points:targetY:)` — OLS linear regression (see below)
- `rSquared(points:)` — goodness-of-fit for confidence scoring
- `bboxSizeTrend(frames:)` — positive = ball growing = coming toward camera

---

## Linear regression (OLS) — predictXAtY

Fits two independent linear models over `n` tracked positions:

```
y(t) = m_y · t + b_y
x(t) = m_x · t + b_x
```

Solves for `t` when `y(t) = targetY`:

```
t_cross = (targetY − b_y) / m_y
x_cross = m_x · t_cross + b_x
```

This gives the predicted ball X when it crosses any target Y. Used in Path A to find where the ball passed through the rim line (`rimLineY`) even if no frame happened to land exactly there.

Returns `buffer.last.x` as fallback when regression is degenerate (fewer than 2 points, all same timestamp, etc).

---

## R² — shot confidence

Fits `y(t)` and computes:

```
R² = 1 − SS_res / SS_tot
```

Maps to shot confidence: `conf = max(0.45, 0.45 + R² × 0.50)` → range [0.45, 0.95].

| R²   | Meaning                         | Confidence |
|------|---------------------------------|------------|
| 0.95 | Clean linear descent            | ~0.93      |
| 0.70 | Some noise, still consistent    | ~0.80      |
| 0.40 | Noisy / scattered               | ~0.65      |
| 0.10 | Very noisy — possible false pos | ~0.50      |

Shots below `0.60` should be flagged as unverified in the UI.

---

## PATH A — Trajectory arc (primary path)

**Concept:** Real basketball shots have an arc. The ball rises above the rim, peaks, then descends through the opening. Path A detects this arc using velocity phase transitions.

**Flight entry conditions:**
- `ballY < rimLineY + launchToleranceY (0.04)` — ball at or above rim
- `abs(ballX − rimCenterX) < rimWidth × nearHoopXFactor (2.5)` — near hoop laterally
- `!pathA_inFlight` — not already in a flight

**While in flight:**
- `pathA_peakY` tracks the minimum y seen (highest point on screen)
- Phase transitions: `pathA_wasRising = true` when `vel.isRising`, then `pathA_peaked = true` when `vel.isFalling` after having been rising

**Scoring trigger:**
```
ball.y >= rimLineY          // ball descended to rim opening
peakY  < rimLineY − 0.03   // ball actually peaked above rim (minimum arc)
abs(ballX − rimCenterX) < rimWidth × nearHoopXFactor × 1.5  // still near hoop
```

**Make/miss:** `predictXAtY` over last 7 smoothed positions → `inside = abs(crossX − rimCenterX) ≤ rimWidth × 0.55`.

**Why `rimLineY` not `rimMidY` (the critical fix):**
The previous implementation scored at `hoopMidY` (center of hoop bbox). At 10fps, a fast shot can skip from above the rim to well below center in a single frame, bypassing the trigger entirely. `rimLineY` (top of bbox = actual rim opening) is the correct and earlier trigger — the ball crosses it on every real shot.

**Timeout:** `flightTimeoutSeconds = 3.0` — flight is aborted if ball doesn't score within 3s.

---

## PATH B — Ball through hoop region (secondary path)

**Concept:** Catches shots where Path A's regression can't compute a clean cross (too few points above rim, very fast release). Directly observes the ball entering the hoop column from above.

**Phase machine:**

```
idle → above → inRegion → SCORE / RESET
```

- **idle → above:** Ball appears above rim (`ballY < rimLineY`) within the expanded hoop X range (`rimMinX − 20%` to `rimMaxX + 20%`)
- **above → inRegion:** Ball descends below `rimLineY` while still in X range, after `pathBMinFramesAbove = 2` frames above. If it exits X range while above, resets to idle.
- **inRegion:**
  - Ball rises back above rim → **MISS** (0.70 conf) — rim bounce
  - Ball exits X range sideways → **MISS** (0.65 conf) — rim-out
  - Ball descends to `rimLineY + rimHeight × 0.40` while in X range → **MAKE** (0.82 conf) — through net
  - `> pathBMaxFramesInRegion (18)` frames → timeout, reset

---

## PATH C — Disappearance heuristic (tertiary path)

**Concept:** Ball sometimes vanishes when it drops into the net (net temporarily occludes it). If Path A was in-flight and the ball disappears within `pathCMaxDisappearanceFrames = 8` frames, and the last known position was near the rim, assume MAKE.

**Conditions:**
- `pathA_inFlight = true`
- `ballTracker.framesLost` between 2 and 8
- `latestBall.x` within `pathCHoopProximity (0.15)` of `rimCenterX`
- `latestBall.y` within `pathCHoopProximity (0.15)` of `rimLineY`
- `latestBall.y ≤ rimLineY + 0.06` (ball was at or above rim level when it disappeared)

**Output:** `("make", 0.55)` — lowest confidence of the three paths. Treat as unverified until corroborated by match count across many shots.

---

## Shared cooldown

`shotCooldownSeconds = 1.5` — after any shot (any path), all paths are suppressed for 1.5s. Prevents double-counting the same ball's continued travel through and below the hoop.

---

## Coordinate system

All internal pipeline coordinates are **top-left origin, normalized [0, 1]**:
- `x = 0.0` is left edge, `x = 1.0` is right edge
- `y = 0.0` is top edge, `y = 1.0` is bottom edge
- **y increases downward** — a ball ABOVE the rim has a SMALLER y than the rim

Vision framework uses **bottom-left origin**. Conversion happens once at ingestion in `BallTracker.ingest()`:
```swift
let y = 1.0 - Double(bb.midY)   // flip Vision bottom-left → top-left
```

HoopTracker converts its Vision bbox in `lockHoop()` and `setManual()`.

---

## FPS and threading

`frameSkip = 3` → ~10fps analyzed from 30fps camera output (was 6 → ~5fps before this rewrite).

Threading model:
- Camera frames arrive on `sessionQueue` (serial)
- `guard frameCounter % frameSkip == 0` throttles inline on `sessionQueue`
- `inferenceQueue.async` dispatches the pixel buffer for CoreML inference
- All pipeline state (`BallTrackingPipeline`, `HoopTracker`, `BallTracker`) is only ever accessed from within `inferenceQueue`
- `sendEvent()` is thread-safe (ExpoModulesCore handles marshaling)

---

## Observability

Every frame's pipeline state is summarized in `pipeline.scoringState` (a plain string). Emitted in `onDebugStats` once per second. Format examples:

```
idle — no hoop (60% accumulated)
waiting for ball (3 consecutive frames needed)
tracking (0.42,0.38) — not near rim [rimX=0.51 ±0.22]
Path A: y=0.18 peak=0.14 rim=0.22 [rising→]
Path A: y=0.21 peak=0.14 rim=0.22 [peaked]
MAKE Path A crossX=0.498 r2=0.87 conf=0.89
Path B: above rim 3 frames y=0.19
Path B: in hoop region — watching for through or bounce
MAKE Path B — 40% through hoop conf=0.82
MAKE Path C — ball vanished near rim (net occlusion) conf=0.55
cooldown — 1.2s remaining
```

`lastShotPath` retains `"A"`, `"B"`, or `"C"` after each shot for debug filtering.

---

## Named constants reference

| Constant | Value | Location | Meaning |
|---|---|---|---|
| `HoopTracker.lockConfThreshold` | 0.35 | HoopTracker | Min confidence to accumulate toward lock |
| `HoopTracker.lockConsecutiveRequired` | 5 | HoopTracker | Frames required for lock |
| `HoopTracker.emaAlpha` | 0.10 | HoopTracker | Post-lock smoothing weight |
| `HoopTracker.staleFrameThreshold` | 30 | HoopTracker | Frames before isStale flag |
| `HoopTracker.relockDistanceThreshold` | 0.20 | HoopTracker | Distance triggering re-lock |
| `HoopTracker.relockConsecutiveRequired` | 8 | HoopTracker | Frames far away before re-locking |
| `HoopTracker.candidateJumpThreshold` | 0.12 | HoopTracker | Max candidate jump during accumulation |
| `BallTracker.entryConfidence` | 0.40 | BallTracker | Min conf during entry gate |
| `BallTracker.trackConfidence` | 0.25 | BallTracker | Min conf once established |
| `BallTracker.entryConsecutiveRequired` | 3 | BallTracker | Consecutive frames for establishment |
| `BallTracker.jumpThreshold` | 0.35 | BallTracker | Max normal jump distance |
| `BallTracker.reacquireJumpThreshold` | 0.55 | BallTracker | Relaxed jump after 4+ lost frames |
| `BallTracker.lostFramesForRelaxedJump` | 4 | BallTracker | Lost frames before threshold relaxes |
| `BallTracker.trackDeathFrames` | 12 | BallTracker | Consecutive misses before track dies |
| `BallTracker.bufferMax` | 90 | BallTracker | Max positions in rolling buffer |
| `BallTracker.ageSeconds` | 5.0 | BallTracker | Max age of buffered points |
| `BallTracker.velocityWindowFrames` | 5 | BallTracker | Frames used for velocity estimate |
| `BallTrackingPipeline.hoopRegionExpansion` | 0.20 | Pipeline | Path B X-range expansion (each side) |
| `BallTrackingPipeline.nearHoopXFactor` | 2.5 | Pipeline | Path A X-range as multiple of rim width |
| `BallTrackingPipeline.launchToleranceY` | 0.04 | Pipeline | Path A: how far below rim to allow flight start |
| `BallTrackingPipeline.minimumPeakAboveRim` | 0.03 | Pipeline | Path A: min arc height above rim |
| `BallTrackingPipeline.flightTimeoutSeconds` | 3.0 | Pipeline | Path A: max time before aborting flight |
| `BallTrackingPipeline.makeTolerance` | 0.55 | Pipeline | Path A: make window as multiple of rim width |
| `BallTrackingPipeline.pathBMinFramesAbove` | 2 | Pipeline | Path B: frames above rim before entry |
| `BallTrackingPipeline.pathBMakeDepthFraction` | 0.40 | Pipeline | Path B: depth into hoop for MAKE |
| `BallTrackingPipeline.pathBMaxFramesInRegion` | 18 | Pipeline | Path B: max frames in region before timeout |
| `BallTrackingPipeline.pathCMaxDisappearanceFrames` | 8 | Pipeline | Path C: max frames lost for disappearance |
| `BallTrackingPipeline.pathCHoopProximity` | 0.15 | Pipeline | Path C: max distance from rim for disappearance |
| `BallTrackingPipeline.shotCooldownSeconds` | 1.5 | Pipeline | Shared cooldown between any two shots |
| `frameSkip` | 3 | ATHLTCameraModule | 1 in N frames analyzed (~10fps from 30fps) |
