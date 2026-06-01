# ATHLT Native Camera Architecture

**Written:** 2026-06-01  
**Status:** Active (replaces VisionCamera)

---

## Why We Abandoned VisionCamera

VisionCamera v4.3.1 + `react-native-worklets-core` v1.6.3 + Expo SDK 54 + New Architecture (`newArchEnabled: true`) crash every time a frame processor fires — even a **no-op worklet** (`onDetectionsJS([], 0)`) crashes at the worklet runtime initialization level.

This rules out our Swift inference code as the cause. The crash is in VisionCamera's JSI bridging layer, which conflicts with React Native 0.81's New Architecture runtime. Multiple builds, multiple Swift fixes, multiple approaches — none worked.

VisionCamera is fundamentally the wrong tool here. HomeCourt, NEX, and every other production sports CV app own the camera natively via AVFoundation. We now do the same.

See `cv/CRASH-RESOLUTION.md` for the full investigation trail.

---

## Architecture

```
React Native (JS/TypeScript)
    │
    │  import { startSession, loadModel, startTracking,
    │           stopTracking, addShotListener, ATHLTCameraView }
    │       from '@/modules/athlt-camera/src/index'
    │
    ▼
modules/athlt-camera/src/index.ts   ← JS bridge (EventEmitter + requireNativeModule)
    │
    ▼
ATHLTCameraModule (Swift / ExpoModulesCore)
    ├── AVCaptureSession           ← owns camera, no VisionCamera
    │   ├── AVCaptureDeviceInput  ← back wide-angle camera
    │   └── AVCaptureVideoDataOutput
    │         └── delegate: ATHLTCaptureDelegate
    │               └── handleSampleBuffer() → frame throttle (every 6th = ~5fps)
    │
    ├── inferenceQueue (DispatchQueue, userInteractive)
    │   └── VNCoreMLRequest(model: best.mlmodelc)
    │         └── VNImageRequestHandler(orientation: .right)
    │               └── [VNRecognizedObjectObservation]
    │                     └── processObservations() → shot detection state machine
    │
    └── sendEvent("onShotDetected", { type, confidence, timestamp, bbox, makes, attempts })
              │
              ▼
         addShotListener() in CameraView.tsx → onShotDetected prop → open-run.tsx

ATHLTSessionHolder (singleton)
    └── session: AVCaptureSession?
          └── NotificationCenter → ATHLTCameraView.attachSession()

ATHLTCameraView (ExpoView / UIView)
    └── AVCaptureVideoPreviewLayer
          ├── videoGravity = .resizeAspectFill
          └── connection.videoOrientation = .landscapeRight
```

---

## Module Files

```
modules/athlt-camera/
├── expo-module.config.json        ← Expo autolinking config
├── package.json                   ← name: "athlt-camera"
├── athlt-camera.podspec           ← CocoaPods spec (no VisionCamera dep)
├── ios/
│   ├── ATHLTCameraModule.swift    ← ExpoModule + AVCaptureSession + CoreML + shot detection
│   └── ATHLTCameraView.swift      ← ExpoView with AVCaptureVideoPreviewLayer
└── src/
    └── index.ts                   ← TypeScript bridge
```

---

## JS API

```typescript
import {
  startSession,     // Set up AVCaptureSession + request permission
  stopSession,      // Tear down session (call on unmount)
  loadModel,        // Load best.mlmodelc from bundle
  startTracking,    // Begin CoreML inference at ~5fps
  stopTracking,     // Stop inference, returns { makes, attempts, fgPercent }
  addShotListener,  // Subscribe to make/miss events
  ATHLTCameraView,  // Native preview component
} from '@/modules/athlt-camera/src/index';

// Typical lifecycle in a screen:
useEffect(() => {
  startSession().then(r => {
    if (r.success) loadModel();
  });
  return () => { stopSession(); };
}, []);

const sub = addShotListener(shot => {
  console.log(shot.type, shot.makes, shot.attempts); // 'make', 12, 18
});
// cleanup: sub.remove()
```

---

## Shot Detection State Machine

Running on `inferenceQueue` (never the main thread, never the capture thread):

### Classes detected by YOLO model
| Class | Use |
|---|---|
| `ball` | Track trajectory |
| `basket` | Know where the hoop is |
| `ball_in_basket` | Definitive MAKE signal |
| `player` | (future: player tracking) |
| `player_shooting` | (future: release detection) |

### MAKE detection
When `ball_in_basket` is observed with confidence ≥ 0.45, emit a MAKE immediately.  
Cooldown: 1.5 seconds before next shot can be counted.

