# ATHLT Changelog

---

## [Unreleased] — Design System + CV Polish

### Added
- `components/ui/ProgressRing.tsx` — reusable SVG ring component (hero + mini variants)
- `app/workout-preview.tsx` — new screen showing full drill list before starting, with "Begin Workout" gold button
- `cv/schema-fix.sql` — SQL scripts to diagnose and fix the `shot_sessions` FK constraint error
- `store/planStore-audit.md` — documented all known state management bugs and recommendations
- Empty states on History, Record, and drill list screens

### Changed
- `components/TodayHome.tsx` — hero ring now tappable → navigates to workout-preview; profile name in greeting; "why this plan" italic gold text in plan card; day strip shows actual dates; Last Session card gets a green "Active" badge
- `app/(tabs)/film.tsx` — idle screen rebuilt with "Record" header, two big action cards (Track Shots + Upload Film), "Record Game" coming-soon card; Coach X mascot removed
- `app/(tabs)/progress.tsx` — full rebuild as History tab: filter pills (All/Sessions/Games/Film), weekly activity calendar with dots, stats row, session cards, empty state
- `app/(tabs)/more.tsx` — full rebuild as Profile tab: avatar with initials, member since, streak/session stats, menu groups (Training / App / Account)
- `components/PlusActionSheet.tsx` — BlurView frosted glass background, rows inside grouped card, dividers, Cancel button
- `app/open-run.tsx` — BlurView HUD overlays (X button, title, live stat pill), orientation lock, "Stop" with frosted pill button
- `components/cv/PostSessionRecap.tsx` — 64px/300 FG% hero, zone bar chart with color-coded bars, shot timeline dot strip, Coach X gold card
- `app.json` — splash backgroundColor changed from `#0A0A0A` to `#F4EFE6` (warm bone)

---

## 2026-05-25 — CV Native Module + Full Design Rebuild

### Added
- `modules/shot-detector/` — Swift Expo Module wrapping YOLOv11n CoreML model
  - `ShotDetectorModule.swift` — exposes `loadModel()` to JS; serial inference queue; NSLog throughout
  - `ShotDetectorFrameProcessor.swift` — VisionCamera v4 frame processor plugin; 3-frame throttle
  - `ShotDetectorFrameProcessorRegister.m` — ObjC bridge for `+load` registration (Swift cannot use `+load`)
- `plugins/withCoreMLModel.js` — EAS build plugin that copies `cv/best.mlpackage` into the Xcode project
- `lib/cv/ShotTracker.ts`, `lib/cv/ShotSync.ts` — in-memory state machine + Supabase orchestrator
- `lib/shotSync.ts` — direct Supabase persistence for shot sessions and individual shots
- `components/cv/CameraView.tsx` — VisionCamera + worklet frame processor wiring; `DISABLE_FRAME_PROCESSOR` diagnostic toggle
- `components/cv/PostSessionRecap.tsx`, `components/cv/ShotOverlay.tsx` — CV UI components
- `app/open-run.tsx` — free-form CV shooting session screen
- `cv/supabase-schema.sql` — `shot_sessions`, `shots` tables with RLS
- `cv/best.mlpackage` — YOLOv11n trained on basketball detection dataset

### Changed
- `constants/colors.ts` — full design system rebuild: warm bone (#F4EFE6) background, champagne gold (#C9A24A), hairline borders, design tokens for shadows and alphas
- `app/(tabs)/_layout.tsx` — tab bar renamed to Home / Record / History / Profile
- EAS build configured for iOS Ad Hoc with provisioned device UDID

---

## 2026-05-20 — Coach X Mascot Removal + Tab Restructure

### Removed
- Coach X mascot image and speech bubble from TodayHome
- `expo/app/shot-results.tsx` orphaned stub replaced with workout-preview

### Changed
- Tab bar: renamed "Today" → "Home", "Film" → "Record", "Progress" → "History", "More" → "Profile"
- `PlusActionSheet`: removed "Track Shots" and "Game IQ Quiz" rows; kept Ask Coach X, Build a Workout, Log a Game

---

## 2026-05-10 — Session Screen + CV Scaffolding

### Added
- `app/session.tsx` — portrait landscape-aware session: 3-2-1 countdown, YouTube PIP demo, drill HUD timer
- `components/SessionHUD.tsx`, `CountdownOverlay.tsx`, `DemoVideoPip.tsx`, `SessionSetupOverlay.tsx`
- CV stack scaffolded (camera placeholder with LinearGradient)

---

## 2026-04-xx — Core Features

### Added
- Onboarding flow (27 steps, 8 sections) with scroll-wheel pickers and score computation
- Plan generation via Claude Haiku (generate-plan-v3 endpoint)
- Drill library (213 drills, 8 categories)
- Film tab with Gemini 2.5 Flash analysis
- Edit Workout (Manual + Ask Coach X)
- Build a Workout wizard (5 steps)
- Log a Game (saves to Supabase `games` table)
- Game History screen
- Supabase auth + sync
