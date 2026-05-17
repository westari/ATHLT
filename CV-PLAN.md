# ATHLT — Computer Vision Build Plan

> All of this is blocked on the Apple Developer account being active.
> Once Apple Dev is live, this is the full execution path.

---

## MANDATORY SELF-CHECK AFTER EVERY CV STEP

After EVERY CV step, before moving to the next:

1. **Confirm EAS build status is SUCCESS** — if FAILED, read the build log, fix the error, rebuild. Do NOT advance to the next step on a failed build.
2. **Run typecheck** — zero TypeScript errors before proceeding.
3. **Verify the step's expected files/changes actually exist** by reading/grepping them. Do not assume the edit landed correctly.
4. **Write to CV-PROGRESS.md:** step number, build number, build status, typecheck result, and EXACTLY what needs to be physically tested on the phone for this step and why.
5. **If the step requires phone verification before the next step is safe, STOP** and clearly flag `BLOCKED — NEEDS PHONE TEST` in CV-PROGRESS.md rather than proceeding on an unverified step.
6. **Maximum 3 fix attempts on a failing build** — then STOP and log it to CV-PROGRESS.md. Do not hack around it or keep flailing.

---

## Architecture

**Goal:** On-device, real-time make/miss shot detection for shooting and finishing drills. No server round-trips. $0 runtime cost.

### Detection stack

| Layer | Tech | Purpose |
|---|---|---|
| Camera | `react-native-vision-camera` | Live frame capture |
| Ball + player detection | YOLOv8 (`best.pt` → TFLite) via `react-native-fast-tflite` | Bounding boxes for ball and hoop per frame |
| Pose landmarks | MediaPipe via `react-native-mediapipe-posedetection` | 33 body landmarks, used for shot release angle + arc height |
| Shot decision | `shotDetection.ts` | Trajectory math → make/miss call |

### Shot detection logic

1. Track ball bounding-box center across frames → extract trajectory points
2. Track hoop bounding-box center → fixed target coordinate
3. Fit a linear regression (or simple parabola) to the ball's trajectory over the last N frames
4. Project the fitted trajectory forward to the hoop's x-coordinate
5. Compare projected y at hoop x vs. hoop y ± threshold → **make** or **miss**
6. On shot detection, record: timestamp, court position (derived from pose landmarks relative to hoop), release angle, arc height, result

### What's tracked per shot

- Make / miss
- Court position (approximate zone: paint, mid-range, arc, corner 3)
- Release angle (wrist/elbow landmark delta)
- Arc height (ball peak y relative to hoop y)
- Drill context (drillId, sessionId, userId)

### What's NOT in v1

- Form scoring (release mechanics, follow-through)
- Dribble move classification
- Defensive form
- Travel / double-dribble detection
- Multi-player tracking

---

## Training data

**Dataset:** Roboflow `basketball-player-detection-3`
- Labels: `ball`, `made`, `missed`, `player`, `hoop` (varies by dataset version — check on load)
- Format: YOLOv8 (YOLO txt annotations)
- Training script: `scripts/train_basketball_model.py` (runs on Google Colab free GPU)
- Output: `best.pt` → convert to TFLite for on-device inference via `react-native-fast-tflite`

**Converting best.pt to TFLite after training:**
```bash
# Run in Colab after training completes
from ultralytics import YOLO
model = YOLO('runs/detect/train/weights/best.pt')
model.export(format='tflite')
# Output: best.tflite — drop into expo/assets/models/
```

---

## 9-Step Native Integration Chain

All steps below require an active Apple Developer account. Do them in order — each step requires a fresh EAS build before the next step can be verified. Paste each prompt directly into Claude Code when you're ready to run that step.

---

### Step 1 — Expo Go → Expo Dev Client

**Prompt to paste into Claude Code:**
```
We're switching the ATHLT app from Expo Go to Expo Dev Client so we can use native camera modules later.

Context:
- Repo: C:\Users\arize\ATHLT\expo
- Expo SDK 54, EAS project ID soq1hf2k3yx1ie9heuqn3, EAS owner 1westari4
- expo-dev-client is already in package.json and app.json plugins — just need the build

Do the following:
1. Confirm expo-dev-client is in package.json dependencies (don't install, just verify).
2. Confirm "expo-dev-client" is in app.json plugins array (don't change anything).
3. Run: eas build --profile development --platform ios
4. Tell me when the build is ready and what URL/QR to use to install it on my iPhone.

Do not modify any app code or config files. Just confirm and build.
```

**After the build:** Install the Expo Dev Client app from the App Store on your iPhone, then use it (not Expo Go) to scan the QR from `npx expo start` going forward.

---

### Step 2 — Add vision-camera + EAS build

**Prompt to paste into Claude Code:**
```
Add react-native-vision-camera to the ATHLT app. This is the camera library we need for CV shot tracking.

Context:
- Repo: C:\Users\arize\ATHLT\expo, Expo SDK 54
- Always use --legacy-peer-deps --save for npm installs (lucide vs React 19 conflict)
- app.json already has NSCameraUsageDescription and NSMicrophoneUsageDescription in ios.infoPlist
- We're on Expo Dev Client (not Expo Go) — so native modules work

Do the following:
1. npm install react-native-vision-camera --legacy-peer-deps --save
2. Check the react-native-vision-camera docs for Expo SDK 54: if a Babel plugin or app.json plugin entry is required, add it. Read expo/babel.config.js and expo/app.json first before editing.
3. Create a minimal test screen at expo/app/camera-test.tsx that renders a live <Camera> from react-native-vision-camera pointed at the back camera. No frame processors yet — just confirm the feed renders.
4. In expo/app/(tabs)/_layout.tsx, add <Tabs.Screen name="camera-test" options={{ href: null }} /> so the screen is hidden from the tab bar.
5. In expo/components/TodayHome.tsx, add a temporary debug button below the existing workout card that calls router.push('/camera-test'). Label it "Camera Test →" in small grey text so it's obvious it's temporary. This is the only way to reach /camera-test since it's href:null. It will be removed in Step 7.
6. Run: eas build --profile development --platform ios

After the build installs on phone: tap "Camera Test →" on the Today screen to reach the test screen. Grant camera permission when prompted. Confirm live camera feed renders — real-time video, not black, not a static frame. Report what you see.
Do not modify session.tsx or any existing screens other than TodayHome.tsx (debug button only).
```

