# ATHLT CV Pipeline — Architecture

Shot detection system for ATHLT. Tracks basketball makes and misses in real time using on-device CoreML inference. Zero runtime cost — everything runs on-device.

---

## Data Flow

```
iPhone camera
    │
    │ 30 fps CVPixelBuffer
    ▼
VisionCamera frame processor (worklet thread)
    │  detectShots(frame, { minConfidence: 0.35 })
    ▼
ShotDetectorFrameProcessor.swift
    │  CMSampleBuffer → CVPixelBuffer → VNCoreMLRequest
    ▼
YOLOv11n CoreML model (best.mlpackage)
    │  Returns: [{ className, confidence, bbox }]
    ▼
JS thread (via Worklets.createRunOnJS)
    │  tracker.processFrame(detections, timestampMs)
    ▼
ShotTracker.ts  (lib/cv/ShotTracker.ts)
    │  Maps detections → ShotDetector state machine
    │  EMA smooths rim position across frames (alpha=0.15)
    ▼
ShotDetector.ts  (lib/shotDetection.ts)
    │  Phase machine: idle → rising → descending → evaluating
    │  Fires onShot(DetectedShot) on make or miss
    ▼
ShotTracker.handleDetectedShot
    │  Derives court zone via CourtZones.ts
    │  Fires onShot(ShotEvent) to the screen component
    ▼
open-run.tsx / session.tsx
    │  UI: flash animation, HUD counter update
    │  sync.recordShot(event) — fire and forget
    ▼
CVSessionSync.ts  (lib/cv/ShotSync.ts)
    │  saveShot() → Supabase shots table (real-time per shot)
    │
    │  [on session end]
    ▼
finalizeShotSession() → Supabase shot_sessions (aggregate stats)
    │
    ▼
POST /api/coach-shot-read  (tryparlai.com → collectiq Vercel)
    │  Claude Haiku generates 2-4 sentence postgame read
    │  Returns { message, planAdjustment }
    ▼
PostSessionRecap.tsx
    │  Shows FG%, zone breakdown, shot timeline, Coach X read
    ▼
plan generation context (optional future integration)
    buildShootingContextString() → injected into generate-plan-v3 prompt
```

---

## Files by Layer

### 1. Native iOS — CoreML Inference
| File | Role |
|------|------|
| `modules/shot-detector/ios/ShotDetectorModule.swift` | Expo module: exposes `loadModel()` to JS |
| `modules/shot-detector/ios/ShotDetectorFrameProcessor.swift` | VisionCamera plugin: runs inference per frame, returns detections array |
| `modules/shot-detector/expo-module.config.json` | Tells Expo build system about the native module |

### 2. JS Bindings — Native Module Bridge
| File | Role |
|------|------|
| `modules/shot-detector/src/ShotDetector.types.ts` | TypeScript types: Detection, BBox, FrameProcessorResult, ModelLoadResult |
| `modules/shot-detector/src/index.ts` | `loadModel()` and `detectShots()` exported to app code |
| `modules/shot-detector/index.ts` | Barrel re-export (`@/modules/shot-detector` alias entry point) |

### 3. Camera & Overlay — React Components
| File | Role |
|------|------|
| `components/cv/CameraView.tsx` | Live camera feed; loads model on mount; runs frame processor |
| `components/cv/ShotOverlay.tsx` | HUD (FG%, make/miss counter), flash animation, debug bounding boxes |
| `components/cv/PostSessionRecap.tsx` | Post-session stats: FG% hero, zone bars, shot timeline, Coach X card |

### 4. Detection Logic — Pure TypeScript
| File | Role |
|------|------|
| `lib/shotDetection.ts` | Core state machine (idle/rising/descending/evaluating), trajectory analysis |
| `lib/cv/ShotTracker.ts` | Wraps ShotDetector; EMA rim smoothing; maps detections to ShotEvent |
| `lib/cv/CourtZones.ts` | Rim-relative zone classification (13 zones + Unknown) |

### 5. Data Persistence
| File | Role |
|------|------|
| `lib/shotSync.ts` | Supabase helpers: createShotSession, saveShot, finalizeShotSession |
| `lib/cv/ShotSync.ts` | High-level orchestrator: start/recordShot/finish + Coach X fetch |

### 6. Screens
| File | Role |
|------|------|
| `app/open-run.tsx` | Free-form session (no drill guide). Phases: idle → tracking → recap |
| `app/session.tsx` | Guided session — adds live camera for Shooting/Finishing drills |

### 7. Build & Training
| File | Role |
|------|------|
| `plugins/withCoreMLModel.js` | Expo config plugin: copies best.mlpackage into ios/ and wires into Xcode |
| `cv/train_shot_detector.ipynb` | Google Colab notebook: trains YOLOv11n, exports to best.mlpackage |
| `cv/supabase-schema.sql` | SQL for shot_sessions, shots tables, RLS, indexes, user_zone_stats view |

### 8. Backend
| File | Role |
|------|------|
| `cv/backend-endpoint/coach-shot-read.js` | Vercel endpoint: Claude Haiku postgame analysis (copy to collectiq/api/) |

---

## Required Packages

Install after Apple Developer account is active and EAS dev client is set up:

```bash
npm install react-native-vision-camera@5.0.10 react-native-worklets-core --legacy-peer-deps --save
```

Then add the worklets Babel plugin to `babel.config.js`:
```js
plugins: ['react-native-worklets-core/plugin']
```

