# Shot Detection Validation — ATHLT CV Pipeline

**Last updated:** 2026-06-07  
**Covers:** `modules/athlt-camera/ios/ATHLTCameraModule.swift` — `BallTrackingPipeline` class

---

## Is it real or fake?

**Real.** Every make/miss comes from actual ball positions returned by the CoreML model running on live camera frames. There is no `arc4random()`, no timer-based fake events, no hardcoded outcomes, no simulation mode. The only path to a `make` or `miss` result is through the full trajectory analysis described below.

---

## Exact code path: "ball detected" → "make counted"

### Step 1 — CoreML inference on camera frame
`runInference(pixelBuffer:model:timestamp:)` is called for every 6th camera frame (~5fps from 30fps).  
`VNCoreMLRequest` runs the YOLO model on the raw pixel buffer.  
Results come back as `[VNRecognizedObjectObservation]` — each has a `boundingBox` (Vision coords, bottom-left origin) and a `labels` array sorted by confidence.

### Step 2 — Class matching (`processObservations` → `handleTrackingMode`)
Each observation's top label identifier is matched against `isBallClass()` / `isBasketClass()`.  
Ball classes: `"ball"`, `"0"`, `"ball_in_basket"`, `"1"` (model exports numeric strings due to Ultralytics bug).  
Hoop classes: `"basket"`, `"hoop"`, `"rim"`, `"basketball hoop"`, `"basketball_hoop"`, `"3"`.

The highest-confidence ball and the highest-confidence basket observation are selected.

### Step 3 — Ball ingestion with persistence + data cleaning (`ingestBall`)

Three filters run before a position enters the buffer:

**a) Persistence gate (new)**  
Ball must be detected in `ballPersistenceRequired = 3` consecutive frames at `ballInitialConf ≥ 0.40` before positions are added to the tracking buffer. Once established, the threshold drops to `minBallConf = 0.25` to handle motion blur mid-flight. Frames where the ball isn't detected reset the counter if not yet established.

**b) Jump rejection**  
Euclidean distance between the new position and the previous accepted position is checked. If `dist > jumpThresh (0.28)` in normalized coordinates, the point is discarded. A real ball can't teleport 28% of the frame width in one frame at 5fps.

**c) Confidence floor**  
After establishment: `conf < 0.25` → discarded.

Accepted positions are converted from Vision's bottom-left origin to top-left (`y = 1.0 - bb.midY`) and appended to a rolling 60-frame buffer. Entries older than 4 seconds are pruned every frame.

### Step 4 — Hoop locking with persistence (`considerHoop`)

Hoop locking now requires `hoopLockRequired = 5` consecutive frames at `hoopLockConfThreshold ≥ 0.35`. If the candidate position jumps more than 12% of frame width/height between frames, the counter resets (different object was seen). Once 5 stable frames accumulate, `lockHoop` commits the bounding box. After that, the hoop position is **fixed for the session** — the model's subsequent hoop detections are ignored so jitter doesn't move the target.

Manual hoop (user taps on preview) bypasses persistence entirely and locks immediately.

### Step 5 — Flight detection (`evaluate`)

Every frame, the 3-frame moving average of recent positions is computed.  
Flight starts when:
- `ball.y < hoop.minY` (ball is above hoop top in top-left coords — smaller y = higher)
- `abs(ball.x - hoop.midX) < hoop.width * 1.5` (ball is near the hoop laterally)
- `!inFlight` (not already tracking a flight)

Once in-flight, `peakY` tracks the highest point reached (minimum y value seen).

### Step 6 — Scoring moment (`scoreAtCrossing`)

Shot is scored when:
- `ball.y >= hoop.midY` (ball has descended back to hoop center height)
- `peakY < hoop.minY` (ball actually rose above the hoop top — not just lateral pass)

At this moment:
1. The last 5 smoothed positions are fed to `predictXAtY` (linear regression on y(t) and x(t) to solve for x when y = hoop.midY)
2. `inside = abs(predictedX - hoop.midX) <= hoop.width * 0.55`
3. `type = "make"` if inside, `"miss"` otherwise
4. `makes++` if make; `attempts++` always

### Step 7 — Shot confidence (R²-based)

`computeRSquared(points:)` fits a linear model to y(t) over the scoring positions and computes R².  
`shotConf = max(0.45, 0.45 + r2 * 0.50)` → range [0.45, 0.95]

| R² | Meaning | Confidence |
|---|---|---|
| 0.95 | Very clean linear descent | ~0.93 |
| 0.70 | Some noise, still consistent | ~0.80 |
| 0.40 | Noisy/scattered positions | ~0.65 |
| 0.10 | Very noisy — likely FP | ~0.50 |