---

### Step 3 — Add MediaPipe pose detection + EAS build

**Prompt to paste into Claude Code:**
```
Add react-native-mediapipe-posedetection to the ATHLT app for body landmark tracking.

Context:
- Repo: C:\Users\arize\ATHLT\expo, Expo SDK 54
- Always use --legacy-peer-deps --save
- react-native-vision-camera is already installed from Step 2
- expo/app/camera-test.tsx has a working camera feed

Do the following:
1. npm install react-native-mediapipe-posedetection --legacy-peer-deps --save
2. Check if any app.json plugin entry or Babel config change is needed for this package on Expo SDK 54.
3. Update expo/app/camera-test.tsx to add MediaPipe pose detection on the camera feed. Use a frame processor to get the 33 pose landmarks. Draw a simple overlay (dots or lines) on top of the camera view to visualize the landmarks — this is just for verification.
4. Add an FPS counter to the camera-test overlay. Compute it as 1000ms / (timestamp delta between the last two frames) inside the frame processor, and display it as a live number on screen (e.g. "24 fps"). This is required to verify the pipeline is fast enough to use.
5. Run: eas build --profile development --platform ios

After install on phone: open camera-test (via the "Camera Test →" debug button on Today), point at a person, confirm landmarks render on the body.

FPS pass/fail thresholds — check these before proceeding to Step 4:
- ≥20 fps: green. Pipeline is healthy.
- 15–19 fps: acceptable. Proceed but note the number.
- 10–14 fps: marginal. Investigate before adding TFLite in Step 4. Try reducing camera resolution first.
- <10 fps: HARD STOP. Do not proceed to Step 4. The pipeline cannot support a third frame processor at this speed. Debug MediaPipe configuration before continuing.

Report: fps reading from the on-screen counter, and whether all major landmarks (shoulders, elbows, wrists, hips, knees) are tracked.
Do not modify session.tsx or any other screens.
```

---

### Step 4 — Add fast-tflite + basketball model + EAS build

**Prompt to paste into Claude Code:**
```
Add react-native-fast-tflite to the ATHLT app and wire up the basketball detection model.

Context:
- Repo: C:\Users\arize\ATHLT\expo, Expo SDK 54
- Always use --legacy-peer-deps --save
- vision-camera and mediapipe are already installed
- basketball_detector.tflite must already be at expo/assets/models/basketball_detector.tflite before the build runs — the build will NOT warn if it's missing, it will just ship without the model

PRE-BUILD CHECK — do this before touching any code:
Before writing a single line, verify the model file exists:
  Run: ls expo/assets/models/
  Expected: basketball_detector.tflite is present
  If it's missing: STOP. Do not proceed. Tell me "model file not found — copy basketball_detector.tflite to expo/assets/models/ first." I will copy it manually and then re-run this prompt.

Do the following:
1. Confirm expo/assets/models/basketball_detector.tflite exists (from the pre-build check above).
2. npm install react-native-fast-tflite --legacy-peer-deps --save
3. In expo/app.json, confirm assetBundlePatterns includes "assets/models/*" or "**/*" — add it if missing.
4. Check react-native-fast-tflite docs for any Babel or app.json plugin requirements on Expo SDK 54 and apply them.
5. Update expo/app/camera-test.tsx to run the TFLite model on each camera frame alongside MediaPipe. Use the model to detect ball and hoop bounding boxes. Draw them on the overlay with confidence scores visible as text (e.g. "ball 0.82").
6. In camera-test.tsx, add a model status line to the overlay that shows either "Model: loaded ✓" or "Model: FAILED" depending on whether the TFLite model initialized without error. Log the result to console as well. This is the only way to confirm the model bundled correctly — there is no build-time warning if the file is missing.
7. Run: eas build --profile development --platform ios

After install: open camera-test via the "Camera Test →" debug button on Today. First check the model status line — it must say "Model: loaded ✓" before testing detection. If it says "Model: FAILED", the .tflite file was not bundled correctly; do not proceed.

Then: point camera at a real basketball — a bounding box should appear with confidence ≥0.40. Point at a hoop — a bounding box should appear with confidence ≥0.40. Report both confidence values and the FPS reading (should still be ≥15 with all three frame processors running).
Do not modify session.tsx or any other screens.
```

**Before running the build:** manually copy `basketball_detector.tflite` (output from `scripts/train_basketball_model.py`) into `expo/assets/models/basketball_detector.tflite`. The build step above will verify the file is present before proceeding.

---

### Step 5 — Wire shotDetection.ts to live frames

