# ATHLT — Project Context for Claude

> Read this BEFORE doing anything in this codebase. It saves time and prevents mistakes.

This is the technical/project file. There's a separate `~/.claude/CLAUDE.md` (personal preferences) that loads alongside this one — read both.

**Last updated:** 2026-05-17 — full audit pass: dead-file list corrected, active bugs documented, route map added.

---

## Who's building this

- **Founder:** Ari, solo developer
- **Helper:** Eric (handles Apple Developer account, Stripe, future LLC, billing for shared accounts)
- **Location:** California
- **Brand:** ATHLT, under "Scaled Studios"

## What ATHLT is

An AI-powered basketball training app. Coach X (an AI character with personality) builds personalized weekly training plans, analyzes film, and chats with the player about their game. **Coach X is not a feature, he's the product.** Long-term vision: build the entire app AROUND Coach X.

Target user: 12–16 year old basketball players, especially AAU/travel ball.

---

## Tech stack

### App repo: `westari/ATHLT`
- **Framework:** Expo SDK 54, React Native, TypeScript
- **Routing:** Expo Router (file-based, lives in `expo/app/`)
- **State:** Zustand (`planStore`)
- **Auth/storage:** Supabase
- **Local persistence:** AsyncStorage + `react-native-url-polyfill`
- **Icons:** `lucide-react-native`
- **Project ID (EAS):** `soq1hf2k3yx1ie9heuqn3`
- **EAS UUID:** `0eaeb587-8e3a-4b29-a454-a26eb329a971`
- **EAS owner:** `1westari4` (westendorfari@gmail.com) — independent, not Rork-owned
- **Local dev:** Windows 11, VS Code, Node v24.14.1, Git 2.53. Repo at `C:\Users\arize\ATHLT\expo`
- **Test on phone:** `npx expo start` → scan QR in iPhone Camera → Expo Go
- **Also previewed via Rork** (cloud IDE at `/home/user/rork-app/`). Rork pulls from GitHub but LAGS — new files/packages need a commit + manual Rork reload. Recurring friction. Local Expo on the PC does not have this lag.

### Backend repo: `westari/collectiq`
- **Hosting:** Vercel (Pro tier — needed for 300s function timeout for film analysis)
- **DOMAIN (IMPORTANT):** API endpoints are served at **`https://www.tryparlai.com`**. This domain is connected to the `collectiq` Vercel project (left over from the old Parlai project — both share the same Vercel project). All app `fetch()` calls hit `https://www.tryparlai.com/api/...`. The default `collectiq-*.vercel.app` URL also works but `www.tryparlai.com` is what's wired into the app. Long-term: buy a real ATHLT domain before App Store submission, add it to the same Vercel project.
- **Endpoints:**
  - `api/_middleware.js` — CORS, rate limit, body size
  - `api/generate-plan-v3.js` — plan generation (accepts shootingStats from CV)
  - `api/coach-chat.js` — Coach X chat (accepts shootingContext)
  - `api/coach-shot-read.js` — postgame read on a tracked shooting session
  - `api/analyze-film.js` — Gemini film analysis
  - `api/coach-x-edit.js` — **SHIPPED** — current workout + user request → modified drills via Haiku (edit-workout Coach X chat)
  - `api/build-workout.js` — **SHIPPED** — 5 wizard inputs → full workout via Haiku

### AI providers
- **Plan gen + Coach X chat + shot read + build workout + edit workout:** Claude Haiku (`claude-haiku-4-5-20251001`)
- **Film analysis:** Gemini 2.5 Flash (File API, poll every 5s up to 120s for ACTIVE)

### Other services
- **Supabase URL:** `https://tvtojlwdpipntkktguck.supabase.co`
- **Coach X image generation:** Dreamina / Seedream 4.5 (NOT Gemini — character consistency better)
- **YouTube embeds:** `react-native-webview` (session demo PIP)

### Vercel env vars (all set)
- `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_URL` (ATHLT one), `SUPABASE_SERVICE_ROLE_KEY`

---

## Critical file locations