### MISS detection (heuristic)
1. Ball detected within 2× basket width of basket center → start approach timer
2. Ball disappears (not detected for one full inference cycle ~200ms)
3. If approach timer ran ≥ 0.8s and no `ball_in_basket` was seen → emit MISS

This heuristic catches most misses. It will miss off-frame shots and count some non-shots as misses. Accuracy improves with a larger training dataset.

### Coordinate systems
- Vision framework bbox: **origin bottom-left**, y increases upward
- JS/React Native: **origin top-left**, y increases downward
- The module converts before emitting: `jsY = 1.0 - visionY - height`

---

## Threading Model

| Queue | Responsibility |
|---|---|
| `sessionQueue` (`userInteractive`) | AVCaptureSession config, start/stop, frame delivery |
| `inferenceQueue` (`userInteractive`) | CoreML inference, shot state machine, event emission |
| `main` | Preview layer frame updates, UI |

**Critical rule:** CoreML (`VNCoreMLModel`, `VNImageRequestHandler`) is NOT thread-safe. ALL inference calls happen on `inferenceQueue` serially. The capture delegate receives frames on `sessionQueue` and dispatches to `inferenceQueue` — two different queues, no contention.

---

## How to Debug

### Camera black / no preview
1. Check `startSession()` resolved with `success: true`
2. Check `ATHLTSessionHolder.shared.session` is not nil
3. Check `ATHLTCameraView.previewLayer.session` is set (via notification delivery)
4. Check `session.isRunning == true` in Xcode logs

### No shot events
1. Check `loadModel()` resolved with `loaded: true`
2. Check `startTracking()` was called
3. Look for `[ATHLTCamera] inference error:` in Xcode logs
4. If "model outputs raw feature values": re-export model with `--nms=True`
5. Lower confidence threshold: change `makeConf` from 0.45 to 0.35 for debugging

### Wrong orientation (portrait view in landscape screen)
- The frame handler uses `orientation: .right` for Vision — this corrects for the portrait sensor in a landscape-locked screen
- The preview layer uses `videoOrientation = .landscapeRight` on its connection
- If both are set and orientation is still wrong, try `.left` instead of `.right`

### Crashes at inference
- Confirm pixel format is `kCVPixelFormatType_32BGRA` (BGRA is what Vision/CoreML prefer)
- Confirm `CVPixelBufferLockBaseAddress` is called before dispatching to `inferenceQueue`
- Confirm `CVPixelBufferUnlockBaseAddress` is called in the `defer` block

---

## How to Extend

### Add court zone detection
1. In `processObservations`, compute which zone the ball/basket center falls into
2. Add zone to the `recordShot` payload
3. Surface it in the JS `ShotDetection.zone` field (already typed as optional)
4. Wire court zone to `ShotEvent.zone` in CameraView.tsx

### Add player tracking
The `player` and `player_shooting` classes are already in the model.
1. Track player bbox over time (same ring buffer pattern as ball)
2. Use shooting stance detection to prime the shot detector before release

### Upgrade CoreML model
1. Run Colab notebook with more data / better architecture
2. Export: `yolo export model=best.pt format=coreml nms=True`
3. Replace `cv/best.mlpackage` — the `withCoreMLModel` plugin handles the rest
4. Rebuild with EAS: `eas build --platform ios --profile development`

### Multi-player tracking
`processObservations` currently tracks a single ball. For multi-player:
1. Assign player IDs using IoU-based tracking
2. Associate each shot attempt with the nearest player's ID
3. Emit per-player stats in the event payload

---

## Build Requirements

This module requires a **native build** — it cannot run in Expo Go.

```bash
# First time setup (after Apple Developer account is active)
eas build --platform ios --profile development --non-interactive

# Subsequent builds (after any Swift change)
eas build --platform ios --profile development
```

The `expo.autolinking.nativeModulesDir: "./modules"` in `package.json` tells Expo to auto-link the `athlt-camera` pod. No manual Podfile edits needed.

---

## Old Shot-Detector Module

`modules/shot-detector/` still exists but is gutted:
- `ShotDetectorModule.swift` remains (provides `loadModel()` fallback, harmless)
- `ShotDetectorFrameProcessor.swift` is a comment stub (VisionCamera removed)
- `ShotDetectorFrameProcessorRegister.m` is a comment stub (frame processor removed)
- The podspec no longer depends on VisionCamera

The module is NOT deleted (can't delete files from Claude Code) but is functionally inert. A future cleanup pass can remove it entirely from the Podfile and package.json autolinking.