**Prompt to paste into Claude Code:**
```
Wire expo/lib/shotDetection.ts to the live camera frame pipeline. The detection logic is already written — we just need to connect it to the camera output.

Context:
- Repo: C:\Users\arize\ATHLT\expo
- expo/lib/shotDetection.ts: full ShotDetector class. Takes a stream of {ballBox, rimBox, timestamp} FrameDetection objects via detector.feedFrame(). Calls detector.onShot(DetectedShot) when a shot is detected.
- expo/app/camera-test.tsx: has vision-camera + MediaPipe + TFLite frame processors already running
- expo/lib/shotSync.ts: complete data layer — createShotSession(), saveShot(sessionId, shot), finalizeShotSession() — already wired to Supabase

Do the following:
1. Read expo/lib/shotDetection.ts fully before touching anything.
2. In expo/app/camera-test.tsx, instantiate ShotDetector. On each frame, pass {ballBox, rimBox, timestamp} from the TFLite output into detector.feedFrame().
3. Set detector.onShot = (shot) => { console.log('[CV] shot detected:', shot.made, shot.zone) } for now — just log, no Supabase writes yet.
4. Add a minimal UI overlay showing shot count (makes/total) updating in real time.
5. Do not call saveShot or any Supabase function in this step.

CALIBRATION SETUP — use these exact conditions for this test and all future accuracy tests (Steps 5 and 9 must use the same setup so numbers are comparable):
- Hoop: regulation height (10 feet / 3.05m)
- Distance: 10–15 feet (3–4.5m) from the basket — mid-range, not layups, not 3-pointers
- Phone position: place phone on a chair or tripod so the hoop is visible in the upper half of the frame and the shooter is visible from roughly waist-up
- Lighting: indoor gym or well-lit outdoor court — avoid backlit conditions (bright window behind hoop)
- Shot type: standard set shot or pull-up — consistent form each time

Test: from the setup above, shoot 5 deliberate makes (clean through the hoop) and 5 deliberate misses (clear airballs or back-rim). Then for 2 minutes, walk around the key, dribble, and pass — no shooting. Report:
- Makes detected / 5
- Misses detected / 5 (should log as made=false)
- False positives in 2 minutes of non-shooting movement
- Any shot types that were consistently missed

Do not modify session.tsx.
```

---

### Step 6 — Wire shotSync.ts (connect CV to Supabase)

**Prompt to paste into Claude Code:**
```
Connect the CV shot detection to Supabase writes using the existing shotSync.ts data layer.

Context:
- Repo: C:\Users\arize\ATHLT\expo
- expo/lib/shotSync.ts: complete. Key functions:
    createShotSession({drillId, drillName, dayIndex, drillIndex, startedAt}) → returns sessionId string
    saveShot(sessionId, DetectedShot) → writes one row to shots table
    finalizeShotSession({sessionId, totalShots, makes, bestStreak, durationSeconds, ...}) → updates shot_sessions
- expo/app/camera-test.tsx: ShotDetector wired, onShot logging (from Step 5)
- expo/constants/supabase.ts: Supabase client already set up
- CRITICAL: All Supabase tables have RLS (row-level security) keyed to auth.uid(). Writes from an unauthenticated session silently succeed at the API level but produce zero rows in the database — there is no error thrown. The phone must be logged into the app before testing or all test writes will silently vanish.

PRE-TEST CHECK — do this on the phone before running any Supabase test:
1. Open the app on the phone
2. Confirm the Today screen shows your training plan (not the sign-in or onboarding screen)
3. If you see sign-in: log in first, wait for the plan to load, then proceed
4. If you are unsure: add a temporary console.log in camera-test.tsx that calls supabase.auth.getUser() on mount and logs the user email. Confirm it prints your email before testing writes.

Do the following:
1. In expo/app/camera-test.tsx, add a "Start Session" button. On press, call createShotSession() with a test drillId ("sh-1"), store the returned sessionId in state. Log the returned sessionId to console — if it returns null or undefined, createShotSession() failed (likely auth issue).
2. In the onShot callback, call saveShot(sessionId, shot) after each detection.
3. Add a "End Session" button. On press, call finalizeShotSession() with the accumulated stats, then navigate or show a summary.
4. Add a shot counter overlay showing makes/total live.
5. Test: confirm you are logged in (PRE-TEST CHECK above), start a session, shoot 10 balls using the same calibration setup from Step 5 (10-foot hoop, 10–15 feet distance), end session. Verify rows appear in Supabase shots table and the shot_sessions row is updated. Report what you see in Supabase: exact row counts, whether user_id matches your account, and whether fg_percentage is correct.

Do not modify session.tsx. Do not touch the production session flow yet.
```

---

### Step 7 — Replace camera placeholder in session.tsx

**Prompt to paste into Claude Code:**
```
Replace the LinearGradient camera placeholder in session.tsx with a real camera feed + CV pipeline.

Context:
- Repo: C:\Users\arize\ATHLT\expo
- expo/app/session.tsx: full session screen. The camera placeholder is a <LinearGradient colors={['#1a1a1a','#0a0a0a']} style={StyleSheet.absoluteFill} />. Everything else (HUD, countdowns, drill flow, orientation lock) must stay exactly as-is.
- expo/app/camera-test.tsx: has the working CV pipeline (vision-camera + MediaPipe + TFLite + ShotDetector + shotSync)
- expo/lib/shotSync.ts: createShotSession, saveShot, finalizeShotSession
- expo/store/planStore.ts: currentDayIndex, plan available in the session screen

Do the following:
1. Read expo/app/session.tsx completely before changing anything.
2. Extract the CV camera + frame processor logic from camera-test.tsx into a new component expo/components/CVCamera.tsx. Props: { onShotDetected: (shot: DetectedShot) => void, sessionId: string | null }.
3. In session.tsx, when phase transitions to 'active' on a shooting or finishing drill (check drill.category), call createShotSession() and store the sessionId.
4. Replace the LinearGradient with <CVCamera onShotDetected={handleShot} sessionId={shotSessionId} /> only during active shooting/finishing drills. All other drills keep the gradient.
5. In handleShot, call saveShot(sessionId, shot).
6. When a drill ends (onDrillTimeUp), call finalizeShotSession() if a shotSessionId exists, then clear it.
7. Keep all existing session flow intact — HUD, countdowns, orientation lock, exit button. Only the background layer changes for shooting drills.

REGRESSION CHECKS — all three must pass before this step is complete:
a. Start a session with a non-shooting drill (Ball Handling or Conditioning category). The background must be the dark gradient — NOT the camera feed. If the camera appears on a non-shooting drill, the drill.category check is wrong.
b. During a shooting drill, let the drill timer run to zero and auto-advance to the next drill. The app must NOT crash on this transition. Camera cleanup in CVCamera.tsx must fire cleanly when sessionId prop changes to null.
c. During an active shooting drill (camera visible), tap the Exit (X) button. The app must NOT crash. Camera must shut down cleanly and the app must return to the Today screen.

Test: run a full session end-to-end — every drill, every transition, exit mid-session on a shooting drill. Report: camera appeared on shooting drills ✓/✗, gradient appeared on non-shooting drills ✓/✗, drill transition without crash ✓/✗, mid-session exit without crash ✓/✗.
```

