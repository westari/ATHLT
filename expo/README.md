# ATHLT

AI-powered basketball training app. Coach X builds personalized weekly training plans, analyzes game film, and tracks shot performance with on-device computer vision.

## What It Does

- **Coach X Plan Gen** — Onboarding collects position, skill levels, and schedule. Claude Haiku generates a 7-day drill plan from a 213-drill library.
- **Session Screen** — Portrait-mode guided workout with per-drill countdowns, YouTube demo PIP, HUD timer, and completion tracking.
- **Film Analysis** — Upload a game clip. Gemini 2.5 Flash returns timestamped moment breakdowns with drill recommendations.
- **CV Shot Tracking** — Camera screen with YOLOv11n CoreML model doing per-frame basketball detection. Makes and misses tracked live.
- **Coach X Chat** — Streaming chat with context from the last 3 sessions, current plan, and skill state.
- **Log a Game** — Quick game stats saved to Supabase.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54, React Native 0.81, TypeScript |
| Routing | Expo Router (file-based) |
| State | Zustand (`planStore`) |
| Auth / DB | Supabase |
| AI — plan / chat | Claude Haiku via `https://www.tryparlai.com` |
| AI — film | Gemini 2.5 Flash (File API) |
| CV — inference | YOLOv11n CoreML (`cv/best.mlpackage`) via custom Expo Module |
| CV — camera | react-native-vision-camera v4 + react-native-worklets-core |
| Build | EAS Build (iOS Ad Hoc) |

---

## Folder Structure

```
expo/
  app/                  — Expo Router screens
    (tabs)/             — Tab screens (today, film, progress, more)
    session.tsx         — Active workout session
    open-run.tsx        — CV shot tracking screen
    workout-preview.tsx — Pre-session drill list + Begin Workout
    log-game.tsx        — Quick game stat logging
    build-workout.tsx   — 5-step workout wizard
    edit-workout.tsx    — Manual edit or Ask Coach X
  components/
    TodayHome.tsx       — Home screen (hero ring, stat cards, plan card)
    ui/ProgressRing.tsx — Reusable SVG ring
    cv/
      CameraView.tsx        — VisionCamera + frame processor wiring
      PostSessionRecap.tsx  — Post-CV session summary screen
  lib/
    shotSync.ts         — Supabase shot session persistence
    cv/ShotTracker.ts   — In-memory shot state machine
    cv/ShotSync.ts      — CV session orchestrator (wraps shotSync)
  modules/
    shot-detector/      — Native Expo Module (Swift CoreML + VisionCamera plugin)
  store/
    planStore.ts        — Zustand: plan, profile, completedDrills, sessions
  constants/
    colors.ts           — Design tokens (warm bone + champagne gold)
    drillLibrary.ts     — 213-drill database
  cv/
    best.mlpackage/     — YOLOv11n CoreML model
    supabase-schema.sql — Shot tracking schema
    schema-fix.sql      — FK troubleshooting + fix SQL
```

---

## Running Locally

```
cd expo
npm install --legacy-peer-deps
npx expo start
```

Scan the QR code with Expo Go. CV features (camera + CoreML) require a Dev Client EAS build.

---

## Building

```bash
# Development (Ad Hoc, installs via link)
npx eas-cli build --platform ios --profile development --non-interactive

# Production (App Store)
npx eas-cli build --platform ios --profile production
```

EAS project: `0eaeb587-8e3a-4b29-a454-a26eb329a971`

---

## Backend

`westari/collectiq` on Vercel, domain `https://www.tryparlai.com`.

| Endpoint | Purpose |
|---|---|
| `/api/generate-plan-v3` | 7-day plan from onboarding answers |
| `/api/coach-chat` | Coach X chat |
| `/api/analyze-film` | Gemini film breakdown |
| `/api/coach-shot-read` | Postgame CV analysis |
| `/api/build-workout` | Wizard → custom workout |
| `/api/coach-x-edit` | Edit workout via chat |

---

## Known Issues

See `store/planStore-audit.md` for the full audit.

1. `toggleDrillComplete` called but doesn't exist — drill completion is silently broken in session
2. `currentDayIndex` not clamped on new plan load — can crash with shorter plans
3. CV frame processor crashes on inference — serial queue + throttle added, not yet confirmed fixed
