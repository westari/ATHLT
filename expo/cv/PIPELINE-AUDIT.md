# CV Pipeline Audit — 2026-06-05

Full end-to-end audit of the basketball shot detection pipeline before rebuild.

---

## File inventory

| File | Role |
|---|---|
| `modules/athlt-camera/ios/ATHLTCameraModule.swift` | AVCaptureSession, CoreML inference, BallTrackingPipeline, all native events |
| `modules/athlt-camera/ios/ATHLTCameraView.swift` | React Native preview layer (reads from ATHLTSessionHolder, no inference logic) |
| `modules/athlt-camera/src/index.ts` | JS bridge — types, event subscriptions, function wrappers |
| `modules/athlt-camera/expo-module.config.json` | Module registration (ATHLTCameraModule + ATHLTCameraView) |
| `modules/athlt-camera/athlt-camera.podspec` | Native build config — AVFoundation, CoreML, Vision frameworks linked |
| `modules/athlt-camera/package.json` | Package manifest, main = src/index.ts |
| `app/open-run.tsx` | The open-run screen — subscribes to events, shows debug panel |
| `components/cv/CameraView.tsx` | JS wrapper — startSession → loadModel → setMode('detection') on mount; start/stopTracking on active prop |
| `app.json` | withCoreMLModel plugin wired to `./cv/best.mlpackage` |
| `plugins/withCoreMLModel.js` | Copies .mlpackage into ios/, writes PBXFileReference + PBXBuildFile into Xcode project |
| `cv/best.mlpackage` | The trained model (Ultralytics YOLO11n, 5 classes) |

---

## Issues found and fixed

### ISSUE 1 — Cross-queue data race (CRITICAL, FIXED in prior session)

**What was wrong:** `handleSampleBuffer` (on `sessionQueue`) read `currentMode` and `isModelLoaded` without synchronization. Both are written on `inferenceQueue` by `setMode()` and `doLoadModel()`. The guard could see stale values (`"idle"` / `false`) on every call, silently dropping all frames. This caused `totalFramesAnalyzed = 0` the entire session.

**Fix:** Moved the mode/model guard inside `inferenceQueue.async`, so it reads the same queue where the state is written. No more race.

**Evidence:** `totalFramesAnalyzed` was 0 despite camera running. After fix, `totalFramesReceived > 0` should confirm frames arrive; `totalFramesAnalyzed > 0` confirms inference runs.

---

### ISSUE 2 — Class name mismatch (CRITICAL, FIXED in this session)

**What was wrong:** The Swift code checked for class names `"ball"`, `"basket"`, `"hoop"`, `"rim"`. The trained model's stored class names are numeric strings `"0"`, `"1"`, `"2"`, `"3"`, `"4"` (a known Ultralytics CoreML export bug where class names become their indices). The comparisons **never matched**, so ball and hoop detections were always 0 even when inference was running.

**Model class mapping (SwishAI dataset `basketball-6vyfz/basketball-detection-srfkd`):**
| Index | Stored name | Maps to |
|---|---|---|
| 0 | `"0"` (should be `"Ball"`) | ball |
| 1 | `"1"` (should be `"Ball_in_Basket"`) | ball (also a ball position) |
| 2 | `"2"` (should be `"Player"`) | ignored |
| 3 | `"3"` (should be `"Basket"`) | basket/hoop |
| 4 | `"4"` (should be `"Player_Shooting"`) | ignored |

**Fix:** Added `isBallClass()` and `isBasketClass()` static helpers on `ATHLTCameraModule`. Both are case-insensitive (`lowercased()`) and handle every known variant:

```
isBallClass:   "ball", "0", "ball_in_basket", "1"
isBasketClass: "basket", "hoop", "rim", "basketball hoop", "basketball_hoop", "3"
```

All three places that matched class names — `processObservations`, `handleDetectionMode`, `handleTrackingMode` — now use these helpers instead of inline string literals.

---

### ISSUE 3 — Debug stats not emitted in detection mode (FIXED)

**What was wrong:** `emitDebugStats()` was gated on `if isTracking`. The JS side also only subscribed to debug stats when `isTracking`. This meant you had zero diagnostics before pressing Start — exactly when you need them to see if the model loads and if the hoop is being detected.

**Fix:**
- Swift: changed `if isTracking` → `if isTracking || currentMode == "detection"`
- JS (`open-run.tsx`): moved `addDebugStatsListener` subscription from inside `if (!isTracking) return` to an unconditional `useEffect`
- JS: DBG button and debug panel now visible in `phase === 'idle'` (detection mode) AND tracking mode

---

### ISSUE 4 — Model status hidden in diagnostic panel (FIXED)

**What was wrong:** `onModelLoadStatus` event was only shown inside the diagnostic panel which requires manually navigating to a non-obvious UI. If the model failed to load, this wasn't visible until the user found and opened the diagnostic panel.

**Fix:** Added a persistent `modelBanner` at the very top of the screen (z-index 50) that shows as soon as `onModelLoadStatus` fires. Gold text on success (`model: best.mlmodelc`), red on failure with the error string. Tiny (9pt) and non-intrusive, but always visible.

---

## Items verified as correct

