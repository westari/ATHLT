# WORK-LOG — Autonomous Audit Session
**Date:** 2026-05-17  
**Branch:** coach-x-postgame  
**Tasks:** Full repo audit + dead-file verification + route map + broken imports + CLAUDE.md update

---

## TASK 1 — Full repo audit against CLAUDE.md

### MISMATCH 1: Dead/legacy file list is WRONG — three files are actively used

CLAUDE.md lists `CoachXPill.tsx`, `CoachXClimax.tsx`, and `CoachXBottomSheet.tsx` as dead/legacy. They are NOT dead.

| File | Listed as dead | Reality |
|------|---------------|---------|
| `components/CoachXPill.tsx` | Yes | **ACTIVE** — rendered in `film.tsx:292` and `film.tsx:554` |
| `components/CoachXClimax.tsx` | Yes | **ACTIVE** — rendered in `today.tsx:1104` (onboarding climax carousel) |
| `components/CoachXBottomSheet.tsx` | Yes | **ACTIVE** — imported by `CoachXPill.tsx:13` which is rendered in `film.tsx` |

`today.tsx` also imports `CoachXPill` on line 16 but does NOT render it in JSX — stale import.

### MISMATCH 2: shotSync.ts and shotDetection.ts described as "NOT wired"

CLAUDE.md says:
- `expo/lib/shotDetection.ts ← Shot detection algo (NOT wired — CV pending)`
- `expo/lib/shotSync.ts ← Shot data to Supabase (NOT wired)`

Reality: Both are **fully-implemented complete files**. `shotSync.ts` is 474+ lines with full Supabase integration. `shotDetection.ts` has a complete ShotDetector class with phase state machine. "NOT wired" correctly means not connected to a camera yet, but the description implies they're stubs — they are not.

### MISMATCH 3: coachXLines.ts and coachXSelector.ts listed as active but are effectively dead

CLAUDE.md lists these in the active lib section:
- `expo/lib/coachXLines.ts ← Coach X line copy variants`
- `expo/lib/coachXSelector.ts ← Selects which Coach X line to show`

Reality: `coachXSelector.ts` imports from `coachXLines.ts`, but **nothing in the active app imports coachXSelector.ts**. Neither file is used anywhere in the running app. The `CoachXBubble.tsx` (which IS active) does NOT use these — it renders a static image.

### MISMATCH 4: Broken navigation — /coach-x route doesn't exist

`TodayHome.tsx:94` calls `router.push('/coach-x')`. The file is `app/(tabs)/coachx.tsx`. In Expo Router, the route is `/coachx` (no hyphen). **Tapping the Coach X bubble silently fails to navigate.**

### MISMATCH 5: Broken navigation — /drill-library route doesn't exist

`edit-workout.tsx:76` calls `router.push('/drill-library?addToToday=true')`. There is no `app/drill-library.tsx` or `app/(tabs)/drill-library.tsx` file. **The "Add Drill" button in Edit Workout (manual mode) crashes the navigator.**

### MISMATCH 6: toggleDrillComplete doesn't exist in planStore

`session.tsx:70` and `drill/[id].tsx:22` destructure `toggleDrillComplete` from `usePlanStore()`. `planStore.ts` only exports `toggleDrill(dayIndex: number, drillIndex: number)`. There is no `toggleDrillComplete`. **Marking drills complete in session and drill detail is broken.**

Additionally, `session.tsx:206` calls it with the wrong signature: `toggleDrillComplete(currentDayIndex + '-' + drillIdx)` (string argument), while the correct function takes `(dayIndex: number, drillIndex: number)`.

### MISMATCH 7: film.tsx has a stale backend URL

`film.tsx:23`: `const BACKEND_URL = 'https://collectiq-xi.vercel.app';`  
CLAUDE.md: all API calls go to `https://www.tryparlai.com`. `collectiq-xi.vercel.app` is the old default Vercel subdomain, not the live production URL.

### MISMATCH 8: app.json orientation still listed as "What's NOT done"

CLAUDE.md item 9 under "What's NOT done" says: `app.json orientation — verify it isn't globally locked to landscape`. The `fix-session-orientation` branch already fixed this (changed `portrait` → `default`), but that branch hasn't been merged to main yet. On `coach-x-postgame`, app.json still says `"portrait"`.

### MISMATCH 9: Hidden tabs description incomplete

CLAUDE.md describes `coachx.tsx` as `← Coach X full screen (hidden — href: null, not in tab bar)`. The actual `coachx.tsx` is a full chat screen with film upload, message history, streaming response, and plan context — significantly more than "full screen". Minor.

### MISMATCH 10: Undocumented files not in CLAUDE.md

| File | Status |
|------|--------|
| `app/index.tsx` | Root entry; just a `<Redirect href="/(tabs)/today" />` — not documented |
| `app/+native-intent.tsx` | Deep-link utility; returns `'/'` — not documented |
| `constants/exampleAnalysis.ts` | Film tab example data; exists but not imported anywhere |
| `mocks/parlays.ts` | Parlai-era mock data — imports `@/types/parlay` |
| `mocks/parlay.ts` | Does not exist (mocks/ only has `parlays.ts`) |
| `types/parlay.ts` | Parlai-era type definitions; only referenced by ParlayCard.tsx (dead) and mocks/parlays.ts (dead) |

### MISMATCH 11: Stack.Screen registrations incomplete