---

### Step 8 — Rebuild shot-results.tsx

**Prompt to paste into Claude Code:**
```
Rebuild expo/app/shot-results.tsx from scratch. It is currently a stub ("coming soon") and crashes if it tries to use Colors.dark.* (which doesn't exist — colors.ts is a flat object).

Context:
- Repo: C:\Users\arize\ATHLT\expo
- expo/constants/colors.ts: flat Colors object. Keys: background, surface, surfaceBorder, textPrimary, textSecondary, textMuted, primary (#D4A017), accent, buttonDark, buttonDarkText, black, white, success, warning, danger, card, border. NO Colors.dark.*.
- expo/lib/shotSync.ts: getShotSession(sessionId) returns {session, shots[]}. session has total_shots, makes, fg_percentage, best_zone, worst_zone, avg_release_angle, avg_arc_height, coach_x_read.
- expo/app/session.tsx: on session complete, it navigates to shot-results with the shotSessionId (you may need to pass it via route params — check how session.tsx exits and add the param if needed).
- api/coach-postgame.js endpoint at https://www.tryparlai.com/api/coach-postgame accepts {drills, focus, dayNumber, totalDays} and already returns a Coach X read — the shot_sessions.coach_x_read field may already be populated.

Build shot-results.tsx to show:
1. SESSION COMPLETE header with drill count + day number
2. FG% large display (e.g. "47%") with makes/total below
3. Zone breakdown: list each zone with attempts and FG%
4. Coach X read card (gold border, "COACH X" label) — load from session.coach_x_read if available, or call api/coach-postgame if empty
5. "Done" button that navigates back to today tab

Match the visual style of the session complete screen (dark background, white text, gold accents). Use Colors from constants/colors.ts — no hardcoded hex for colors already in the palette.
```

---

### Step 9 — End-to-end test + calibration

**Prompt to paste into Claude Code:**
```
Run an end-to-end verification of the ATHLT CV shot tracking pipeline and fix any calibration issues.

Context:
- Repo: C:\Users\arize\ATHLT\expo
- Full CV pipeline is installed: vision-camera, mediapipe-posedetection, fast-tflite
- expo/lib/shotDetection.ts: ShotDetector class with threshold constants at the top of the file
- expo/lib/shotSync.ts: full data layer wired to Supabase
- expo/app/session.tsx: CV camera active during shooting/finishing drills
- expo/app/shot-results.tsx: rebuilt, shows stats + Coach X read
- Supabase tables: shots, shot_sessions (check the schema via supabase dashboard or existing code)

CALIBRATION SETUP — use these exact conditions for every round of Step 9 testing so results are comparable across rounds:
- Hoop: regulation height (10 feet / 3.05m)
- Distance: 10–15 feet (3–4.5m) from the basket — mid-range, not layups, not 3-pointers
- Phone position: on a chair or tripod so the hoop is visible in the upper half of the frame and the shooter is visible from roughly waist-up
- Lighting: indoor gym or well-lit outdoor court — avoid backlit conditions (bright window behind hoop)
- Shot type: standard set shot or pull-up — consistent form each round
These are the same conditions used in Step 5. Numbers from different distances or hoop heights are not comparable and must not be mixed.

Do the following:
1. Read shotDetection.ts and list all tuneable threshold constants (arc height threshold, trajectory point count, confidence cutoffs, etc.).
2. I will run 10 makes + 10 misses using the calibration setup above, then report the results. Based on the accuracy report, suggest specific threshold adjustments and apply them.
3. If false positives are high (non-shots detected as shots), tighten the rising/descending phase thresholds.
4. If real shots are being missed, loosen the trajectory point minimum or arc height threshold.
5. After adjustments, rebuild: eas build --profile development --platform ios

Target accuracy: >85% on makes, <10% false positive rate.
Report: exact threshold values before and after, and the test results that justified each change.
```

---

---

## STEP-BY-STEP PASS/FAIL + PHONE TEST MAP

> Written 2026-05-17. Use this section as the execution checklist the moment Apple Dev clears.
> Every step is classified as **UNATTENDED-SAFE** or **HARD-BLOCKS-ON-PHONE** below.
> A step marked HARD-BLOCKS-ON-PHONE means you cannot safely start the next step without a physical device test first.

---

### Step 1 — Expo Go → Expo Dev Client

**Unattended-safe:** BUILD ONLY — the EAS build can queue unattended. Installation and the dev-client connection test require you + phone.

**Pass condition (exact):**
1. EAS dashboard shows build status = **SUCCESS** for the development profile (not "failed", not "cancelled")
2. The `.ipa` installs on your iPhone without error (no "Unable to Install" prompt)
3. The Dev Client app opens to a screen that says "Expo Dev Client" or "Development builds" — it is NOT the standard Expo Go white/splash screen
4. You run `npx expo start` on your computer. The Dev Client app scans the QR code. **The ATHLT Today screen loads inside Dev Client** — same UI as Expo Go, but now running through the Dev Client shell

**Fail condition (exact):**
- EAS build status = FAILED → read build log, fix, rebuild (max 3 attempts)
- App shows "Unable to Install" → provisioning profile not set up; check Apple Dev account is active and device UDID is registered
- App opens but immediately white-screens or crashes → check Metro bundler is running (`npx expo start`) and phone is on same WiFi as computer
- Dev Client connects but shows a blank screen → JS bundle failed to load; check Metro logs

