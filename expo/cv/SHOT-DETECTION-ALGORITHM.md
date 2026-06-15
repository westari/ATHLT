# Shot Detection Algorithm — ATHLT CV Pipeline

**Last updated:** 2026-06-08 — accuracy overhaul (all 6 confirmed bugs fixed)  
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
    ├── handleDetectionMode()   ← hoop lock via HoopTracker (runs from model-load onward)
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

## Two engagement zones — critical design distinction

The pipeline separates TRACKING engagement from MAKE confirmation:

| Zone | Width | Purpose |
|------|-------|---------|
| **Broad engagement** (`nearHoopXFactor × rimWidth` laterally, `nearRimEngageRadius` vertically) | ~±wide | Decides: "is a shot happening near the hoop?" — triggers Path A/B evaluation. Generous so layups, runners, close shots all get tracked. |
| **Tight make zone** (`makeZoneHalfWidth = 0.07` fixed) | ±0.07 of frame width | Confirms: "did the ball go through the rim opening?" — required for MAKE. Never scales with the hoop bbox, so a large manual-tap box doesn't produce a huge make zone. |

Front-rim bounces, side misses, and off-center balls that fall below the rim OUTSIDE the tight make zone score as MISS regardless of which path detected them.

---

## HoopTracker

**Purpose:** Lock the hoop position once, keep it stable throughout the session.

**Auto-lock (Bug 6 fix):**
- Mode automatically set to `"detection"` when model loads (`doLoadModel`)
- `handleDetectionMode` ALWAYS calls `pipeline.considerHoop(visionBBox:confidence:)` — nil when no hoop detected this frame. Nil calls reset the accumulation counter, so consecutive-frame requirement is properly enforced.
- `lockConfThreshold` raised to 0.45 (and `minConf` in `handleDetectionMode` raised to match). The real Bug 6 fix was the nil-passing fix; now that that's working, the threshold is back to a stricter value to prevent auto-locking on random objects.

**Lock protocol:**
1. Each frame with a basket detection calls `ingest(visionBBox:confidence:)`.
2. Requires `lockConsecutiveRequired = 5` consecutive frames at `lockConfThreshold ≥ 0.30`.
3. If the candidate position jumps `> candidateJumpThreshold (0.12)` between frames, accumulation resets.
4. When 5 frames accumulate, the lock commits with the average position.

**Post-lock EMA smoothing:** `alpha = 0.10`. Suppresses jitter while tracking slow camera drift.

**Re-lock:** If `relockConsecutiveRequired = 8` frames are consistently far (`> relockDistanceThreshold = 0.20`) from the locked position, the tracker unlocks and re-accumulates.

**Key derived geometry:**
- `rimLineY` = `bbox.minY` — top edge of hoop bbox = the actual rim opening
- `rimMinX`, `rimMaxX`, `rimCenterX`, `rimWidth` — horizontal rim bounds from the bbox

**Make zone geometry:** The make zone is `rimCenterX ± makeZoneHalfWidth (0.07)` — a FIXED constant, NOT derived from `rimWidth`. This means a large manual-tap box still produces a realistic tight make zone.

---

## BallTracker

**Purpose:** Maintain a clean, noise-rejected ball position history.

**Entry gate (Bug 2 fix — 2-of-3 sliding window):**
Two paths to establish a track:
1. **High-confidence single frame:** `conf >= highConfEntryThreshold (0.60)` → established immediately. Catches fast shots that are only visible 1–2 frames near the rim.
2. **2-of-3 sliding window:** 2 of the last 3 gate-window frames pass `entryConfidence ≥ 0.40` (not required to be consecutive). A single missed frame between two detections no longer resets the gate.

**Track maintenance:** `trackConfidence = 0.25` floor once established. Track dies after `trackDeathFrames = 12` consecutive missed frames. Buffer NOT cleared on death (Path C needs `latestBall`).

**Jump rejection:** Max `jumpThreshold = 0.35` between consecutive positions. Relaxes to `reacquireJumpThreshold = 0.55` when `framesLost >= 4`.

**Buffer:** Rolling `bufferMax = 90` frames, entries older than `ageSeconds = 5.0` pruned.

**Velocity:** Over last `velocityWindowFrames = 5` frames. `dy < -0.05` = rising, `dy > 0.05` = falling.

---

## PATH A — Trajectory arc (primary path)

**Engagement (broad zone, Bug 4 fix for layups):**
- `abs(ballY - rimLineY) < nearRimEngageRadius (0.20)` — ball within 20% of frame height of rim line, above OR below
- `abs(ballX - rimCenterX) < rimWidth × nearHoopXFactor (2.5)` — near hoop laterally
- If ball is ALREADY below rim when flight starts (layup / close approach) → immediately enters awaiting state

**While in flight:**
- `pathA_peakY` tracks the minimum y seen (highest on screen)
- Phase transitions tracked for observability; no longer gate the make/miss decision

**Rim crossing → awaiting state:**
When `ballY >= rimLineY` AND ball still near X → set `pathA_awaitingResult = true`. No scoring happens at rim crossing — this was Bug 3.