**Treat shots below `confidence < 0.60` as unverified.** They may be real shots with poor lighting or occlusion, or false positives that survived all filters.

The `onShotDetected` event includes `confidence` — use it in the UI to flag low-confidence shots.

### Step 8 — Event emission

`emitShotEvent` sends `onShotDetected` to JS with:
- `type`: `"make"` or `"miss"`
- `confidence`: R²-derived float [0.45, 0.95]
- `timestamp`: device presentation timestamp in ms
- `bbox`: hoop bounding box (top-left normalized)
- `makes`, `attempts`: running session totals

---

## Why this is not faked — what would look different if it were

| Real behavior | Faked behavior (not present) |
|---|---|
| Shots only score when ball descends through hoop region | Shots on timer, or random interval |
| `makes/attempts` counters only advance in `scoreAtCrossing` and `resolveDisappearance` | Would increment from a separate source |
| No shots if camera is covered | Faked version would still fire events |
| `ballEstablished` must be true before positions enter buffer | Single-frame detection would immediately count |
| `hoopLockCount` must reach 5 before locking | Hoop locked instantly on first detection |
| `predictXAtY` uses real timestamps from `CMSampleBufferGetPresentationTimeStamp` | Would use `Date()` or fixed timestamps |

---

## How to verify a specific make/miss corresponds to a real shot

1. **Enable Xcode console logging.** Each shot emits:
   ```
   [BallTracking] MAKE | crossX=0.512 hoopMidX=0.498 hoopW=0.087 inside=YES r2=0.88 conf=0.89 | 3/4
   ```
   `crossX` is the predicted ball X at hoop-center height. `hoopMidX ± hoopW*0.55` is the make window. If `crossX` is outside that window, it's a miss.

2. **Ball establishment log:**
   ```
   [BallTracking] ball ESTABLISHED after 3 frames (conf=0.42)
   ```
   If you don't see this before a shot, the ball was never in the tracking buffer.

3. **Hoop persistence log:**
   ```
   [BallTracking] hoop persistence 5/5 (conf=0.38)
   [BallTracking] hoop LOCKED (persistence 5 frames) — origin(0.41,0.22) size(0.10×0.06)
   ```
   The hoop bbox is printed at lock time. You can cross-check it against the on-screen overlay.

4. **Flight log:**
   ```
   [BallTracking] FLIGHT START y=0.18 hoopTop=0.22 x=0.49 hoopX=0.50
   ```
   `y=0.18 < hoopTop=0.22` confirms the ball was above the hoop.

5. **Low R² shot:** `r2=0.22` in the log means the 5 scoring positions were scattered. Review whether the ball was actually visible or the detection was noise.

---

## Persistence filtering — why it helps

### Problem
At `minBallConf = 0.25`, the model occasionally detects "ball" on objects that look vaguely ball-like (orange jersey numbers, dark circles on shoes, crowd reflections). These false positives appear for 1-2 frames and vanish.

### Solution
`ballPersistenceRequired = 3`: A real basketball moving across frame appears in the same region for 3+ consecutive frames (at 5fps, this is just 600ms). False positives don't. The `prevBall` is still updated during the window so the jump filter stays calibrated.

`hoopLockRequired = 5`: The hoop must be seen consistently at ≥0.35 confidence for 5 frames (~1 second of detection) before the session commits to it. This prevents a single bright circular object from locking a wrong region that corrupts the entire session.

### Tradeoffs
- **Fast shots near the frame edge** may appear for fewer than 3 frames before leaving the frame. These will be missed. This is acceptable — edge shots are hard to score in real life too.
- **Hoop locking takes ~1 second longer.** The UI should keep the hoop overlay in "searching" state until `hoopLocked = true` is signaled.

---

## Known remaining uncertainty

1. **VNCoreMLFeatureValueObservation**: If the model was NOT exported with NMS enabled (Ultralytics `nms=True`), Vision returns raw tensor outputs instead of `VNRecognizedObjectObservation`. The cast fails silently and `runInference` returns early with a warning NSLog. In this case, R² cannot be computed because no positions are ever ingested. Symptom: `Infrd > 0` but `Raw: none` in the debug panel.

2. **Disappearance-based makes** (`resolveDisappearance`) cannot compute R² — the ball vanished mid-flight near the hoop. These are emitted at fixed confidence 0.62. They are less reliable than regression-based shots.

3. **Class names**: The model exports numeric string class names (`"0"`, `"1"`, `"3"`) due to an Ultralytics CoreML export bug. The `isBallClass`/`isBasketClass` helpers handle both numeric and human-readable variants. If the model is ever re-exported with fixed class names, no code changes are needed.