**Phone test (exact steps):**
1. Install the `.ipa` from EAS dashboard (QR code or direct link from EAS email)
2. Open the installed app on iPhone
3. On your computer: `npx expo start` in `C:\Users\arize\ATHLT\expo`
4. In Dev Client app: tap "Enter URL manually" or scan QR code from Metro output
5. **You should see the ATHLT Today screen (or onboarding flow)**
6. Tap around — Today, Film, Library, Progress tabs should all be reachable
7. Confirm: no red error overlays, no "NativeModule not found" errors

**HARD-BLOCKS-ON-PHONE: YES.**
Step 2 requires Dev Client to be working. Cannot install native camera module on a phone running Expo Go.

---

### Step 2 — Add vision-camera + EAS build

**Unattended-safe:** Code changes (install, create camera-test.tsx, _layout.tsx edit) and EAS build can run fully unattended. Camera verification requires phone.

**Pre-condition to check before build:**
- `react-native-vision-camera` appears in `package.json` dependencies
- `app.json` has the plugin entry (if required by the library docs — verify before building)
- `camera-test.tsx` exists at `expo/app/camera-test.tsx`
- `expo/app/(tabs)/_layout.tsx` has `<Tabs.Screen name="camera-test" options={{ href: null }} />`
- `NSCameraUsageDescription` is in `app.json` `ios.infoPlist` (already present per plan)

**Pass condition (exact):**
1. EAS build = SUCCESS
2. App installs without error
3. Camera permission dialog appears the first time `/camera-test` is opened
4. After granting permission: **live back camera feed visible** — you can see real-time video, not a black screen, not a grey placeholder
5. No red error overlay, no crash

**Fail condition (exact):**
- Camera feed is black → permission was denied; reset permissions in iPhone Settings → Privacy → Camera, or check that `NSCameraUsageDescription` is in the built binary's Info.plist
- "NativeModule not found" error → plugin entry missing from `app.json`; check vision-camera install docs for Expo SDK 54
- App crashes on open → Babel plugin issue; check `babel.config.js` against vision-camera docs

**Phone test (exact steps):**
1. Open Dev Client, connect to Metro (`npx expo start`)
2. Need to navigate to `/camera-test` — it's hidden from the tab bar. Do this: **open the Today screen → tap the Coach X bubble** (currently broken navigation) OR add a temporary debug button to TodayHome for this step. ⚠️ FLAG: the step prompt does not say how to navigate to `/camera-test`. Add a temporary "Camera Test →" button to the Today screen or navigate via Dev Client's URL bar.
3. Camera permission dialog appears — **tap Allow**
4. Back camera feed fills the screen in real-time
5. Wave your hand in front of the camera — motion is live (not a frozen frame)
6. Confirm: no error banner at the top of the screen

**HARD-BLOCKS-ON-PHONE: YES.**
Cannot verify landmark overlay (Step 3) without a working camera feed.

**⚠️ GAP FLAGGED:** Step prompt does not specify how to navigate to `/camera-test` since it has `href: null`. Resolve by adding a temporary debug nav button or using Dev Client's URL entry before this step.

---

### Step 3 — Add MediaPipe pose detection + EAS build

**Unattended-safe:** Install + code changes + EAS build can run unattended. Landmark verification requires phone + a person.

**Pre-condition to check before build:**
- `react-native-mediapipe-posedetection` in `package.json`
- `camera-test.tsx` updated with frame processor that calls pose detection
- Landmark overlay drawn (dots or lines) visible in JSX

**Pass condition (exact):**
1. EAS build = SUCCESS
2. Camera feed still visible (Step 2 regression — camera did not break)
3. When a **full human body** is in frame: **33 landmark dots or connecting lines appear** overlaid on the video feed at the correct body positions
4. Landmarks track real-time movement — when you move your arm, the wrist/elbow dots follow
5. FPS visible in console (Metro or Xcode console): **≥15fps** is acceptable minimum; ≥20fps is target; <10fps means the device can't handle the pipeline at this resolution
6. No crash when person enters/exits frame

**Fail condition (exact):**
- No overlay visible at all → frame processor not calling MediaPipe, or plugin misconfigured
- Landmarks appear but are in wrong positions → coordinate mapping issue between frame processor output and screen coordinates
- App crashes when person walks in → memory issue or incompatible library version with SDK 54
- FPS < 10 → too slow; consider reducing camera resolution or disabling MediaPipe temporarily to isolate the bottleneck

**Phone test (exact steps):**
1. Open camera-test (same method as Step 2)
2. Point camera at **yourself** — stand 3–5 feet from phone, full body visible
3. **You should see dots on: shoulders, elbows, wrists, hips, knees, ankles, face landmarks**
4. Raise your right arm — the right shoulder/elbow/wrist landmarks should track upward
5. Check Metro/Xcode console for FPS log line — note the number
6. Step out of frame and back in — landmarks should appear/disappear cleanly (no ghost landmarks)
7. Run for 30 seconds — confirm no memory crash

**⚠️ GAP FLAGGED:** Step prompt says "Report fps (visible in logs)" but does not define what FPS is acceptable. Minimum is **15fps** to make shot detection viable. Below that, Step 4 and 5 are pointless. Flag clearly if FPS < 15 and do not proceed to Step 4 until resolved.

**HARD-BLOCKS-ON-PHONE: YES.**
Cannot validate that MediaPipe + vision-camera frame processors coexist before adding a third (TFLite). Running three frame processors on one camera feed is the hardest part of the stack — each one must be proven before adding the next.

---

### Step 4 — Add fast-tflite + basketball model + EAS build

**Unattended-safe:** Code changes and EAS build can run unattended. **CRITICAL MANUAL STEP required before build** (see below). Bounding box verification requires phone + basketball + hoop.

**⚠️ CRITICAL MANUAL STEP BEFORE BUILD — DO NOT SKIP:**
Before running `eas build`, you must manually copy the trained TFLite model:
```
expo/assets/models/basketball_detector.tflite
```
If this file is missing when the build runs, the model will not be bundled in the binary. The build will succeed but the model will not load at runtime. **There is no error at build time — it silently ships without the model.**