`app/_layout.tsx` (root) only registers `(tabs)`, `session`, `drill/[id]` as explicit `Stack.Screen` entries. The following routes work via Expo Router auto-discovery but have no explicit screen config:
- `build-workout`, `edit-workout`, `log-game`, `shot-results`, `library-admin`

Not a runtime bug in Expo Router v3, but a gap between intent and config.

### MISMATCH 12: Backend file list is ambiguous

CLAUDE.md lists `api/coach-postgame.js` as `← SHIPPED (lives in ATHLT repo root /api — copy to collectiq)`. The other backend files listed (`api/generate-plan-v3.js`, etc.) are in the `collectiq` repo, but they're listed in the ATHLT CLAUDE.md with no annotation saying they're in a different repo. Technically accurate but confusing.

---

## TASK 2 — Safe-to-delete verification (grep proof)

Files the user listed as candidates. Verified against all `.ts` and `.tsx` files in `expo/`.

### components/CoachX.tsx
Grep: `from.*CoachX[^B]` across all files  
Result: Only internal definitions (`CoachX.tsx:28: export default function CoachX()`). No other file imports it.  
**SAFE TO DELETE.**

### components/CoachXBottomSheet.tsx
Grep: `from.*CoachXBottomSheet`  
Result: `components/CoachXPill.tsx:13: import CoachXBottomSheet from './CoachXBottomSheet';`  
`CoachXPill.tsx` IS imported by `film.tsx` (rendered at lines 292, 554).  
**NOT SAFE TO DELETE — actively used via film.tsx → CoachXPill → CoachXBottomSheet chain.**

### components/CoachXClimax.tsx
Grep: `from.*CoachXClimax`  
Result: `app/(tabs)/today.tsx:17: import CoachXClimax from '@/components/CoachXClimax';`  
Used at `today.tsx:1104` in `appState === 'climax'` branch (onboarding finale).  
**NOT SAFE TO DELETE — actively rendered in today.tsx.**

### components/CoachXPill.tsx
Grep: `from.*CoachXPill`  
Result:
- `app/(tabs)/film.tsx:17: import CoachXPill from '@/components/CoachXPill';` → rendered at lines 292 and 554
- `app/(tabs)/today.tsx:16: import CoachXPill from '@/components/CoachXPill';` → imported but NOT rendered in JSX (stale import only)  
**NOT SAFE TO DELETE — actively rendered in film.tsx.**

### components/ParlayCard.tsx
Grep: `from.*ParlayCard`  
Result: No matches outside of `ParlayCard.tsx` itself.  
Grep: `ParlayCard` across all files  
Result: Only self-references within `ParlayCard.tsx`.  
**SAFE TO DELETE.**

### components/TrackWithAIToggle.tsx
Grep: `from.*TrackWithAI`  
Result: No matches.  
Grep: `TrackWithAIToggle` across all files  
Result: Only self-references within `TrackWithAIToggle.tsx`.  
**SAFE TO DELETE.**

### lib/coachXLines.ts
Grep: `from.*coachXLines`  
Result: `lib/coachXSelector.ts:13: } from './coachXLines';` — only `coachXSelector.ts` imports it.  
`coachXSelector.ts` is not imported by any active file (see below).  
**SAFE TO DELETE (but only alongside coachXSelector.ts — deleting this alone would break coachXSelector.ts, though coachXSelector is itself dead).**

### lib/coachXSelector.ts
Grep: `from.*coachXSelector`  
Result: No matches outside of `coachXSelector.ts` itself.  
No active screen imports this file.  
**SAFE TO DELETE.**

### app/library-admin.tsx
Grep: `library-admin` across all files  
Result: Only self-references within `library-admin.tsx`.  
No `router.push('/library-admin')` or `href='/library-admin'` anywhere.  
**SAFE TO DELETE.**

### Summary: Safe-to-delete list
| File | Safe? | Reason |
|------|-------|--------|
| `components/CoachX.tsx` | YES | Zero imports anywhere |
| `components/ParlayCard.tsx` | YES | Zero imports anywhere |
| `components/TrackWithAIToggle.tsx` | YES | Zero imports anywhere |
| `lib/coachXSelector.ts` | YES | Zero imports anywhere |
| `lib/coachXLines.ts` | YES | Only imported by dead coachXSelector.ts |
| `app/library-admin.tsx` | YES | Not navigated to from anywhere |
| `components/CoachXBottomSheet.tsx` | NO | Active via film.tsx → CoachXPill chain |
| `components/CoachXClimax.tsx` | NO | Active — rendered in today.tsx |
| `components/CoachXPill.tsx` | NO | Active — rendered in film.tsx |

---

## TASK 3 — Complete route map

All files under `expo/app/` and their route/reachability status.

### Root-level utilities
| File | Route | Reachable | Notes |
|------|-------|-----------|-------|
| `app/index.tsx` | `/` | Yes (auto on app open) | `<Redirect href="/(tabs)/today" />` — just a redirect |
| `app/+native-intent.tsx` | N/A | Utility only | Deep-link handler; returns `'/'` |
| `app/_layout.tsx` | N/A | Root layout | Stack + fonts + splash; not a route |