**Awaiting result state machine (Bug 2, 3 fixes):**

| Observation | Action |
|-------------|--------|
| `ballY > rimLineY + makeConfirmMargin (0.04)` AND `vel.isFalling` AND `inMakeZone` | **MAKE** (0.45–0.95 conf) |
| `ballY > rimLineY + makeConfirmMargin` AND `!inMakeZone` | **MISS** (0.65) — side miss / front rim |
| `ballY < rimLineY` | **MISS** (0.65) — rim bounce |
| Ball exits broad X zone | **MISS** (0.60) — rim out |

**Make/miss from OBSERVATION, not prediction (Bug 2 fix):**
`scorePathA(observedX:)` uses the ball's ACTUAL observed X position when confirmed below the rim, NOT regression `predictXAtY`. The regression R² still contributes to confidence scoring.

**Timeout:** `flightTimeoutSeconds = 3.0`

---

## PATH B — Ball through hoop region (secondary path)

**Phase machine:**
```
idle → above → inRegion → SCORE / RESET
```

**Layup support (Bug 4 fix):**
- `pathBMinFramesAbove` reduced from 2 → 1: one frame above the rim before region entry is enough at 10fps
- Idle → above also triggers when ball is BELOW rim but rising into hoop X range (`vel.isRising`) — ball pre-counted as having satisfied above-frame requirement, so next above-rim detection triggers inRegion

**Make zone in inRegion (Bug 1 fix):**
- `ballY >= rimLineY + rimH × 0.40` AND `inMakeZoneX` → **MAKE** (0.82)
- `ballY >= rimLineY + rimH × 0.40` AND `!inMakeZoneX` → **MISS** (0.60) — outside tight zone
- Ball rises back above rim → **MISS** (0.70) — bounce
- Ball exits X range → **MISS** (0.65) — rim out
- > 18 frames in region → timeout, reset

---

## PATH C — Disappearance heuristic (tertiary path)

**Concept:** Ball sometimes vanishes into the net (occlusion). If Path A was in-flight and ball disappears near the rim from BELOW, assume MAKE.

**Conditions:**
1. `pathA_inFlight = true`
2. `framesLost` between 2 and 8
3. `last.y >= rimLineY` — ball's last known position AT or BELOW rim (Bug 1 fix: if ball vanished above rim, ignore without resetting Path A — ball may still arc down)
4. `vel.isFalling` — was moving downward
5. `abs(last.x - rimCenterX) <= pathCHoopProximity (0.15)` — outer X gate

**Make zone applied (Bug 1 fix):**
- `dx <= makeZoneHalfWidth (0.07)` → **MAKE** (0.55) — disappeared inside tight zone = net occlusion
- `dx > makeZoneHalfWidth` but `<= pathCHoopProximity` → **MISS** (0.45) — near rim but outside zone = likely front-rim

**No cooldown on upward exit:** If ball vanished above rim, Path A state is preserved (no `resetPathA`) — ball may return on descent.

---

## Shared cooldown

`shotCooldownSeconds = 1.0` — shortened from 1.5s since the tight make zone and observation-only scoring produce fewer false triggers. After any scored shot, all paths suppressed for 1.0s.

---

## Coordinate system

All internal pipeline coordinates: **top-left origin, normalized [0, 1]**:
- `y = 0.0` is top edge, `y = 1.0` is bottom edge
- **y increases downward** — ball ABOVE rim has SMALLER y than rim
- Ball below rim (through net): `ballY > rimLineY`

Vision framework uses bottom-left origin. Conversion in `BallTracker.ingest()`:
```swift
let y = 1.0 - Double(bb.midY)
```

### Camera orientation
`VNImageRequestHandler(cvPixelBuffer: ..., orientation: .up, options: [:])` — no rotation. Buffer is already landscape from `conn.videoOrientation = .landscapeRight`. Using `.right` would rotate 90° CCW internally, swapping X/Y.

### Manual hoop tap coordinate chain
Screen tap → `open-run.tsx` normalizes to top-left [0,1] → `setManualHoopRegion(bx, by, w, h)` → Swift `HoopTracker.setManual()` → `makeGeometry()` → `rimLineY = tl.minY`.

The make zone (`rimCenterX ± 0.07`) is independent of the tap box size — a wide tap box doesn't widen the make zone.

---

## FPS and threading

`frameSkip = 3` → ~10fps from 30fps camera.

- Camera frames on `sessionQueue` (serial)
- Throttle on `sessionQueue`, then `inferenceQueue.async` for CoreML
- All pipeline state only accessed from `inferenceQueue`
- `sendEvent()` is thread-safe (ExpoModulesCore handles marshaling)

---

## Observability — State line format