Verify: `ls expo/assets/models/` should show `basketball_detector.tflite` before triggering the EAS build.

**Pre-condition to check before build:**
- `react-native-fast-tflite` in `package.json`
- `expo/assets/models/basketball_detector.tflite` EXISTS on disk
- `app.json` `assetBundlePatterns` includes `"assets/models/*"` or `"**/*"`
- `camera-test.tsx` updated to run TFLite on each frame and draw bounding boxes

**Pass condition (exact):**
1. EAS build = SUCCESS
2. Camera feed still visible (regression check)
3. Pose landmarks still visible (regression check)
4. **Hold a real basketball in frame → a bounding box appears around the ball** with "ball" or class-index label and a confidence score
5. **Point at a real basketball hoop → a bounding box appears around the hoop** with "hoop" or class-index label
6. Confidence scores for ball and hoop are **≥ 0.40** (lower means the model is uncertain; below 0.30 is not reliable enough for trajectory tracking)
7. Box follows the ball as you move it (real-time tracking, not a static box)

**Fail condition (exact):**
- No bounding boxes appear at all → model not loading; check `assetBundlePatterns`, confirm file is in binary via Xcode or EAS build artifacts
- App crashes immediately when TFLite runs → INT8 quantization may be incompatible with this device; rebuild with `best_float32.tflite` instead
- Box appears but stays in one spot (not tracking) → frame timestamp mismatch or frame processor not passing current frame to model
- Ball detected but hoop not (or vice versa) → model class mapping issue; check class indices printed by training script Cell 12

**Phone test (exact steps):**
1. Open camera-test
2. Hold a basketball at arm's length, clearly in frame
3. **A rectangle should appear around the ball.** Note the confidence value displayed.
4. Move the ball left/right/closer/further — box should follow
5. Point camera at a basketball hoop (at the gym or outdoors)
6. **A rectangle should appear around the rim.** Note the confidence value.
7. Both overlays (pose landmarks + bounding boxes) should be visible simultaneously — this confirms all three frame processors coexist
8. Write down: ball confidence range, hoop confidence range, FPS (should still be ≥15)

**HARD-BLOCKS-ON-PHONE: YES.**
Step 5 wires `shotDetection.ts` to these boxes. If the boxes are wrong, unreliable, or missing, the detection logic will never work regardless of how good the math is.

---

### Step 5 — Wire shotDetection.ts to live frames

**Unattended-safe:** Code changes are JS-only (no new native modules). Can test with Metro dev reload, **no EAS rebuild needed.** Shot accuracy test requires phone + basketball + hoop.

**Pass condition (exact):**
1. Shot count overlay on screen (e.g., "Makes: 0 / Total: 0") that updates in real time
2. Console logs show `[CV] shot detected: true` when a real shot goes through the hoop
3. Console logs show `[CV] shot detected: false` when a real shot clearly misses
4. **Shooting 5 real makes at a standard hoop: ≥4 detected** (≥80% detection rate)
5. **Walking around the court, dribbling, passing (not shooting): ≤1 false positive per minute** — non-shot ball movements do not trigger shot detection
6. No crash after 20+ frames with ball + hoop in frame simultaneously

**Fail condition (exact):**
- Count never increments → `feedFrame()` not being called, or ball/hoop boxes not being passed correctly from TFLite output
- Every ball movement triggers a shot → false positive storm; arc height threshold or trajectory point minimum is too loose
- Real shots not detected → ball leaves frame before trajectory is complete; `MIN_TRAJECTORY_POINTS` may need loosening
- Makes and misses both log as `true` or both as `false` → trajectory math issue in `shotDetection.ts`; the make/miss math is unrelated to detection — this is a separate failure

**Phone test (exact steps — requires a real basketball hoop):**
1. Open camera-test in portrait/landscape, position phone so hoop is visible and centered
2. Check that hoop bounding box appears (from Step 4) — if not, this test is invalid
3. Shoot **5 makes** deliberately (layups or mid-range, not 3-pointers — close range has cleaner trajectory)
4. Shoot **5 misses** deliberately (airball or off-the-back-of-the-backboard)
5. Note exact count from overlay: makes detected, misses detected, total shot events
6. Walk around for 1 minute without shooting — count any false "shot detected" logs
7. Acceptable: ≥4/5 makes detected, ≤1 false positive in 1 min, misses correctly logged as `false`
8. Report exact numbers — they drive Step 9 calibration

**⚠️ GAP FLAGGED:** The step prompt says "Test by shooting 5 makes and 5 misses" but does not specify distance or hoop setup. For reliable calibration baseline, **use the same hoop and distance for all Step 5 and Step 9 tests.** Mid-range (10–15 feet from a standard 10-foot hoop) is the right baseline — not layups (too close, arc is flat) and not 3-pointers (too far, ball may leave frame).

**HARD-BLOCKS-ON-PHONE: YES.**
Step 6 wires Supabase writes. If shot detection is firing wildly or not firing at all, the database will fill with garbage or stay empty. Step 5 accuracy must be confirmed before writing to Supabase.

---

### Step 6 — Wire shotSync.ts (connect CV to Supabase)

**Unattended-safe:** Code changes are JS-only. No EAS rebuild needed. Supabase verification requires phone + logged-in user + basketball + hoop.

**⚠️ CRITICAL PRE-CONDITION:** The user on the phone **must be logged into the app** (Supabase auth) before testing. All Supabase tables have RLS — writes from an unauthenticated session will silently fail. The step prompt does not mention this. Verify: open the app, confirm you see the Today screen with your plan loaded (not the auth/onboarding flow).