### Tab screens (`app/(tabs)/`)
| File | Route | In Tab Bar | Reachable | Notes |
|------|-------|-----------|-----------|-------|
| `app/(tabs)/_layout.tsx` | N/A | Root tabs layout | Custom pill tab bar + PlusActionSheet |
| `app/(tabs)/today.tsx` | `/today` | YES — Tab 1 (Home icon) | Yes (default) | Onboarding + plan view + climax |
| `app/(tabs)/film.tsx` | `/film` | YES — Tab 2 (Video icon) | Yes | Film Room; Gemini analysis |
| `app/(tabs)/library.tsx` | `/library` | YES — Tab 3 (BookOpen icon) | Yes | Drill library browser |
| `app/(tabs)/progress.tsx` | `/progress` | YES — Tab 4 (BarChart3 icon) | Yes | Progress/stats view |
| `app/(tabs)/more.tsx` | `/more` | NO (href:null) | Yes — `TodayHome.tsx:89` pushes `/more` | Settings/logout |
| `app/(tabs)/coachx.tsx` | `/coachx` | NO (href:null) | **BROKEN** — `TodayHome.tsx:94` pushes `/coach-x` (hyphen mismatch); tapping Coach X bubble does nothing | Full chat screen |

### Stack screens
| File | Route | Reachable | Who links here |
|------|-------|-----------|----------------|
| `app/session.tsx` | `/session` | Yes | `TodayHome.tsx:79` |
| `app/drill/[id].tsx` | `/drill/[id]` | Yes | `TodayHome.tsx:192`, `film.tsx:502` |
| `app/edit-workout.tsx` | `/edit-workout` | Yes | `TodayHome.tsx:84` |
| `app/build-workout.tsx` | `/build-workout` | Yes | `PlusActionSheet.tsx:71` |
| `app/log-game.tsx` | `/log-game` | Yes | `PlusActionSheet.tsx:86` |
| `app/shot-results.tsx` | `/shot-results` | **ORPHANED** | Nothing navigates here — CV flow not wired yet |
| `app/library-admin.tsx` | `/library-admin` | **ORPHANED** | Nothing navigates here — debug screen, dead |

### Not registered in root Stack.Screen
`build-workout`, `edit-workout`, `log-game`, `shot-results`, `library-admin` are NOT in the `Stack.Screen` entries in `app/_layout.tsx`. They work via Expo Router auto-discovery. Not a crash, but they have no explicit screen config.

---

## TASK 4 — Broken imports

### BROKEN 1: toggleDrillComplete (session.tsx)
`app/session.tsx:70`:
```typescript
const { plan, currentDayIndex, completedDrills, toggleDrillComplete } = usePlanStore();
```
`app/session.tsx:206`:
```typescript
toggleDrillComplete(currentDayIndex + '-' + drillIdx);
```
`planStore.ts` exports `toggleDrill(dayIndex: number, drillIndex: number)`. `toggleDrillComplete` does not exist. The string argument `(currentDayIndex + '-' + drillIdx)` is also the wrong signature. **Drill completion marking in session does not work.**

### BROKEN 2: toggleDrillComplete (drill/[id].tsx)
`app/drill/[id].tsx:22`:
```typescript
const { plan, currentDayIndex, completedDrills, toggleDrillComplete } = usePlanStore();
```
`app/drill/[id].tsx:68`:
```typescript
toggleDrillComplete(currentDayIndex, drillIndex);
```
Same issue — function doesn't exist. **Drill completion marking in drill detail does not work.**

### BROKEN 3: /coach-x route (TodayHome.tsx)
`components/TodayHome.tsx:94`:
```typescript
router.push('/coach-x');
```
File is `app/(tabs)/coachx.tsx` → route is `/coachx`. The hyphen causes a 404. **Tapping the Coach X bubble silently fails.**

### BROKEN 4: /drill-library route (edit-workout.tsx)
`app/edit-workout.tsx:76`:
```typescript
router.push('/drill-library?addToToday=true');
```
No `app/drill-library.tsx` file exists. **"Add Drill" in Edit Workout (manual mode) crashes the navigator.**

### BROKEN 5: Stale backend URL (film.tsx) — functional issue, not an import error
`app/(tabs)/film.tsx:23`:
```typescript
const BACKEND_URL = 'https://collectiq-xi.vercel.app';
```
CLAUDE.md and all other API calls use `https://www.tryparlai.com`. `collectiq-xi.vercel.app` is the old default Vercel subdomain. Whether it still resolves is unknown — if that URL gets recycled by Vercel it will break film analysis silently.

### BROKEN 6: Stale import in today.tsx (cosmetic only)
`app/(tabs)/today.tsx:16`:
```typescript
import CoachXPill from '@/components/CoachXPill';
```
`CoachXPill` is never rendered in JSX in `today.tsx`. Stale import. No crash, but bloats the bundle.

### Imports that look suspicious but are fine
- `mocks/parlays.ts` imports `{ Parlay, Plan }` from `@/types/parlay` — both exist in `types/parlay.ts`. No crash (but the whole mocks/ directory is dead Parlai legacy).
- `ParlayCard.tsx` imports `{ Parlay }` from `@/types/parlay` — exists. No crash.
- `shotSync.ts` imports `type { DetectedShot }` from `./shotDetection` — type exists. Fine.
- `supabaseSync.ts` imports `type { TrainingPlan, PlayerProfile }` from `@/store/planStore` — both exported. Fine.

---

## TASK 5 — CLAUDE.md update

See Task 6 for confirmation that changes were applied correctly.

Changes made to CLAUDE.md:
1. Updated "Last updated" line
2. Corrected DEAD/LEGACY FILES section — removed CoachXPill, CoachXClimax, CoachXBottomSheet from dead list; added coachXLines.ts and coachXSelector.ts to dead list
3. Updated shotDetection.ts and shotSync.ts descriptions to say "complete, not yet connected" instead of "NOT wired"
4. Added coachXLines.ts and coachXSelector.ts to dead files section
5. Added app/index.tsx and app/+native-intent.tsx to critical file locations
6. Updated "What's NOT done" item 9 to note that fix-session-orientation branch has the fix but not yet merged
7. Added "Known active bugs" section with the 4 confirmed bugs