### A. Model loading
- `doLoadModel` looks for `best.mlmodelc` first (compiled form), then `best.mlpackage`. Correct — Xcode compiles .mlpackage to .mlmodelc during build.
- `isModelLoaded` set to `true` only after successful `MLModel` + `VNCoreMLModel` construction.
- `onModelLoadStatus` event emitted on success, failure, AND file-not-found. JS will see the result immediately.
- Model file exists at `cv/best.mlpackage`. Plugin (`withCoreMLModel.js`) is active in `app.json`.

### B. Camera & frame delivery
- `AVCaptureSession` configured with `hd1280x720` preset.
- `AVCaptureVideoDataOutput` with BGRA pixel format — correct for CoreML.
- `setSampleBufferDelegate` called with `sessionQueue` — correct.
- `session.startRunning()` called after `commitConfiguration`.
- `ATHLTCameraView` reads the session from `ATHLTSessionHolder.shared` via NotificationCenter — preview works independently of inference.

### C. Guard / threading (POST-FIX)
- Frame counter (`totalFramesReceived`) incremented before throttle on `sessionQueue`.
- Throttle: 1-of-6 frames passed (≈5fps from 30fps input). Modulo is `frameCounter % frameSkip == 0` — correct, not off-by-one.
- Mode/model guard now inside `inferenceQueue.async` — no race.
- `totalFramesAnalyzed` incremented at very top of `runInference` before any other logic.

### D. Inference
- `VNCoreMLRequest` with `imageCropAndScaleOption = .scaleFit` — correct for YOLO.
- `VNImageRequestHandler` with orientation `.right` (matches `videoOrientation = .landscapeRight` on capture connection).
- Results cast to `[VNRecognizedObjectObservation]`. If the model returns raw tensors (`VNCoreMLFeatureValueObservation`), the cast fails and the function returns early with a warning NSLog. This would show as `Infrd > 0` but `Raw: none`.

### E. Detection mode vs tracking mode
- Detection mode: inference runs, `handleDetectionMode` looks for basket/hoop class to lock the hoop bbox.
- Tracking mode: inference runs, `handleTrackingMode` feeds ball+basket detections to `BallTrackingPipeline`.
- Inference runs in BOTH modes (guard: `currentMode != "idle"`).
- Debug stats emitted in BOTH modes (fix applied).

### F. Events to JS
All events are in `Events(...)` declaration: `onShotDetected`, `onError`, `onCameraState`, `onHoopDetected`, `onDetectionDebug`, `onDebugStats`, `onModelLoadStatus`. All emitted in the right places. JS subscribes to all of them.

### G. JS lifecycle
- `CameraView.tsx`: mount → startSession → loadModel → setMode('detection') → onCameraReady
- `active=true` → setMode('tracking') → startTracking
- `active=false` → stopTracking
- Unmount → stopSession (full pipeline reset including hoop lock)

---

## What to check after next rebuild

### Step 1 — Model status banner
Open the screen. Within 2-3 seconds you should see either:
- `model: best.mlmodelc` (gold) → model loaded. Go to step 2.
- `model failed: [error text]` (red) → model didn't load. Check EAS build logs for `.mlmodelc` not found.

If missing entirely → `onModelLoadStatus` event never fired → `loadModel()` never completed. Check the diagnostic panel "Model" row.

### Step 2 — Frame delivery (DBG panel, pre-tracking)
Tap DBG button (top-right, visible before tracking). In detection mode:
- `Recv > 0` → camera delivering frames. Expected: climbs to ~1000+ in first 30s.
- `Recv = 0` → AVCaptureSession output delegate not firing. Session not running.

### Step 3 — Inference running
In detection mode (before Start):
- `Infrd > 0` → inference running. 
- `Infrd = 0` + `Recv > 0` → guard blocking. Check Xcode log for `[ATHLTCamera] GUARD BLOCK:` message.

### Step 4 — Model returning observations
- `Raw: 0 0.72` or `Raw: Ball 0.65` → model sees something. Good.
- `Raw: none` + `Infrd > 0` → model returns empty results OR wrong output type. Check Xcode log for `WARNING: model returns VNCoreMLFeatureValueObservation` — if you see this, the model needs to be re-exported with proper CoreML pipeline format.

### Step 5 — Hoop detection (detection mode)
Point camera at a basketball hoop:
- `Hoops > 0` + hoop overlay turns gold → working.
- `Raw: 3 0.65` but `Hoops = 0` → class "3" not matching isBasketClass. (This shouldn't happen after the fix but check anyway.)

### Step 6 — Shot detection (tracking mode, after Start)
Shoot a ball through the hoop:
- `Balls > 0` → ball being tracked.
- Shot events firing → pipeline working.

---

## Most likely remaining failure after rebuild

If `Raw: none` with `Infrd > 0`:
- The model outputs `VNCoreMLFeatureValueObservation` (raw tensors) not `VNRecognizedObjectObservation`
- This means the model was NOT properly exported with NMS pipeline in a format Vision understands
- Fix: re-run the Colab notebook, confirm `nms=True` export succeeds, re-download `best.mlpackage`

If `Raw: 0 0.72` but `Balls = 0`:
- Means class "0" isn't matching `isBallClass` (shouldn't happen — "0" is handled)
- Check the raw NSLog output in Xcode: `[ATHLTCamera] raw obs: class=X conf=Y`

If `Raw: ball 0.72` (human-readable names):
- This means the model DID export with proper class names
- Everything should work after the class matching fix
