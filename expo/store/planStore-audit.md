# planStore.ts — Audit Notes

Audited: 2026-05-30. No breaking changes made. All findings are flagged for review.
**Fixed: 2026-06-01** — bugs #1, #2, #5, #6 resolved (see below).

---

## Issues Found

### 1. `toggleDrillComplete` is referenced in other files but doesn't exist

**Severity: HIGH — silent bug**
**Status: ✅ RESOLVED (2026-06-01)**

`session.tsx` and `drill/[id].tsx` called `toggleDrillComplete()` which was not in the store.
The actual function is `toggleDrill(dayIndex: number, drillIndex: number)`.

Additionally, `session.tsx` was passing a string key as the first argument — wrong signature.

**Fix applied:**
- `session.tsx` now uses `markDrillComplete(dayIndex, drillIndex)` (confirmed in audit)
- `drill/[id].tsx` uses `toggleDrill(currentDayIndex, drillIndex)` (confirmed in audit)

---

### 2. `totalSessions` vs `completedSessions.length` drift

**Severity: MEDIUM — cosmetic**
**Status: ✅ RESOLVED (2026-06-01)**

`totalSessions` was incremented independently in `completeSession()` and could drift from `completedSessions.length`.

**Fix applied:**
- `completeSession` now sets `totalSessions: sessions.length` (derived from array)
- `loadFromStorage` now sets `totalSessions: storedSessions.length` (synced on load)

---

### 3. `profile.name` is optional and rarely set

**Severity: LOW — UX**

`PlayerProfile.name` is typed as optional and the onboarding flow never explicitly collects it.
Profile tab and Home screen greeting fall back to email prefix or 'Athlete'.

**Fix:** Add a name-collection step to onboarding, or derive from email on first login.

---

### 4. `description` field stored at top-level, not inside `profile`

**Severity: LOW — architecture**

`description` is stored as a top-level store field instead of inside `PlayerProfile`.
This causes it to be saved/loaded separately and can get out of sync.

**Fix:** Move `description` into `PlayerProfile` shape and update all usages. (Not yet done — breaking change.)

---

### 5. `currentDayIndex` not validated against plan length on load

**Severity: MEDIUM — potential crash**
**Status: ✅ RESOLVED (2026-06-01)**

Stored `currentDayIndex = 5` with a 3-day plan caused `plan.days[5]` to return `undefined`.

**Fix applied:**
- `setCurrentDayIndex` now clamps its input: `Math.max(0, Math.min(i, planLen - 1))`
- `loadFromStorage` now clamps the stored value against `plan.days.length` before setting state

---

### 6. `completedDrills` keys are never cleaned up across plan changes

**Severity: LOW — stale data**
**Status: ✅ RESOLVED (2026-06-01)**

When `setPlan()` was called with a new plan, `completedDrills` was not reset.
Old `"3-2"` keys from the previous plan polluted drill-completion counts.

**Fix applied:**
- `setPlan` now resets `completedDrills: {}` alongside `currentDayIndex: 0`

---

### 7. No `onboardingComplete` persistence

**Severity: LOW — cosmetic**
**Status: ✅ RESOLVED (2026-06-01)**

`onboardingComplete` was not persisted to AsyncStorage, defaulting to `false` on relaunch.

**Fix applied:**
- `saveToStorage` now includes `onboardingComplete` in the persisted object
- `setOnboardingComplete` now calls `saveToStorage` (previously didn't)

---

## Fields Added Since Initial Build

- `skillLevels: Record<string, number>` — CV/plan quality signal. Written by onboarding.
- `description: string` — appearance descriptor for Coach X. Written by onboarding.