---

## TASK 6 — CLAUDE.md change confirmation

Re-read CLAUDE.md after all edits. Verified:

| Change | Expected | Confirmed |
|--------|----------|-----------|
| Last updated line | "2026-05-17 — full audit pass..." | YES |
| app/index.tsx in file list | Added with redirect note | YES |
| app/+native-intent.tsx in file list | Added with utility note | YES |
| shot-results.tsx description | "ORPHANED stub" | YES |
| shotDetection.ts description | "COMPLETE implementation, not yet connected to camera" | YES |
| shotSync.ts description | "COMPLETE 474-line implementation, not yet connected to CV" | YES |
| coachXLines.ts removed from active lib section | Removed from active list | YES |
| coachXSelector.ts removed from active lib section | Removed from active list | YES |
| Dead files section — CoachXPill removed | Removed | YES |
| Dead files section — CoachXClimax removed | Removed | YES |
| Dead files section — CoachXBottomSheet removed | Removed | YES |
| Dead files section — coachXLines.ts added | Added with "safe to delete" note | YES |
| Dead files section — coachXSelector.ts added | Added with "safe to delete" note | YES |
| Dead files section — mocks/parlays.ts added | Added | YES |
| Dead files section — types/parlay.ts added | Added | YES |
| "NOT dead" section added | CoachXPill, CoachXClimax, CoachXBottomSheet listed as active | YES |
| Known active bugs section | 4 confirmed bugs with file:line refs | YES |
| app.json orientation item updated | Notes fix-session-orientation branch has fix, not yet merged | YES |

One additional correction made during Task 6 re-read: `coachXLines.ts` and `coachXSelector.ts` were still listed in the active lib file section. Removed them from there so they only appear in the dead files section.

All changes confirmed correct.

---

---

## SESSION 2 — Bug fixes + dead file deletion (2026-05-17)

### TASK 1 — Fix stale BACKEND_URL in film.tsx
**Status: DONE**

File: `app/(tabs)/film.tsx:23`

Before: `const BACKEND_URL = 'https://collectiq-xi.vercel.app';`  
After:  `const BACKEND_URL = 'https://www.tryparlai.com';`

No other BACKEND_URL references in that file — the one constant drives both `fetch()` calls at lines 192 and elsewhere.

---

### TASK 2 — Fix 3 broken routes/imports

#### 2a. toggleDrillComplete — drill/[id].tsx
**Status: FIXED**

`drill/[id].tsx:22`: `toggleDrillComplete` → `toggleDrill`  
`drill/[id].tsx:68`: `toggleDrillComplete(currentDayIndex, drillIndex)` → `toggleDrill(currentDayIndex, drillIndex)`

The real function in `planStore.ts` is `toggleDrill(dayIndex: number, drillIndex: number)`. Signature matches exactly — no other changes needed.

#### 2b. toggleDrillComplete — session.tsx
**Status: CANNOT FIX — session.tsx is off-limits per task instructions**