```
tracking (0.42,0.38) — engage zone rimX=0.51±0.22 rimY=0.31±0.20
Path A in-flight: y=0.18 peak=0.14 rim=0.31 [rising→]
Path A in-flight: y=0.24 peak=0.14 rim=0.31 [peaked]
Path A awaiting: y=0.32 crossed rim (make zone 0.57–0.71)
Path A awaiting: y=0.34 x=0.64 (make 0.57–0.71) [desc]
MAKE Path A observedX=0.63 zone=0.57–0.71 r2=0.87
MISS Path A — outside make zone x=0.77 (zone 0.57–0.71)
MISS Path A — rim bounce
MISS Path A — rim out
Path B: above rim 1 frame(s) y=0.28
Path B: in hoop region — watching for through or bounce
MAKE Path B — x=0.64 zone 0.57–0.71 conf=0.82
MISS Path B — outside make zone x=0.77 (zone 0.57–0.71)
MISS Path B — bounced back above rim
Path C ignored — ball exited upward (y=0.12)
Path C ignored — vanished near rim without downward motion
MAKE Path C — vanished in make zone (net occlusion) conf=0.55
MISS Path C — vanished outside make zone (dx=0.11 zone±0.07)
cooldown — 0.8s remaining
waiting for ball (2-of-3 frames or high-conf)
no hoop locked — scoring disabled (60% accumulated)
```

The make zone bounds (`0.57–0.71` in the examples) are shown numerically so you can immediately verify tightness vs the old ±0.30.

---

## Named constants reference

| Constant | Value | Location | Meaning |
|---|---|---|---|
| `HoopTracker.lockConfThreshold` | **0.45** | HoopTracker | Min conf per frame (aligned with detection pre-filter) |
| `HoopTracker.lockConsecutiveRequired` | 5 | HoopTracker | Frames required for auto-lock |
| `HoopTracker.emaAlpha` | 0.10 | HoopTracker | Post-lock EMA smoothing weight |
| `HoopTracker.staleFrameThreshold` | 30 | HoopTracker | Frames before isStale flag |
| `HoopTracker.relockDistanceThreshold` | 0.20 | HoopTracker | Distance triggering re-lock |
| `HoopTracker.relockConsecutiveRequired` | 8 | HoopTracker | Frames far away before re-locking |
| `HoopTracker.candidateJumpThreshold` | 0.12 | HoopTracker | Max candidate jump during accumulation |
| `BallTracker.entryConfidence` | 0.40 | BallTracker | Min conf during 2-of-3 gate window |
| `BallTracker.trackConfidence` | 0.25 | BallTracker | Min conf once established |
| `BallTracker.highConfEntryThreshold` | 0.60 | BallTracker | Single-frame conf for immediate establishment |
| `BallTracker.jumpThreshold` | 0.35 | BallTracker | Max normal jump distance |
| `BallTracker.reacquireJumpThreshold` | 0.55 | BallTracker | Relaxed jump after 4+ lost frames |
| `BallTracker.lostFramesForRelaxedJump` | 4 | BallTracker | Lost frames before threshold relaxes |
| `BallTracker.trackDeathFrames` | 12 | BallTracker | Consecutive misses before track dies |
| `BallTracker.bufferMax` | 90 | BallTracker | Max positions in rolling buffer |
| `BallTracker.ageSeconds` | 5.0 | BallTracker | Max age of buffered points |
| `BallTracker.velocityWindowFrames` | 5 | BallTracker | Frames used for velocity estimate |
| `BallTrackingPipeline.nearHoopXFactor` | 2.5 | Pipeline | Broad lateral engage zone (multiple of rimWidth) |
| `BallTrackingPipeline.makeZoneHalfWidth` | **0.07** | Pipeline | Tight make zone half-width (FIXED, not rimWidth-relative) |
| `BallTrackingPipeline.nearRimEngageRadius` | **0.20** | Pipeline | Broad vertical engage zone (above + below rim) |
| `BallTrackingPipeline.hoopRegionExpansion` | 0.20 | Pipeline | Path B lateral expansion (each side) |
| `BallTrackingPipeline.makeConfirmMargin` | 0.04 | Pipeline | How far below rim before confirming make |
| `BallTrackingPipeline.flightTimeoutSeconds` | 3.0 | Pipeline | Path A max flight time |
| `BallTrackingPipeline.pathBMinFramesAbove` | **1** | Pipeline | Path B: frames above rim before entry (reduced for layups) |
| `BallTrackingPipeline.pathBMakeDepthFraction` | 0.40 | Pipeline | Path B: depth through hoop for make |
| `BallTrackingPipeline.pathBMaxFramesInRegion` | 18 | Pipeline | Path B: max frames in region before timeout |
| `BallTrackingPipeline.pathCMaxDisappearanceFrames` | 8 | Pipeline | Path C: max frames lost |
| `BallTrackingPipeline.pathCHoopProximity` | 0.15 | Pipeline | Path C: outer X proximity gate |
| `BallTrackingPipeline.shotCooldownSeconds` | **1.0** | Pipeline | Cooldown between shots (shortened from 1.5s) |
| `frameSkip` | 3 | ATHLTCameraModule | 1 in N frames analyzed (~10fps from 30fps) |

Bold = changed in this overhaul.
