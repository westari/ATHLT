# Track Shots — VisionCamera Frame Processor Crash Resolution

**Date:** 2026-05-31
**Symptom:** "Start Tracking" crashes immediately, even with `NOOP_WORKLET = true`
**Context:** react-native-vision-camera ^4.3.1, react-native-worklets-core ^1.6.3, Expo SDK 54, `newArchEnabled: true`

---

## Root Cause

The crash is in VisionCamera's worklet runtime initialization — not in our shot detection code.

Proof: `NOOP_WORKLET = true` was active. That runs an empty worklet — `onDetectionsJS([], 0)` — with zero inference logic. It still crashed. This rules out:

- Our Swift CoreML inference code (`detectShots`)
- Our JS detection processing logic
- `ShotTracker.processFrame`

Real cause: `useFrameProcessor` + `react-native-worklets-core` + New Architecture JSI interact poorly on this device/SDK combination. VisionCamera v4 frame processors bridge to a separate JS runtime via worklets-core. The worklet runtime crashes before the first frame is even processed.

Supporting GitHub issues:
- mrousavy/react-native-vision-camera#3639 — frame processor VISION_EXPORT_FRAME_PROCESSOR macro crashes on iOS with newer Expo setups
- mrousavy/react-native-vision-camera#2507 — `useFrameProcessor` hook causes app crashes in Expo environments

---

## Options Considered

### 1. Downgrade VisionCamera to v4.5.x or v4.4.x
**Rejected.** VisionCamera v4 is archived (v5 is current). No documented evidence that earlier 4.x versions are more stable with Expo SDK 54 + New Architecture. Downgrading is a guess, not a fix.

### 2. Disable New Architecture (`newArchEnabled: false`)
**Rejected.** Frame processors require New Architecture's JSI. Disabling New Architecture would break `react-native-worklets-core` entirely. Additionally, SDK 54 defaults to New Architecture — disabling it introduces its own instabilities.

### 3. Remove frame processor; use periodic snapshot polling
**Chosen.** The camera preview works fine without a frame processor. The crash is entirely in the frame processor setup. Removing `useFrameProcessor` and `Worklets.createRunOnJS` eliminates the crash source.

---

## Chosen Fix: Snapshot Polling

1. Camera renders with `ref={cameraRef}`, **no `frameProcessor` prop**
2. A `setInterval` fires every 500ms when tracking is active and model is settled
3. Each tick calls `tracker.processFrame([], Date.now())` — stub until CoreML path is wired
4. When real inference is ready: replace stub with `cameraRef.current.takeSnapshot({ quality: 30 }) → CoreML`

### Trade-offs

| | Frame processor (old) | Snapshot polling (new) |
|---|---|---|
| Crash | Yes — kills the app | No |
| Throughput | 30fps continuous | ~2fps (500ms) |
| Thread | Worklet (off-JS) | JS thread |
| For shot detection | Overkill — shots take 400ms+ | Sufficient |

Shot detection does not need per-frame processing. A ball leaving a hand, arcing, and entering the basket takes 400–800ms. 2fps (500ms interval) captures every meaningful phase.

---

## Future Path (after Apple Developer + EAS Dev Client build)

**Option A — Snapshot + new Swift function:**
1. Call `cameraRef.current.takeSnapshot({ quality: 30, skipMetadata: true })`
2. Write `detectShotsFromFile(uri: string)` in Swift — loads JPEG into `CVPixelBuffer`, runs MLModel
3. Export via the existing shot-detector Expo module
4. Replace the stub in the interval with the real call

**Option B — Evaluate VisionCamera v5 (NitroModules):**
v5 is a ground-up rewrite using NitroModules instead of worklets-core. It may have better New Architecture compatibility. Check mrousavy/react-native-vision-camera/issues/3743 for EAS/Expo SDK 54 status before upgrading. Requires an EAS rebuild.

Do Option A first — it reuses existing infrastructure and unblocks CV with minimal changes.