`session.tsx:70` still destructures `toggleDrillComplete` (which doesn't exist).  
`session.tsx:206` still calls it with a wrong signature (`currentDayIndex + '-' + drillIdx` string instead of two numbers).  
Fix when session.tsx becomes available: change to `toggleDrill(currentDayIndex, drillIdx)` and remove string concatenation.

#### 2c. /coach-x hyphen mismatch — TodayHome.tsx
**Status: FIXED**

`components/TodayHome.tsx:94`: `router.push('/coach-x')` → `router.push('/coachx')`

Route is `app/(tabs)/coachx.tsx` → Expo Router path is `/coachx`. Coach X bubble tap now routes correctly.

#### 2d. /drill-library nonexistent route — edit-workout.tsx
**Status: PARTIALLY FIXED (crash prevented; feature not implemented)**

`edit-workout.tsx:76`: `router.push('/drill-library?addToToday=true')` replaced with:
```typescript
Alert.alert('Coming soon', 'Drill picker will be added when the library screen gets add-to-workout support.');
```

Cannot fully fix: the "Add Drill" feature requires a drill picker screen (`drill-library.tsx` or an overlay) that doesn't exist. Building it requires: (1) a new screen or modal, (2) a way to return a selected drill back to edit-workout, (3) wiring it to `updateDayDrills`. This is a feature build, not a reference fix. The Alert stub prevents the navigator crash; the button still shows but is non-destructive.

---

### TASK 3 — Delete 6 verified dead files
**Status: DONE — typecheck confirmed no new errors**

Files deleted:
- `components/CoachX.tsx` ✓
- `components/ParlayCard.tsx` ✓
- `components/TrackWithAIToggle.tsx` ✓
- `lib/coachXSelector.ts` ✓
- `lib/coachXLines.ts` ✓
- `app/library-admin.tsx` ✓

Active files confirmed still present: `CoachXPill.tsx`, `CoachXClimax.tsx`, `CoachXBottomSheet.tsx`

**Typecheck result:** Errors exist but ALL are pre-existing — none introduced by deletions or fixes.

Pre-existing errors (not caused by this session's changes):
| File | Line | Error | Pre-existing? |
|------|------|-------|--------------|
| `session.tsx:70` | 70 | `toggleDrillComplete` not on PlanStore | YES — off-limits, logged above |
| `edit-workout.tsx:30` | 30 | `updateDayDrills` not on PlanStore | YES — pre-existing |
| `build-workout.tsx:62` | 62 | `updateDayDrills` not on PlanStore | YES — pre-existing |
| `drill/[id].tsx:105` | 105 | YoutubePlayer `state` param implicit `any` | YES — pre-existing |
| `TodayHome.tsx:192` | 192 | Dynamic string not assignable to typed route | YES — pre-existing |
| `film.tsx:200,268` | 200,268 | `PlayerProfile.description`, `PlanDay` type mismatch | YES — pre-existing |
| `progress.tsx:94,119,142` | multiple | `height`/`width: string` not DimensionValue | YES — pre-existing |
| `drillLibrary.ts:33+` | multiple | `youtubeId` not on Drill type | YES — pre-existing |

The `toggleDrillComplete` error in `drill/[id].tsx` is **GONE** (fixed by this session).

---

## SESSION 3 — Production YOLOv8 training script (2026-05-17)

### What was built

**`scripts/train_basketball_model.py`** — complete rewrite of the prior stub into a production-ready 12-cell Colab training script.

**`scripts/README.md`** — new file documenting the full training workflow.

---

### Script structure (12 cells)

| Cell | Purpose |
|------|---------|
| 1 | Config — all user-tunable values in one place (API key, model, epochs, export flags) |
| 2 | Google Drive mount — actual code, not just a comment |
| 3 | Dependency install via `subprocess.check_call` so it works as a .py file, not just in Colab magic cells |
| 4 | GPU verification with hard fail if no CUDA — forces user to fix before wasting time |
| 5 | Roboflow dataset download with API key validation guard |
| 6 | Dataset validation — checks class names, warns if ball/hoop missing, counts images per split |
| 7 | Training with augmentation config tuned for basketball (scale=0.5 for ball size variance, flipud=False since gravity, HSV for lighting variance) |
| 8 | Validation + per-class AP metrics with target thresholds printed |
| 9 | Dual TFLite export (float32 + INT8 quantized) with error handling — INT8 failure gracefully falls back |
| 10 | Drive backup — copies weights + full run directory |
| 11 | Quick inference test on a val image — verifies ball/hoop detections appear |
| 12 | Summary printout with class indices and next steps |

---

### Key decisions and rationale

**Resume training support:** Cell 7 checks for `last.pt` and prompts to resume. Colab disconnects are common during a 45-min training run — this was missing from the prior stub.

**Dual TFLite export (float32 + INT8):** INT8 is ~3x smaller (~2MB vs ~6MB) and faster on iPhone A-series Neural Engine. However INT8 quantization occasionally fails depending on ultralytics version. The script exports both and wraps INT8 in try/except with a clear fallback message.

**Model choice (yolov8n default):** Nano is the right default for real-time on-device inference on iPhone (~30fps on A15 Bionic). `yolov8s` is documented as a fallback if mAP is below target — user can change `BASE_MODEL` in Cell 1 without touching anything else.

**100 epochs default:** The prior stub used 50. For a production model, 100 epochs with patience=15 (early stopping) is the right default. If it converges at epoch 72, early stopping fires and you don't waste Colab time.

**Augmentation config:** Tuned specifically for basketball detection:
- `scale=0.5` — ball appears at wildly different sizes (close-range vs half-court shot)
- `flipud=0.0` — NO vertical flip (gravity doesn't flip; an upside-down court breaks detection)
- `fliplr=0.5` — horizontal flip fine (court is symmetric)
- `hsv_s=0.7, hsv_v=0.4` — broad lighting augmentation (indoor gym vs outdoor court have very different lighting)
- `mosaic=1.0` — mosaic kept on; helps the model learn ball in context

**No class filtering during training:** The Roboflow dataset has ball, hoop, player (and sometimes made/missed). Training on all classes and filtering at inference is simpler and safer than trying to modify the YOLO annotations. At inference, `shotDetection.ts` will use the class indices printed in Cell 12 to filter for ball + hoop only.

**TFLite output tensor format:** Documented in Cell 9 comments for the Step 4 engineer:
- Output shape: `[1, num_predictions, 4+nc]`
- Columns 0–3: x_center, y_center, width, height (normalized)
- Columns 4+: class confidence scores

**Drive backup copies full run dir:** Not just weights — also copies the training curves, confusion matrix, and PR curve plots. These are useful for model analysis and deciding whether to retrain.

---

### What the README covers

- Prerequisites (Roboflow account, API key)
- Option A (upload .py) vs Option B (copy cells) for Colab setup
- Cell-by-cell time estimates
- How to read the metrics output
- Which TFLite model to use and why
- How to resume after a disconnect
- Class index mapping (what numbers ball/hoop will be in the output tensors)
- File tree of training artifacts

---

## SESSION 4 — Step-by-step pass/fail + phone test map (2026-05-17)

Added section "STEP-BY-STEP PASS/FAIL + PHONE TEST MAP" to CV-PLAN.md covering all 9 native integration steps.

---

### What was produced per step

For each of the 9 steps, the section contains:
- **(a) Exact pass condition** — specific observable outcomes, not "it works"
- **(b) Exact fail condition** — specific failure modes with likely root causes
- **(c) Pre-conditions to check** — things that must be true before starting the step
- **(d) Phone test** — numbered steps for what to physically do and what to look for
- **(e) Unattended-safe classification** — what can run while away vs what needs physical presence

---

### Unattended vs phone gate summary

Every step has a hard phone gate. No step is safe to skip-verify. The EAS builds for Steps 1–4 and 7 can queue and run unattended; code changes for Steps 5, 6, 8 can be written unattended. Nothing advances past its gate without a physical device test.

| Step | Build needed | What blocks | Hard gate condition |
|------|-------------|-------------|---------------------|
| 1 | YES (EAS) | Dev Client connects, app loads | Today screen visible in Dev Client |
| 2 | YES (EAS) | Live camera feed | Real-time video visible in camera-test |
| 3 | YES (EAS) | 33 landmarks at ≥15fps | Landmark dots on body, FPS logged |
| 4 | YES (EAS) | Ball + hoop boxes at conf ≥0.40 | Manual tflite copy first; then boxes visible |
| 5 | NO (Metro) | Shot detection accuracy | ≥4/5 makes, ≤1 false positive/min |
| 6 | NO (Metro) | Supabase rows correct | 10 rows in shots, 1 in shot_sessions |
| 7 | YES (EAS) | Full production session flow | Camera on shooting drills, gradient on others |
| 8 | NO (Metro) | Shot-results screen loads real data | FG%, zones, Coach X read all visible |
| 9 | YES (after calibration) | Accuracy targets | ≥17/20 makes, ≤2 false positives/10 min |

---

### Gaps found and flagged in the original step prompts

6 gaps found across the 9 steps:

1. **Step 2:** No specification of how to navigate to `/camera-test` (hidden from tab bar). Needs a temporary debug button or Dev Client URL entry.

2. **Step 3:** No FPS threshold defined in the original prompt. Added: minimum 15fps, target 20fps. Below 10fps is a blocker.

3. **Step 4:** CRITICAL — tflite file must be manually copied to `expo/assets/models/` BEFORE the EAS build. If forgotten, build succeeds but model is silently absent at runtime. No build-time error.

4. **Step 6:** CRITICAL — user must be logged in on the phone (Supabase RLS). Not mentioned in original prompt. Supabase writes silently fail for unauthenticated users.

5. **Step 7:** Under-specified regression tests. The three critical regressions (non-shooting drills stay gradient, drill transition doesn't crash camera, exit mid-session doesn't crash) were not listed. Added all three.

6. **Steps 5 + 9:** No specification of distance/hoop height for test shots. Added: use regulation conditions (10-foot hoop, 10–15 feet distance) for all accuracy testing. Inconsistent conditions across calibration rounds produce meaningless numbers.

---

## SESSION 5 — CV-PLAN.md gap fixes: step prompt rewrites (2026-05-17)

Task: rewrite the 6 flagged step prompts in CV-PLAN.md so each gap is handled directly in the instruction, not just noted.

All 6 prompts rewritten (Steps 2, 3, 4, 5, 6, 7; Step 9 also updated for calibration):

### Step 2 — Navigation to /camera-test
Added step 5 to the prompt: add a temporary "Camera Test →" debug button to TodayHome.tsx calling `router.push('/camera-test')`. This is the only way to reach the screen since it has `href: null`. Renumbered EAS build to step 6. Updated post-build instructions to use the debug button.

### Step 3 — FPS thresholds
Added step 4: add FPS counter to camera-test overlay (1000ms / timestamp delta between last two frames). Replaced "Report fps" with explicit thresholds built into the prompt: ≥20 green, 15–19 acceptable, 10–14 marginal/investigate, <10 HARD STOP.

### Step 4 — TFLite pre-build check + runtime load check
Added PRE-BUILD CHECK block at the top of the prompt: `ls expo/assets/models/` must show `basketball_detector.tflite` before a single line of code is written. Added step 6: model status line in overlay ("Model: loaded ✓" or "Model: FAILED"). Updated post-build instructions to check model status line first.

### Step 5 — Calibration setup
Added CALIBRATION SETUP block: regulation 10-foot hoop, 10–15 feet distance, phone on chair/tripod with hoop in upper half, indoor gym or well-lit outdoor, standard set shot. Added 2-minute non-shooting false positive test (walk, dribble, pass — no shooting). Expanded reporting requirements.

### Step 6 — Login pre-condition (RLS)
Added CRITICAL note about RLS silent failures. Added PRE-TEST CHECK block with 4 steps: confirm Today screen shows plan (not sign-in), and optional temp `auth.getUser()` log if unsure. Added sessionId null-check after `createShotSession()` call. Referenced calibration setup from Step 5.

### Step 7 — Regression checks
Added REGRESSION CHECKS block with all 3 required verifications:
- (a) Non-shooting drills must still show dark gradient, not camera — drill.category check must be correct
- (b) Drill transition from shooting drill must not crash — CVCamera cleanup must fire when sessionId prop changes to null
- (c) Mid-session exit via X button during shooting drill must not crash

Updated the test instruction from "Test with a shooting drill" to require a full end-to-end run with explicit pass/fail reporting on all three regression checks.

### Step 9 — Calibration setup
Added CALIBRATION SETUP block identical to Step 5 setup (regulation 10-foot hoop, 10–15 feet, same positioning/lighting/shot type). Added note that Step 5 and Step 9 must use the same setup so accuracy numbers are comparable across rounds. Updated step 2 of "Do the following" to say "I will run 10 makes + 10 misses using the calibration setup above."

---

## SESSION 6 — Fix: hide tab bar + plus button during onboarding (2026-05-17)

**Bug:** Tab bar (floating pill + gold + button) visible during onboarding. Should be full-screen with no navigation chrome until onboarding completes.

**Root cause:** The entire onboarding flow (`welcome` → `onboarding` → `readback` → `focuspick` → `auth` / `signin` → `analyzing` → `climax`) is local `appState` inside `today.tsx`, which lives inside the `(tabs)` group. `CustomTabBar` in `(tabs)/_layout.tsx` rendered unconditionally — it had no awareness of `appState`.

**Approach:** Add `onboardingComplete: boolean` to `planStore` (not persisted — in-memory UI state). `today.tsx` sets it `true` at every point where `setAppState('plan')` is called. `CustomTabBar` reads it and returns `null` when false.

Alternative considered and rejected: Moving onboarding routes out of the `(tabs)` group to the root Stack. That would have required extracting all onboarding JSX from `today.tsx` into a separate file — significant refactoring with high breakage risk. The store flag is minimal and non-breaking.

---

### Files changed

#### `expo/store/planStore.ts`
- Added `onboardingComplete: boolean` to `PlanStore` interface
- Added `setOnboardingComplete: (val: boolean) => void` to interface
- Initialized `onboardingComplete: false` in the store
- Added `setOnboardingComplete` action
- Added `onboardingComplete: false` to `clearAll()` so logout resets the flag (tab bar hides again on logout)

#### `expo/app/(tabs)/today.tsx`
- Added `setOnboardingComplete` to the `usePlanStore()` destructure
- Called `setOnboardingComplete(true)` at all 4 locations where `setAppState('plan')` is called:
  1. Line 316: initial load — returning user has `plan && profile` already in storage
  2. Line 1032: inside the `auth` state callback — existing user signs in and loads their stored plan
  3. Line 1058: inside the `signin` state callback — sign-in flow, plan found in DB
  4. Line 1106: `CoachXClimax.onComplete` — new user completes the dramatic plan reveal

#### `expo/app/(tabs)/_layout.tsx`
- Added `import { usePlanStore } from '@/store/planStore'`
- In `CustomTabBar`, added `const onboardingComplete = usePlanStore(s => s.onboardingComplete)`
- Added `if (!onboardingComplete) return null` as the first line after hooks — hides the entire pill tab bar + gold + button during onboarding

---

### What this preserves
- All 4 tabs, the tab bar appearance, and the + button are unchanged post-onboarding
- `PlusActionSheet` is not rendered during onboarding (safe — it uses `visible={plusOpen}` state which only exists when bar is mounted)
- Logout (`clearAll()`) resets `onboardingComplete` to false, so the tab bar correctly hides again after logout and the user sees the welcome/onboarding flow without nav chrome
- No changes to onboarding logic, routing, or post-onboarding navigation

---

## SESSION 7 — Deployment branch audit + CV Step 1 readiness (2026-05-17)

---

### PHASE 1a — Branch / deployment state

**Command run:** `git log --oneline origin/main -5` and `git log --oneline origin/coach-x-postgame -5`

#### Branch state (exact, as of 2026-05-17)

| Commit | Message | main | coach-x-postgame | fix-session-orientation |
|--------|---------|------|-----------------|------------------------|
| `34d5040` | Use coach-x-film.png in film tab idle header | ❌ NOT here | ✅ YES | ❌ NOT here |
| `c4e9971` | Fix onboarding tab bar visibility; bug fixes; dead file cleanup; CV plan + training scripts | ❌ NOT here | ✅ YES | ❌ NOT here |
| `684c242` | add Coach X postgame read to session complete screen | ❌ NOT here | ✅ YES | ❌ NOT here |
| `35aa6dc` | add expo-screen-orientation | ✅ HEAD of main | ✅ in history | ❌ NOT here |

**`main` is 3 commits behind `coach-x-postgame`.** The onboarding tab bar fix, all bug fixes, dead file cleanup, CV-PLAN.md, scripts/, and WORK-LOG.md are ONLY on `coach-x-postgame`.

**`fix-session-orientation`** branch exists (local and inferred from CLAUDE.md). It contains `app.json orientation: portrait → default` fix, which is required before CV work (otherwise iOS system-level portrait lock prevents session.tsx from going landscape). This branch is NOT merged to main OR coach-x-postgame.

---

### ⚠️ NEEDS DECISION: deployment branch split

Two decisions required before any EAS build can run correctly:

**Decision A — Merge coach-x-postgame → main**
All the recent work (bug fixes, onboarding fix, image update) is stranded on coach-x-postgame. Main is the production branch. These should be merged before an EAS build so the build includes the fixed code.

**Decision B — Merge fix-session-orientation before CV Step 1**
`app.json` currently says `"orientation": "portrait"` on both main and coach-x-postgame. This is a system-level lock — iOS will not allow the screen to rotate to landscape regardless of what expo-screen-orientation tries to do inside the app. Session.tsx (the CV screen) requires landscape. The fix-session-orientation branch changes this to `"default"` and adds a root-layout API lock. This MUST be merged before running the CV EAS build, or the landscape session will silently fail to rotate on device.

**Recommended merge order:**
1. Merge `coach-x-postgame` → `main` (gets all fixes onto main)
2. Merge (or cherry-pick) the `fix-session-orientation` app.json change onto main
3. Then run the CV Step 1 EAS build from main

**PHASE 1a STATUS: BLOCKED — NEEDS DECISION. Not proceeding past this note until you confirm the merge plan.**

---

### PHASE 1b — Docs loaded

Both key documents fully re-read:

- **CLAUDE.md** (`c:\Users\arize\ATHLT\CLAUDE.md`) — read in full. Confirmed: EAS project ID `soq1hf2k3yx1ie9heuqn3`, EAS owner `1westari4`, CV blocked on Apple Dev, known bugs list current (note: bugs 2/3/4 are already fixed on coach-x-postgame but CLAUDE.md still lists them — minor drift).
- **CV-PLAN.md** (`c:\Users\arize\ATHLT\CV-PLAN.md`) — read in full including MANDATORY SELF-CHECK, all 9 step prompts, and STEP-BY-STEP PASS/FAIL + PHONE TEST MAP. Calibration setup and regression checks are in Steps 5, 6, 7, 9 as updated.

---

### PHASE 2 — CV Step 1 readiness check (no build run)

Step 1 prompt says: "Do not modify any app code or config files. Just confirm and build."
No code changes are needed for Step 1. It is purely a verify-and-build step.

#### Verification results

| Check | File | Expected | Found | Status |
|-------|------|----------|-------|--------|
| expo-dev-client in dependencies | `package.json` line 25 | `"expo-dev-client": "~6.0.x"` | `"expo-dev-client": "~6.0.21"` | ✅ PASS |
| expo-dev-client in plugins | `app.json` line 38 | `"expo-dev-client"` in plugins array | Present as 3rd plugin entry | ✅ PASS |
| EAS projectId in app.json | `app.json` line 48 | `0eaeb587-8e3a-4b29-a454-a26eb329a971` | Exact match | ✅ PASS |
| development profile in eas.json | `eas.json` | `developmentClient: true`, `distribution: internal` | Both present | ✅ PASS |
| EAS CLI version constraint | `eas.json` | `>= 18.8.1` | Declared | ✅ PASS (user must confirm CLI is installed) |

**No file changes needed for Step 1.** All prerequisites are already in place.

#### Exact command that will run Step 1 (DO NOT RUN YET)

```
cd C:\Users\arize\ATHLT\expo
eas build --profile development --platform ios
```

That's it. One command. No code edits.

#### What will happen when you run it

1. EAS CLI reads `eas.json` development profile: `developmentClient: true`, `distribution: internal`
2. EAS reads `app.json` EAS projectId and uploads the current local code to EAS build servers
3. Build queues — typically takes 5–20 minutes on EAS free tier
4. EAS dashboard at `https://expo.dev/accounts/1westari4/projects/soq1hf2k3yx1ie9heuqn3/builds` will show the build
5. When complete: EAS sends an email with a QR code / download link for the `.ipa`
6. You download and install the `.ipa` on your iPhone (via QR or direct link)
7. You open the installed app → it shows the Expo Dev Client shell (not Expo Go)
8. You run `npx expo start` on your PC, scan the QR in Dev Client → ATHLT Today screen loads

**PHASE 2 STATUS: READY TO RUN STEP 1 — awaiting your go-ahead after branch decisions are resolved.**

---

### PHASE 3 — Summary: what needs YOU

#### (1) Deployment branch status

| Item | Status |
|------|--------|
| `coach-x-postgame` commits on `main` | ❌ NOT MERGED — 3 commits behind |
| `fix-session-orientation` on `main` or `coach-x-postgame` | ❌ NOT MERGED anywhere |
| All recent work (bug fixes, onboarding, image) on GitHub | ✅ On `coach-x-postgame` remote |
| Recommendation | Merge coach-x-postgame → main, then merge fix-session-orientation, then build |

#### (2) CV Step 1 staged and ready

| Item | Status |
|------|--------|
| expo-dev-client in package.json | ✅ Present |
| expo-dev-client in app.json plugins | ✅ Present |
| EAS development profile configured | ✅ Present |
| Code changes needed for Step 1 | ✅ None — verify-and-build only |
| EAS build command identified | ✅ `eas build --profile development --platform ios` |

#### (3) Things that need YOU (cannot proceed without)

**Your decisions first:**
- [ ] **Confirm merge plan**: Should coach-x-postgame → main before the EAS build? (recommended: yes)
- [ ] **Confirm fix-session-orientation merge**: The portrait lock in app.json must be removed before CV work. Merge that branch too? (recommended: yes, or cherry-pick the app.json change)

**Apple account (hard blocker):**
- [ ] **Confirm Apple Developer account is active** — Eric needs to have paid and the account confirmed. Without this, `eas build --profile development --platform ios` with `distribution: internal` will fail when EAS tries to create provisioning profiles.

**At build time (you must be present):**
- [ ] **eas-cli installed**: Run `eas --version` in PowerShell to confirm. Required version `>= 18.8.1`. Install with `npm install -g eas-cli` if missing.
- [ ] **EAS logged in**: Run `eas whoami` — should return `1westari4`. If not, run `eas login`.

**After build completes (phone required):**
- [ ] **Install the `.ipa`** from the EAS email/dashboard link onto your iPhone
- [ ] **Register your device UDID** in Apple Developer portal if not already done (internal distribution requires it)
- [ ] **Run phone test** (exact steps in CV-PLAN.md Step 1 PASS/FAIL section):
  - Open installed Dev Client app on iPhone
  - Run `npx expo start` on PC
  - Scan QR or enter URL in Dev Client
  - Confirm ATHLT Today screen loads, all 4 tabs work, no red error overlays

**Nothing in Phase 2 or beyond runs until you confirm: (a) merge plan, (b) Apple Dev is active, (c) eas-cli is installed and logged in.**

---

*Log written by Claude Code autonomous session. All grep results are exact — no assumptions.*