Then EAS build (each package that adds native iOS code requires a fresh build).

**Package roles:**
- `react-native-vision-camera@5.0.10` — camera feed + frame processor pipeline
- `react-native-worklets-core` — runs frame processor on a C++ thread (not main/JS thread)

**Not yet installed** (Phase 2):
- `react-native-mediapipe-posedetection` — 33-landmark pose for release angle
- `react-native-fast-tflite` — TFLite runner for alternative ball detection model

---

## Model

**YOLOv11n** trained on `basketball-6vyfz/basketball-detection-srfkd` (SwishAI dataset).

**Classes detected:**
| Class | Use |
|-------|-----|
| `ball` | Ball position tracking, trajectory construction |
| `basket` | Rim position for zone calculation + make/miss evaluation |
| `ball_in_basket` | Primary make signal (overrides trajectory-based detection) |
| `player` | Ignored in v1 (future: multi-player tracking) |
| `player_shooting` | Ignored in v1 (future: form analysis entry point) |

**Confidence threshold:** 0.35 (configurable via `minConfidence` frame processor arg)

**Size:** ~6 MB `.mlpackage`. Inference: ~17ms/frame on iPhone 13+ (Neural Engine).

---

## Make/Miss Detection Algorithm

The `ShotDetector` class in `lib/shotDetection.ts` runs a phase state machine:

```
IDLE
  │  Ball moves upward faster than velocityThreshold (0.005/frame)
  ▼
RISING
  │  Track trajectory, find peak Y
  │  Transition when ball reverses direction (dy > threshold × 3)
  ▼
DESCENDING
  │  Track trajectory, watch for ball entering rim zone (< 1.5× rim width)
  │  If 2 seconds pass without rim proximity → abort (not a shot)
  ▼
EVALUATING
  │  Primary signal: ball_in_basket detection → MAKE ✓
  │  Fallback A: ball drops below rim and stays centered → MAKE ✓
  │  Fallback B: ball drifts >12% frame width from rim center → MISS ✗
  │  Fallback C: 1.5s timeout at rim → MISS ✗
  ▼
IDLE (reset for next shot)
```

**Cooldown:** 2s between shots prevents double-counting.
**Minimum trajectory frames:** 6 (prevents triggering on bounces or dribbles).

---

## Court Zone Classification

`lib/cv/CourtZones.ts` maps (shooterX, shooterY) to one of 13 zones using rim-relative distance and angle.

The rim position from the YOLO model is smoothed via EMA (alpha=0.15) so it stays stable across frames where the basket isn't detected. When no rim is detected at all, zone defaults to assumed center (0.5, 0.42).

**Distance thresholds (normalized frame units):**
- `< 0.08` → Restricted Area
- `0.08–0.15` → Left Block / Right Block
- `0.15–0.24` → Free Throw, Left/Right Elbow, Left/Right Mid
- `> 0.24` → Three-point zones (Corner 3, Wing 3, Top of Key 3)

**Angle thresholds:**
- `|dx| > 0.30` → Corner 3 (left or right)
- `|dx| > 0.16` → Wing 3 (left or right)
- `|dx| < 0.16` → Top of Key 3

---

## Data Connection to Plan Generation

`lib/shotSync.ts` exports `buildShootingContextString()` which returns a text summary:
```
"Shooting this week: 87/140 (62.1%) across 4 sessions.
 Best zone lifetime: Left Wing 3 at 71% (32/45).
 Weakest zone: Top of Key 3 at 34% (12/35)."
```

This can be injected into the `generate-plan-v3.js` prompt as `shootingStats`. When CV data exists, Coach X references real zone numbers in the plan. Without CV data, the plan uses onboarding skill scores only.

The plan endpoint already accepts `shootingStats` in its request body (see `generate-plan-v3.js`).

---

## Known Limitations (v1)

1. **Single fixed camera position required.** Zone calculation assumes camera is behind/beside the shooter facing the rim. Zones are wrong if the camera faces the court from the side.

2. **No multi-player isolation.** If multiple players are in frame, the `ball` detection is used but there's no guarantee it's associated with the right player. v1 is designed for solo use (tripod on a ball rack).

3. **Arc height and release angle are estimates.** These use the trajectory from the frame-based bbox positions, not true 3D measurement. Accuracy depends on the ball being clearly visible in multiple consecutive frames.

4. **Low light degrades detection.** YOLOv11n at 640px input struggles below ~200 lux. Gym lighting is usually fine; outdoor night is not.

5. **Court zone without pose.** Zone is estimated from where the ball was at release (lowest trajectory point before rising). This approximates shooter position but isn't exact. v2 will use MediaPipe pose to get exact foot position.

---

## v2 Roadmap

- **MediaPipe pose** (`react-native-mediapipe-posedetection`) → exact release angle from wrist/elbow landmarks, exact shooter position from foot landmarks
- **Multi-player tracking** → per-player shot attribution using player bbox association
- **Form scoring** → release angle classification (ideal: 45–60°), follow-through detection
- **Court calibration** → court keypoint detection to convert frame coordinates to real court dimensions

---

## Cost

- **Inference:** $0 (on-device, no API calls during tracking)
- **Shot save:** $0 (direct Supabase write, ~0.1ms)
- **Coach X postgame read:** ~$0.005/session (Claude Haiku, ~300 tokens input + 100 output)
- **Total per session:** < $0.01
