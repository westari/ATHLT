# ATHLT Shot Detection Algorithm

**Last updated:** 2026-06-01  
**Implementation:** `modules/athlt-camera/ios/ATHLTCameraModule.swift` — `BallTrackingPipeline`  
**Reference:** [avishah3/AI-Basketball-Shot-Detection-Tracker](https://github.com/avishah3/AI-Basketball-Shot-Detection-Tracker), [nitinhemaraj/Basketball-shot-detection](https://github.com/nitinhemaraj/Basketball-shot-detection)

---

## Why the old algorithm failed

The original implementation relied on a `ball_in_basket` class from the YOLO model to score makes. This class fires when the ball is visually inside the hoop in the same frame — a condition that almost never appears in real inference because:

1. The ball travels at 20–40 mph near the rim. At 5fps, it occupies the hoop region for < 0.5 frames.
2. The YOLO model needs to output `ball_in_basket` at > 45% confidence at precisely the right moment.
3. The model is trained on highlight-reel clips, not realistic single-camera setups from phone height.

In practice, `ball_in_basket` fires 0–5% of actual makes. The miss detection was also unreliable — ball-near-basket heuristics produce frequent false positives when the player is setting up near the arc.

---

## The new algorithm

### Overview

```
Camera frames (30fps)
        │
        ▼  every 6th frame (~5fps)
CoreML inference ──→ [ball?, basket?] observations
        │
        ▼
BallTrackingPipeline.update()
        │
        ├─ ingestBall()     — clean + buffer ball positions
        ├─ evaluate()       — flight detection + scoring
        │       │
        │       ├─ flight detected (ball above hoop)
        │       │
        │       └─ ball crosses hoop mid-Y → predictXAtY() → MAKE or MISS
        │
        └─ emitShotEvent()  → onShotDetected JS event
```

### Step 1 — Hoop lock (static for session)

During `setMode('detection')`, the model detects basket/hoop/rim. The **first detection above 45% confidence** locks the hoop bounding box via `lockHoop()`. Once locked, it is **never updated** — not by subsequent detections, not during tracking mode.

Why static? The hoop doesn't move between shots. Re-detecting each frame introduces jitter that breaks trajectory math. The user positions the phone once; the hoop bbox is their anchor for the whole session.

Stored as a `CGRect` in **top-left normalized coordinates** (y = 0 at top, y = 1 at bottom). Vision's native bottom-left origin is converted at the boundary.

```
Hoop locked at session start:
┌─────────────────────────────┐  y=0
│                             │
│     ┌───────────────┐  ←   │  hoopRect.minY  (top edge of hoop)
│     │   HOOP BBOX   │       │  hoopRect.midY  (center)
│     └───────────────┘  ←   │  hoopRect.maxY  (bottom edge)
│                             │
└─────────────────────────────┘  y=1
```

### Step 2 — Ball position buffer

Every analyzed frame, the ball center `(x, y)` in top-left normalized coords is appended to a rolling buffer (max 60 entries = ~12 seconds at 5fps).

**Data cleaning applied on ingestion:**

| Filter | Condition | Reason |
|--------|-----------|--------|
| Confidence threshold | `ball.confidence < 0.40` → skip | Low-confidence detections are noise |
| Jump rejection | `sqrt(Δx² + Δy²) > 0.28` → skip | Physical balls can't teleport frame-to-frame |
| Age pruning | `timestamp - entry.t > 4.0s` → remove | Old positions are irrelevant to current shot |

After ingestion, a **3-frame moving average** smooths the positions before they are used in trajectory math.

### Step 3 — Shot-in-flight detection

Checked every frame after smoothing. A shot is declared **in flight** when both:
- `ball.y < hoop.minY` — ball center is **above** the top edge of the hoop
- `|ball.x − hoop.midX| < hoop.width × 1.5` — ball is laterally near the hoop

`inFlight = true` is set once and held until the shot is scored or times out (2.5s).

The algorithm also tracks `peakY` — the minimum y value seen during the flight (minimum y = highest physical position in top-left coords). The ball must have peaked **above** `hoop.minY` for a score to be valid.

### Step 4 — Trajectory prediction (linear regression)

When the ball descends back to `hoop.midY` (the crossing moment), we need to know its **exact horizontal position** at crossing. Since we're running at 5fps, the ball may cross between frames.

We fit two independent linear models to the last 5 smoothed ball positions:

```
y(t) = m_y · t + b_y    (vertical motion over time)
x(t) = m_x · t + b_x    (horizontal motion over time)
```

Using ordinary least-squares:

```
m_y = (n·ΣtY − Σt·ΣY) / (n·Σt² − (Σt)²)
b_y = (ΣY − m_y·Σt) / n
```

Same formula for `m_x`, `b_x`.

To find ball X at the crossing moment:

```
t_cross = (hoopMidY − b_y) / m_y
x_cross = m_x · t_cross + b_x
```

`x_cross` is clamped to [0, 1] to handle edge cases.

### Step 5 — Make / miss determination

```
MAKE if |x_cross − hoop.midX| ≤ hoop.width × 0.55
MISS otherwise
```

The 0.55 tolerance accounts for:
- Hoop bbox being slightly smaller than the physical hoop in the model's output
- Ball entering the hoop at an angle (not perfectly centered)
- Small errors in the linear extrapolation

### Step 6 — Disappearance heuristic (MAKE bonus signal)

If the ball **disappears from frame** while in flight, and its last known position was near the hoop:

```swift
nearX = |lastKnown.x − hoop.midX| < hoop.width × 0.8
nearY = lastKnown.y < hoop.maxY + hoop.height
```

→ Score a MAKE at 62% confidence.

This handles the common case where the ball drops through the basket so quickly it's never seen below the hoop (falls out of frame or is occluded by the backboard).

### Step 7 — Cooldown

After any scored shot (make or miss), **no new shots can be scored for 2.0 seconds**. This prevents:
- Double-counting the same shot from overlapping frames
- The ball bouncing on the court triggering another detection

---

## Configuration parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| `bufferMax` | 60 | Frame capacity (~12s at 5fps) |
| `ageSeconds` | 4.0 | Drop positions older than this |
| `jumpThresh` | 0.28 | Normalized Euclidean distance |
| `minBallConf` | 0.40 | Ball detection minimum |
| `minHoopConf` | 0.45 | Hoop lock minimum |
| `cooldownSec` | 2.0 | Seconds between scored shots |
| `flightTimeout` | 2.5 | Abort flight state after this |
| `makeTolerance` | 0.55 | X tolerance as fraction of hoop width |
| Frame rate | ~5fps | Every 6th frame from 30fps input |

---

## Coordinate system

All internal pipeline math uses **top-left origin** (y = 0 at top, y = 1 at bottom):

- Ball **above** hoop: `ball.y < hoop.minY`
- Ball **descending**: `ball.y` is increasing over time
- Ball **crossing** hoop center: `ball.y >= hoop.midY`

Vision framework outputs use bottom-left origin. Conversion happens exactly once: in `lockHoop()` and `ingestBall()`.

---

## Known limitations

1. **Single hoop assumption.** The pipeline only tracks one hoop. Courts with multiple visible hoops (end-line cameras) will confuse hoop lock.

2. **Camera must be stationary.** Any phone movement after hoop lock invalidates the position. Add camera motion detection (gyroscope delta) as a future safeguard.

3. **5fps cap.** At 5fps, a fast layup (ball in air for 0.2s) may only generate 1 analyzed frame. Linear regression degrades with fewer points. Increasing to 10fps would significantly improve accuracy at the cost of battery life and model latency.

4. **Ball occlusion.** When the player's body occluds the ball during release, the buffer gets a gap. Jump rejection may also discard the ball's position immediately after occlusion ends (position appears to "jump").

5. **Front camera accuracy.** Front cameras have smaller sensors, slower autofocus, and worse low-light performance. Expect ~20% fewer accurate detections vs. back camera.

6. **No arc / release angle data.** The trajectory regression gives horizontal position at crossing, but not arc height or release angle. These require tracking across many more frames and would need a separate parabolic regression pass.

---

## Future improvements

- **Parabolic regression** — fit `y = a·x² + b·x + c` instead of linear to better model ball arc
- **Kalman filter** — more principled smoothing that accounts for ball physics (gravity constant)
- **Multi-hoop NMS** — suppress duplicate hoop detections, pick the one facing the camera
- **Shot zone classification** — use hoop center as reference point to tag shot with court zone (top-of-key, wing, corner, etc.)
- **Camera motion compensation** — gyroscope integration to correct hoop bbox when phone isn't perfectly still