### App (`westari/ATHLT`)
```
expo/app/(tabs)/today.tsx           ← Today/onboarding/climax orchestrator (tab 1)
expo/app/(tabs)/film.tsx            ← Film Room tab — Gemini analysis (tab 2)
expo/app/(tabs)/library.tsx         ← Drill library browser (tab 3)
expo/app/(tabs)/progress.tsx        ← Progress/stats view (tab 4)
expo/app/(tabs)/_layout.tsx         ← Tab navigation — floating dark pill, 4 tabs + gold Plus button
expo/app/(tabs)/more.tsx            ← Settings/logout (hidden — href: null, not in tab bar)
expo/app/(tabs)/coachx.tsx          ← Coach X full screen (hidden — href: null, not in tab bar)
expo/app/index.tsx                  ← Root entry — `<Redirect href="/(tabs)/today" />`
expo/app/+native-intent.tsx         ← Deep-link utility — returns '/'
expo/app/drill/[id].tsx             ← Drill detail screen
expo/app/session.tsx                ← Active session (SHIPPED — landscape, demo PIP, countdowns, HUD)
expo/app/edit-workout.tsx           ← Edit workout (SHIPPED — Manual + Ask Coach X toggle)
expo/app/build-workout.tsx          ← Build a Workout 5-step wizard (SHIPPED)
expo/app/log-game.tsx               ← Log a Game (SHIPPED — minimal stats, saves to Supabase)
expo/app/shot-results.tsx           ← ORPHANED stub — "coming soon"; nothing navigates here yet

expo/components/TodayHome.tsx            ← Home (workout card, day strip, streak/recent, Coach X bubble)
expo/components/CoachXBubble.tsx         ← Coach X image bubble (image asset, text baked in)
expo/components/PlusActionSheet.tsx      ← + menu: Ask Coach X / Build a Workout / Log a Game
expo/components/SessionSetupOverlay.tsx  ← "Rotate phone" animated overlay (shows when portrait)
expo/components/CountdownOverlay.tsx     ← 3-2-1 WATCH / GO countdown
expo/components/DemoVideoPip.tsx         ← YouTube demo: fullscreen → top-right PIP
expo/components/SessionHUD.tsx           ← Bottom HUD: timer arc, reps, set, drill name
expo/components/AuthScreen.tsx           ← Sign up / sign in

expo/lib/supabaseSync.ts            ← Cloud sync helpers
expo/lib/memorySync.ts              ← logDrillResult, logSession
expo/lib/resolveDrill.ts            ← Maps {drillId, time} to full library data
expo/lib/shotDetection.ts           ← Shot detection algo — COMPLETE implementation, not yet connected to camera
expo/lib/shotSync.ts                ← Shot data to Supabase — COMPLETE 474-line implementation, not yet connected to CV

expo/constants/supabase.ts          ← Supabase client
expo/constants/drillLibrary.ts      ← THE 213-DRILL LIBRARY
expo/constants/colors.ts            ← FLAT theme object (NO Colors.dark.* — that's dead/broken)

expo/store/planStore.ts             ← Zustand: plan, profile, completedDrills, currentDayIndex
expo/assets/images/coach-x-bubble.png  ← Coach X bubble image asset
```

### Backend (`westari/collectiq`)
```
api/_middleware.js
api/generate-plan-v3.js
api/coach-chat.js
api/coach-shot-read.js
api/analyze-film.js
api/coach-x-edit.js         ← SHIPPED
api/build-workout.js        ← SHIPPED
api/coach-postgame.js       ← SHIPPED (lives in ATHLT repo root /api — copy to collectiq)
```

### DEAD/LEGACY FILES — do not treat as active
```
expo/components/CoachX.tsx            ← old Coach X UI — superseded; zero imports anywhere; safe to delete
expo/components/ParlayCard.tsx        ← leftover from Parlai era; zero imports from active code; safe to delete
expo/components/TrackWithAIToggle.tsx ← stubbed toggle; never wired; zero imports; safe to delete
expo/lib/coachXLines.ts               ← Coach X copy variants; only imported by dead coachXSelector.ts; safe to delete
expo/lib/coachXSelector.ts            ← line selector; zero imports from any active file; safe to delete
expo/app/library-admin.tsx            ← admin/debug screen; orphaned (nothing navigates here); safe to delete
expo/mocks/parlays.ts                 ← Parlai-era mock data; not imported by any active code
expo/types/parlay.ts                  ← Parlai-era type defs; only referenced by dead ParlayCard + mocks/parlays.ts
```

