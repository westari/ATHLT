# planStore.ts — Audit Notes

Audited: 2026-05-30. No breaking changes made. All findings are flagged for review.

---

## Issues Found

### 1. `toggleDrillComplete` is referenced in other files but doesn't exist

**Severity: HIGH — silent bug**

`session.tsx` and `drill/[id].tsx` call `toggleDrillComplete()` which is not in the store.
The actual function is `toggleDrill(dayIndex: number, drillIndex: number)`.

Additionally, `session.tsx` passes a string key `(currentDayIndex + '-' + drillIdx)` as the first argument
instead of two separate numbers — the wrong signature.

**Fix required:**
- In `session.tsx`: replace `toggleDrillComplete(...)` with `markDrillComplete(dayIndex, drillIndex)` (two numbers)
- In `drill/[id].tsx`: same replacement

---

### 2. `totalSessions` vs `completedSessions.length` drift

**Severity: MEDIUM — cosmetic**

`totalSessions` is incremented in `completeSession()` but is also loaded from AsyncStorage independently.
If a session is added to `completedSessions` but `totalSessions` is not incremented (e.g., if `completeSession`
is called twice), they can drift.

**Fix:** Derive `totalSessions` from `completedSessions.length` instead of storing it separately.
Or add a guard in `completeSession` to prevent double-counting.

---

### 3. `profile.name` is optional and rarely set

**Severity: LOW — UX**

`PlayerProfile.name` is typed as optional and the onboarding flow never explicitly collects a player name.
The Profile tab and Home screen greeting fall back to email prefix or 'Athlete'.

**Fix:** Add a name-collection step to onboarding, or derive it from email on first login.

---

### 4. `description` field stored at top-level, not inside `profile`

**Severity: LOW — architecture**

`description` (player's physical appearance for Coach X) is stored as a top-level store field
instead of inside `PlayerProfile`. This causes it to be saved/loaded separately and can get
out of sync with the profile object.

**Fix:** Move `description` into `PlayerProfile` shape and update all usages.

---

### 5. `currentDayIndex` not validated against plan length on load

**Severity: MEDIUM — potential crash**

If the user had `currentDayIndex = 5` in storage but a new 3-day plan is loaded,
accessing `plan.days[5]` returns `undefined`, which causes downstream crashes.

**Fix:** In `loadFromStorage`, clamp `currentDayIndex` to `Math.min(stored, plan.days.length - 1)`.

---

### 6. `completedDrills` keys are never cleaned up across plan changes

**Severity: LOW — stale data**

When `setPlan()` is called with a new plan, `completedDrills` is not reset.
Old `"3-2"` keys from the previous plan are still present, and new calculations
include them in drill counts.

**Fix:** Clear `completedDrills` in `setPlan()`. Currently `setPlan` only resets `currentDayIndex`.

---

### 7. No `onboardingComplete` persistence

**Severity: LOW — cosmetic**

`onboardingComplete` is not persisted to AsyncStorage. On fresh launch, it defaults to `false`
even if the user has a plan. The `isReady` → `appState` logic in `today.tsx` re-derives this from
`profile && plan`, so there's no actual bug, but it's inconsistent.

**Fix:** Include `onboardingComplete` in the persisted data object in `saveToStorage`.

---

## Fields Added Since Initial Build

- `skillLevels: Record<string, number>` — CV/plan quality signal. Written by onboarding. Not yet used in plan display.
- `description: string` — appearance descriptor for Coach X. Written by onboarding question.

---

## No Breaking Changes

None of the above issues were fixed in this audit pass. All are flagged for a dedicated fix sprint.
