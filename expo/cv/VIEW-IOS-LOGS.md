# How to View iOS Device Logs on Windows

The Swift `NSLog(...)` calls in `ShotDetectorModule.swift` and `ShotDetectorFrameProcessor.swift` write to the iOS device's system log. Here is how to read them from Windows.

---

## Option 1: 3uTools (Free, Windows) — Recommended

1. Download 3uTools from https://www.3u.com (free, no account required)
2. Install and open it
3. Connect your iPhone via USB — accept the "Trust This Computer" prompt on the phone
4. In 3uTools: click **Toolbox** → **Real-time Log**
5. Start Track Shots in the app
6. Watch the log stream for lines starting with `[ShotDetector]` or `[ShotDetectorFP]`

You can also filter by typing `ShotDetector` in the search bar at the top of the log window.

---

## Option 2: iMazing (Windows, freemium)

1. Download iMazing from https://imazing.com (the free tier lets you view logs)
2. Connect iPhone, trust the computer
3. Open iMazing → select your device → **Device Logs**
4. Click the refresh/record button while reproducing the crash
5. Search for `ShotDetector` in the log

---

## Option 3: iPhone Diagnostics via Settings (no computer needed)

1. On the iPhone: **Settings → Privacy & Security → Analytics & Improvements → Analytics Data**
2. After a crash, look for files named `ATHLT-*.ips` (crash reports)
3. Tap a crash file → share it (AirDrop / email to yourself)
4. The `.ips` file is JSON — search for `ShotDetector` and `EXC_BAD_ACCESS`

---

## Option 4: Windows Subsystem for Android workaround (advanced)

Not applicable — this is iOS only.

---

## What to Look For

After opening Track Shots, look for this log sequence in order:

```
[ShotDetectorFP] plugin initialized
[ShotDetector] pipeline singleton created
[ShotDetector] loadModel called — looking for best.mlmodelc
[ShotDetector] found model at: /path/to/best.mlmodelc
[ShotDetector] MLModel loaded OK
[ShotDetector] VNCoreMLModel wrapped OK
[ShotDetector] model ready — modelName: best.mlpackage
[ShotDetectorFP] first frame — size: 1280x720, pixelFormat: ...
[ShotDetectorFP] frame #3 — running inference
[ShotDetector] runInference enter — isLoaded: 1
[ShotDetector] entering inferenceQueue.sync
[ShotDetector] inferenceQueue executing
[ShotDetector] locking pixelBuffer ...  ← crash happens around here if it does
[ShotDetector] creating VNCoreMLRequest
[ShotDetector] creating VNImageRequestHandler
[ShotDetector] calling handler.perform
[ShotDetector] perform OK
[ShotDetector] returning N detections
```

If the log stops at any line, **that line is immediately before the crash**.

### Common crash signatures

| Last log line before crash | Likely cause | Fix |
|---|---|---|
| `locking pixelBuffer` | Double-lock conflict with Vision | Remove `CVPixelBufferLockBaseAddress` (done in latest fix) |
| `creating VNImageRequestHandler` | Wrong pixel format | Change `pixelFormat="rgb"` on Camera component |
| `calling handler.perform` | CoreML model crash, wrong orientation | Try `orientation: .up` instead of `.right` |
| `entering inferenceQueue.sync` | Queue deadlock | Check for reentrant calls |
| *(no log at all)* | Frame processor not registering | Check ObjC `.m` bridge file |

---

## Pixel Format Numbers

The first frame log shows the pixel format as a number. Common values:

| Decimal | Hex | Name | Notes |
|---|---|---|---|
| 875704422 | 0x34323076 | `kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange` | Default YUV (yuv) |
| 875704438 | 0x34323066 | `kCVPixelFormatType_420YpCbCr8BiPlanarFullRange` | Full-range YUV |
| 1111970369 | 0x42475241 | `kCVPixelFormatType_32BGRA` | RGB (what we want with pixelFormat="rgb") |

If you see `875704422` (YUV) and inference crashes, switching to `pixelFormat="rgb"` (`1111970369`) on the Camera component should help.

---

## Orientation Values

The `orientation: .right` in `VNImageRequestHandler` means "image top points right." 

For the iPhone rear camera:
- **Portrait phone** → frames need `.right` correction (top of image points right)
- **Landscape phone (home right)** → frames are already `.up` (no correction needed)

If you see the inference running but detections are wrong/missing, try changing `.right` to `.up` in `ShotDetectorModule.swift`.