### NOT dead — still active (previously mislabeled)
```
expo/components/CoachXPill.tsx        ← ACTIVE — rendered in film.tsx (lines 292, 554)
expo/components/CoachXClimax.tsx      ← ACTIVE — rendered in today.tsx (line 1104, onboarding climax)
expo/components/CoachXBottomSheet.tsx ← ACTIVE — imported by CoachXPill.tsx which is used in film.tsx
```

---

## colors.ts — current shape (IMPORTANT)

Flat object, default export. Exact keys:
```
background, surface, surfaceBorder,
textPrimary, textSecondary, textMuted,
primary (#D4A017), accent (alias),
buttonDark (#1A1A1A), buttonDarkText,
black, white, success, warning, danger,
card, border (legacy aliases)
```
**There is NO `Colors.dark.*`.** Files using `Colors.dark.background` are broken old code (caused the shot-results crash — now stubbed).

---

## The drill library (CRITICAL)

`expo/constants/drillLibrary.ts`. **213 drills**, 8 categories:
- Ball Handling (30) `bh-1..30`, Shooting (28) `sh-1..28`, Finishing (27) `fn-1..27`, Defense (25) `df-1..25`, Speed & Agility (25) `sa-1..25`, Warmup & Cooldown (25) `wu-1..25`, Conditioning (25) `cd-1..25`, Basketball IQ (28) `iq-1..28`

Each drill: `id`, `name`, `category`, `duration`, `difficulty`, `equipment`, `type`, `summary`, `steps`, `coachingPoints`, `commonMistakes`, optional `variations`, `videoUrl`.

### Drill flow
1. `generate-plan-v3.js` has the library as a compact INDEX in its prompt. Coach X picks by `drillId`, can't invent drills.
2. Plan shape: `{ drillId: "sh-7", time: "10 min" }`.
3. `resolveDrill.ts` `resolvePlanDrill()` looks up full data.
4. UI renders resolved drill.

**Build a Workout + Coach X edit endpoints return freeform `{name, time}` (not library drillIds).** `resolvePlanDrill` tolerates this. Long-term: match these against the library too.

**Changing drill IDs in `drillLibrary.ts` requires updating DRILL_INDEX in `generate-plan-v3.js`. Manual sync.**

---

## Supabase schema

```
profiles, plans, completed_drills (UNIQUE user_id,day_index,drill_index),
weekly_plans, user_onboarding, skill_state, drill_results, sessions,
film_analyses, shot_sessions (CV, not wired), shots (CV, not wired),
games  ← SHIPPED. Cols: user_id, opponent, result(W/L), your_score,
         opp_score, points, rebounds, assists, notes, played_at,
         created_at. RLS on (auth.uid()=user_id).
```

### Notes
- Free tier: 2 emails/hour auth cap
- `completed_drills` upsert needs the unique constraint
- RLS on all user-data tables
- Email confirmation OFF for testing

---

## What's SHIPPED and working