**Pass condition (exact):**
1. Tapping "Start Session" on camera-test returns a `sessionId` string (not null/undefined — confirm in console log)
2. After detecting and logging a shot: **open Supabase dashboard → Table Editor → `shots` table → 1 new row exists** with correct `user_id`, `session_id`, `made` (true/false), `zone`, `timestamp`
3. After tapping "End Session": **`shot_sessions` table has 1 new row** with correct `total_shots`, `makes`, `fg_percentage`
4. `fg_percentage` in `shot_sessions` matches the observed makes/total from the overlay
5. No duplicate rows (tapping "Start Session" twice should not create two sessions)

**Fail condition (exact):**
- `createShotSession()` returns null → check Supabase connection, check user is authenticated, check network
- Rows in `shots` but not in `shot_sessions` → `finalizeShotSession()` not being called or throwing silently; check console for errors
- Rows appear with wrong `user_id` → auth is working but the wrong user is signed in; verify `supabase.auth.getUser()` returns the expected email
- Duplicate shot rows → `feedFrame()` being called after shot is already detected; check `ShotDetector` reset logic

**Phone test (exact steps):**
1. Confirm you are logged in (Today screen shows your plan, not auth/onboarding)
2. Navigate to camera-test
3. Tap **"Start Session"** — note whether a session ID appears in console (or add a brief display)
4. Shoot **10 balls** at the hoop (mix of makes and misses; note actual counts)
5. Tap **"End Session"**
6. Open Supabase dashboard on your computer: `https://supabase.com/dashboard` → your project → Table Editor
7. Check `shots` table: should have exactly 10 rows (approximately — some may miss detection) all with the same `session_id`
8. Check `shot_sessions` table: 1 row with `total_shots` ≈ 10, `makes` matching observed makes, `fg_percentage` = makes/total_shots
9. If numbers are off by ±1: acceptable (1 missed detection is normal)
10. If numbers are completely wrong (0 rows, or 100 rows): fail — debug before Step 7

**HARD-BLOCKS-ON-PHONE: YES.**
Step 7 wires the CV pipeline into the production session flow. If Supabase writes are broken here, the production session will silently lose all CV data. This must be confirmed clean before touching session.tsx.

---

### Step 7 — Replace camera placeholder in session.tsx

**Unattended-safe:** Code changes require an EAS build (session.tsx is a core native screen). EAS build can run unattended. Production session flow verification requires phone + basketball + hoop + full drill sequence.

**Pass condition (exact):**
1. EAS build = SUCCESS
2. Start a session with a **Shooting** or **Finishing** category drill: **back camera feed visible** as the session background (not a dark gradient)
3. Shot count increments during the drill when you shoot at a hoop
4. **HUD still visible:** timer arc, drill name, set/rep count all present on top of the camera feed
5. **Countdowns still work:** 3-2-1 WATCH and 3-2-1 GO overlays appear at drill start
6. **Demo video still plays** fullscreen → PIP transition still works
7. Start a session with a **Ball Handling** or **Conditioning** drill: **dark gradient still appears** (camera does NOT appear on non-shooting drills)
8. Timer auto-advances to next drill — no crash on drill transition when camera starts/stops
9. Exit button (X) works mid-session — no crash on exit while camera is active
10. Session complete screen appears after final drill

**Fail condition (exact):**
- Camera black during shooting drill → `CVCamera` component mounted but not receiving permission or frame processors not running in session context
- Camera appears on non-shooting drills → `drill.category` check is wrong; check category values in drillLibrary.ts
- HUD disappears when camera is active → z-index/absolute positioning conflict between `CVCamera` and `SessionHUD`
- App crashes on drill transition → camera cleanup not happening in `CVCamera` when `sessionId` prop changes to null
- Shot count in session does not update → `onShotDetected` callback not wired to state

**Phone test (exact steps):**
1. Start a real session from the Today screen (not camera-test)
2. Advance to a **Shooting** drill (check drill category label)
3. **Camera feed should be the session background** — you can see the gym/court
4. Point at a hoop, shoot 3 balls — shot counter should increment
5. Let the drill timer run out naturally (or wait for auto-advance)
6. **Immediately check:** did the transition to the next drill work? Is the next drill's HUD correct?
7. On a non-shooting drill: **dark gradient should be the background** (not camera)
8. Tap Exit (X) during a shooting drill — app should return to Today screen without crash
9. Run a complete session end-to-end: every drill, every transition, session complete screen

**⚠️ GAP FLAGGED:** The step prompt says "Test with a shooting drill. Confirm the camera appears, shots are logged, and the rest of the session flow works normally." This is under-specified. The critical regression tests are: (a) non-shooting drills still show gradient, (b) drill transition does not crash camera, (c) exit mid-session does not crash. All three must be verified.

**HARD-BLOCKS-ON-PHONE: YES.**
Step 8 rebuilds shot-results.tsx, which relies on session.tsx passing a `shotSessionId` route param. If Step 7 does not wire that correctly, shot-results has nothing to display.

---

### Step 8 — Rebuild shot-results.tsx

**Unattended-safe:** Pure UI code change. No EAS rebuild needed. Visual + data verification requires phone.

**Pre-condition to check:**
- Verify that `session.tsx` actually passes `shotSessionId` as a route param when navigating to `/shot-results` at session complete. If it does not, `shot-results.tsx` cannot load any data — check this BEFORE running the Step 8 prompt. The step prompt flags this as "you may need to add the param."

**Pass condition (exact):**
1. After completing a session that included a shooting drill: **app navigates to `/shot-results`** (not a crash, not a blank screen, not "coming soon")
2. FG percentage displayed on screen matches the actual makes/total you shot in that session
3. Zone breakdown section shows at least one zone with attempt counts
4. Coach X read text is visible (either loaded from `session.coach_x_read` or fresh API call — either way: text present, not a spinner stuck loading)
5. "Done" button navigates back to the Today tab
6. Colors match the existing app style: dark background, white text, gold accents — no hardcoded colors not in the palette