- Onboarding + skill scoring
- Plan generation (Coach X picks library drills by drillId)
- Plan adapter, drill detail screen
- Coach X chat with memory (last 3 sessions + skill_state + last 10 drill_results)
- **Film tab (DONE)** — Gemini analysis, 4-clip onboarding assessment + ongoing uploads
- **Home (`TodayHome.tsx`)** — workout card w/ ASSIGNED tag, "Day X of 7 · Focus build", day strip, streak square, recent square, Coach X bubble
- **Coach X bubble** — image asset `expo/assets/images/coach-x-bubble.png` (Coach X + gold speech bubble, text baked in). ~60% width, flush-left marginLeft:-16. Many iterations; "good enough, moving on."
- **Edit Workout (DONE)** — toggle Manual | Ask Coach X. Manual = list w/ add/remove. Coach X = chat → proposes → Apply/Try again. Backend `coach-x-edit.js`.
- **Plus action sheet (DONE)** — Ask Coach X (gold) / Build a Workout / Log a Game. Game IQ Quiz + Track Shots removed.
- **Build a Workout (DONE)** — 5-step wizard (Focus→Duration→Environment→Intensity→Notes) → Haiku → preview w/ Coach X message → "Use as today's workout". Backend `build-workout.js`.
- **Log a Game (DONE)** — single screen, minimal stats (opponent, W/L, score, pts/reb/ast, notes). Saves to `games`. No AI feedback v1 (deliberate).
- **Session screen (DONE — camera placeholder)** — landscape; orientation detected via `Dimensions` width>height. Portrait → animated "Rotate phone" overlay (auto-dismiss on rotate). Landscape → per drill: 3-2-1 WATCH → YouTube demo fullscreen → zoom to top-right PIP → 3-2-1 GO → drill timer + HUD → auto-advance. Camera = LinearGradient PLACEHOLDER (real camera pending Apple Dev). Exit X always available. Tap timer to pause. Auto-pause/resume on rotate.
- Backend security, EAS Build configured

## What's NOT done

1. **YouTube IDs** — ~22/213 drills have videos. Session `DEMO_VIDEO_MAP` has placeholder URLs needing real curation (~30 drills cover most sessions).
2. **Apple Developer account** — being paid soon (Eric). Blocks CV, device builds, TestFlight.
3. **Camera + CV wiring** — scaffolded, blocked on Apple Dev.
4. **Paywall** — RevenueCat hybrid IAP/Stripe.
5. **Game History view** — can log games, can't see them back. Quick next win (list from `games`).
6. **Marketing copy** — "Workout from anywhere. Phone + ball." not wired anywhere.
7. **Settings/Profile screen** — needs build-out before App Store.
8. **End-to-end auth/sync verification** — pending.
9. **app.json orientation** — `fix-session-orientation` branch has the fix (changed `portrait` → `default` + global API lock in root layout); NOT yet merged to main. On main/coach-x-postgame, app.json still says `"portrait"`.

## Known active bugs (confirmed 2026-05-17)

1. **toggleDrillComplete doesn't exist** — `session.tsx:70,206` and `drill/[id].tsx:22,68` call `toggleDrillComplete()` which does not exist in `planStore.ts`. The real function is `toggleDrill(dayIndex: number, drillIndex: number)`. Marking drills complete is silently broken in both screens. Also note: `session.tsx` passes a string `(currentDayIndex + '-' + drillIdx)` instead of two numbers — wrong signature.

2. **Coach X bubble navigation broken** — `TodayHome.tsx:94` calls `router.push('/coach-x')`. The file is `app/(tabs)/coachx.tsx` → route is `/coachx` (no hyphen). Tapping the Coach X bubble does nothing.

3. **Edit Workout "Add Drill" button broken** — `edit-workout.tsx:76` calls `router.push('/drill-library?addToToday=true')`. No `drill-library.tsx` route exists. The Add Drill button in manual mode crashes the navigator.

4. **film.tsx uses stale backend URL** — `film.tsx:23` has `BACKEND_URL = 'https://collectiq-xi.vercel.app'` instead of `https://www.tryparlai.com`. Film analysis may silently break if that old URL stops resolving.

---

## Things ruled out — DO NOT re-suggest

- AAU Team Mode, Daily Hoops journaling
- Real-time CV form scoring on every drill (v2+)
- Decision-making mini-games as core
- Coach X AI voice/video daily messages ("creepy")
- Removing drills from library
- "AI replaces your coach" marketing
- Generic gamification as the headline
- Custom drill generation as a headline feature
- 9:16 Shorts embeds (can't render landscape; session is landscape, demos must be 16:9)
- Animated/3D/customizable Coach X for v1 (researched; indie can't build Replika-style; static image is the accepted compromise)
- Pivoting sports (swimming/etc) — researched, rejected, stay basketball
- Pity/encouragement talk — user wants brutal honesty

---

## Computer Vision — current state

Scaffolding-complete. Camera + ML libs NOT installed. Blocked on Apple Developer account.

### Stack (free at runtime)
1. MediaPipe pose detection via `react-native-mediapipe-posedetection` (33 landmarks, on-device)
2. Roboflow `basketball-player-detection-3` as TFLite via `react-native-fast-tflite`
3. `react-native-vision-camera` for camera + frame processors

### Scope (locked)
- v1: make/miss on shooting + finishing. Per-shot court position, release angle, arc height.
- NOT v1: form scoring, dribble move classification, defensive form, travel detection (v2).

### Build steps (AFTER Apple Dev)
1. Expo Go → Expo Dev Client (one-time EAS build)
2. Add vision-camera + EAS build
3. Add mediapipe-posedetection + EAS build
4. Add fast-tflite + basketball-player-detection-3 + EAS build
5. Wire shotDetection.ts to live frames
6. Wire shotSync.ts
7. Replace LinearGradient camera placeholder in session.tsx with real camera + pose overlay
8. Rebuild shot-results.tsx from stub
9. End-to-end test

Realistic: 4-6 weeks focused after Apple Dev.

### Fallback if Apple Dev stays blocked
TensorFlow.js + MoveNet/PoseNet in WebView works in Expo Go, ~15-30fps. Discussed, not chosen.

### Cost
$0 runtime (on-device). Coach X postgame read ~$0.005/call. <$0.01 per CV workout.

---

## Pricing (locked)

Launch **$9.99/month** when CV ships. Market: Hoops AI $3.99, HomeCourt Plus $7.99, Level Up $9.99, DribbleUp $16.99+hardware. Breaking $10/mo requires changing categories (human reviews, hardware, AAU B2B). More AI features alone won't break the ceiling. Year 2: free tier / $9.99 / $24.99 w/ human review. RevenueCat hybrid IAP + Stripe.

---

## Workflow

- Local dev on Windows, VS Code, PowerShell. Working dir `C:\Users\arize\ATHLT\expo`.
- Deps: `--legacy-peer-deps --save` ALWAYS (lucide vs React 19).
- `git pull` before assuming local matches GitHub. If local commits exist: `git pull --rebase`; if unstaged changes block it: `git stash` first.
- New package: install locally → commit package.json + package-lock.json → reload Rork.
- PowerShell: `\` paths, `ls` one path at a time, no `bun` (use `npm install`).
- GitHub web UI sometimes used for quick uploads → causes local/remote drift → fix with pull.

---

## Key technical learnings

- `fetch(uri).blob()` / `atob()` don't work in RN for local file URIs. Use `FormData` with URI.
- Gemini File API: poll every 5s up to 120s until ACTIVE.
- Gemini AND Haiku wrap JSON in markdown backticks — strip before parsing.
- Vercel Pro for 300s timeout. 4.5MB body limit — FormData not base64 for video.
- `react-native-url-polyfill` MUST be imported for Supabase auth in RN.
- All `npm install` need `--legacy-peer-deps --save`.
- PowerShell scripts blocked default. Fix once: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
- `expo-screen-orientation` `lockAsync(LANDSCAPE)` FORCES the screen and makes `getOrientationAsync()` always return landscape — do NOT use for detection. Use `Dimensions.get('window')` width>height as orientation truth.
- YouTube Shorts (9:16) can't render landscape in embeds. Session is landscape → demos must be 16:9.
- Rork: every new file/package needs GitHub commit + manual Rork reload. Recurring.
- Stripping black bg from a Dreamina PNG programmatically = rough edges. Generate transparent natively. OK at small on-screen size.

---

## Coach X — voice and tone

- Real-coach voice. Not AI-sounding, not corporate.
- Short, confident. "Shooting day. Let's eat." "Defense day. Sit down and guard."
- Never claims to have watched film unless he did.
- Direct, honest, no hedging. References real player data when available.
- Vibe: real HS/AAU trainer.
- CV live → always reference real numbers. "Top of key 32%, that's where we live this week."
- Bubble lines: short, no corn. No "champions/warriors/grind/mindset." Locked examples: "Get to work." / "Reps over hype." / "Boring is what builds it." / "Skill is just bored people repeating things."