**Fail condition (exact):**
- Screen crashes immediately on open → `Colors.dark.*` usage; rebuild must use flat Colors object only
- "Coming soon" text visible → old stub still in place; rebuild did not overwrite it
- FG% shows 0% or NaN → `shotSessionId` not passed from session.tsx; check route param wiring
- Coach X read stuck on loading spinner → `getShotSession()` returning null, or `coach_x_read` field missing; check Supabase row for that session
- Zone breakdown empty → shots were all logged with missing zone data; check `ShotDetector.zone` field population

**Phone test (exact steps):**
1. Start a session, ensure it contains a Shooting drill
2. Shoot at least 5 balls during the drill (so there's real data to display)
3. Let the session run to completion (or use the exit flow if it navigates to shot-results on exit)
4. **Shot-results screen should appear automatically**
5. Read the FG% — mentally verify against what you shot (rough check, within ±5% is fine)
6. Scroll down — zone breakdown and Coach X read should both be present
7. Tap "Done" — should land on Today screen
8. Go back to shot-results (router.back or restart session) — it should still load (not crash on second visit)

**⚠️ GAP FLAGGED:** The session.tsx `shot-results` navigation route param wiring is described as "you may need to pass it." This must be explicitly confirmed before running Step 8, because shot-results is entirely data-blind without the sessionId. Check session.tsx's completion flow and add the param if missing as part of this step.

**HARD-BLOCKS-ON-PHONE: YES.**
Step 9 is the calibration loop. If shot-results is broken, you can't see the data that drives calibration decisions.

---

### Step 9 — End-to-end test + calibration

**Unattended-safe:** Threshold analysis and code changes can happen unattended. Calibration EAS build can run unattended. **The actual test shots and accuracy measurement require you + phone + basketball + real hoop.**

**Pre-condition:**
- Full pipeline confirmed working: camera → frame processors → shot detection → Supabase → shot-results screen
- `shotDetection.ts` thresholds are readable (listed in the file header or clearly named constants)

**Pass condition (exact):**
- **≥17/20 makes detected** (≥85% make detection rate) shooting from 10–15 feet at a standard 10-foot hoop
- **≤2 false positives per 10-minute active session** (<10% false positive rate — meaning walking, dribbling, passing do not trigger shot detection)
- Both conditions hold **after a rebuild** — not just in a single good run

**Fail condition (exact):**
- After 3 rounds of threshold adjustments, make detection still < 70% → model accuracy problem, not a threshold problem; retrain the TFLite model with more data or different architecture
- False positive rate cannot be reduced below 20% → trajectory point minimum too loose; check that `MIN_TRAJECTORY_POINTS` requires at least a parabolic arc, not just 2 points

**Phone test (exact steps — use the same conditions every round):**
1. Use the same hoop, same distance (10–15 feet from standard 10-foot rim), same lighting for every calibration round
2. Start a Shooting drill session from the Today screen (not camera-test)
3. Shoot **10 deliberate makes** — clean swishes or bank shots, same motion each time
4. Shoot **10 deliberate misses** — clear airballs or off the back of the rim
5. For 5 minutes: dribble around the key, pass to a wall, do ball-handling moves — no actual shots
6. End the session. Read shot-results screen.
7. **Report to Claude Code:**
   - Makes detected / 10
   - Misses detected / 10
   - False positives in the 5-minute dribbling window
   - Which shot types were missed (layups? pull-ups? catch-and-shoot?)
8. Claude adjusts thresholds → rebuild → repeat from step 1
9. Maximum 3 calibration rounds before declaring a model-quality problem (not a threshold problem)

**⚠️ GAP FLAGGED:** The step prompt says "I will tell you the results after running 10 makes + 10 misses" but does not specify: distance from hoop, hoop height (regulation 10 feet vs lower), or whether a real court is required. These conditions matter because the model was trained on specific court setups. Use regulation conditions (10-foot hoop, 10–15 feet distance) for all calibration testing.

**HARD-BLOCKS-ON-PHONE: YES — fully interactive step.** Cannot proceed to shipping until both accuracy targets are met.

---

### Unattended vs Phone Required — Summary

| Step | EAS Build | Unattended-Safe Parts | Hard Phone Gate |
|------|-----------|----------------------|-----------------|
| 1 | YES | Build queue | ✅ YES — must confirm Dev Client connects + app loads |
| 2 | YES | Install, camera-test.tsx, build | ✅ YES — must confirm live camera feed |
| 3 | YES | Install, code changes, build | ✅ YES — must confirm 33 landmarks + FPS ≥ 15 |
| 4 | YES | Code changes, build (after manual tflite copy) | ✅ YES — must confirm ball + hoop boxes + confidence ≥ 0.40 |
| 5 | NO | Code changes, Metro reload | ✅ YES — must shoot real shots, confirm ≥80% detection, ≤1 false positive/min |
| 6 | NO | Code changes, Metro reload | ✅ YES — must verify Supabase rows in dashboard |
| 7 | YES | Code changes, build | ✅ YES — must verify full session flow + non-shooting drill regression |
| 8 | NO | Code changes, Metro reload | ✅ YES — must verify shot-results screen loads real data |
| 9 | YES (after calibration) | Threshold analysis, rebuild | ✅ YES — iterative: requires real shots every round |

**Every single step has a hard phone gate.** The EAS builds for Steps 1–4 and 7 can queue and run while you're away from the phone. Code changes for Steps 5, 6, 8 can be written unattended. But nothing advances past its gate without physical device verification.

---

## Timeline estimate

4–6 weeks of focused work after Apple Dev is active.
Steps 1–4 are mostly installs + EAS builds (~1 week).
Steps 5–6 are the core algorithm work (~2 weeks).
Steps 7–9 are UI + polish (~1–2 weeks).

---

## Fallback (if Apple Dev stays blocked)

TensorFlow.js + MoveNet/PoseNet running in a WebView component.
Works in Expo Go, ~15–30fps on a modern iPhone.
Discussed and noted — not chosen as primary path, but viable if timeline slips past 3 months.
