# ATHLT — Project Context for Claude

> Read this file BEFORE doing anything in this codebase. It saves time and prevents mistakes.

---

## Who's building this

- **Founder:** Ari, 14 years old, solo developer
- **Parent:** Eric (legal owner of any future business entity, Apple Developer account, etc. since Ari is a minor)
- **Location:** California
- **Brand:** ATHLT, under "Scaled Studios"

## What ATHLT is

An AI-powered basketball training app. Core idea: Coach X (an AI character) builds personalized weekly training plans, analyzes film, and chats with the player about their game. Long-term vision is to build the entire app AROUND Coach X as the central character — he's not a feature, he's the product.

Target user: 12–16 year old basketball players, especially AAU/travel ball.

## How Ari works

This is the most important section. Read it twice.

- **GitHub web UI is the only dev environment.** No local IDE, no terminal except occasional Windows Command Prompt for git operations and npm installs.
- **Paste-and-replace is the only acceptable workflow.** Always provide complete file replacements. Never give find-and-replace instructions, line-number patches, or "find this section and modify it" suggestions. They don't work for him.
- **Typo-heavy, abbreviation-heavy messages.** This is normal and intentional. Interpret intent. Never flag, never comment on it, never ask him to clarify spelling.
- **Short, direct answers.** Long explanations frustrate him. Get to the point.
- **Pick one answer, don't offer 5 options.** When asked "what should we do," pick one and recommend it. Don't dump a list of options to choose from unless he explicitly asks.
- **Honest pushback expected.** If an idea is bad, say so. Don't go easy on him. He'll tell you when you're wrong, you tell him when he's wrong. He values honesty over hand-holding.
- **Cost-aware.** Anything that costs API money at scale needs to be flagged upfront before recommending it.

## Hard rules — never do these

- Never suggest hiring on Fiverr or any freelance platform
- Never suggest rebuilding from scratch
- Never suggest he "take a break" or "step away" — he wants to keep building
- Never suggest features he's already explicitly rejected in the same session
- Never use `ask_user_input_v0` button-style multiple choice — write normal questions in prose. The buttons cut off on his screen.
- Never proactively suggest research tasks — just do them when relevant. Don't ask "want me to research?" — research first, then summarize.
- Never use voice notes or `<voice_note>` blocks under any condition.

---

## Tech stack

### App repo: `westari/ATHLT`
- **Framework:** Expo SDK 54, React Native, TypeScript
- **Routing:** Expo Router (file-based, lives in `expo/app/`)
- **State:** Zustand (planStore, etc.)
- **Auth/storage:** Supabase
- **Local persistence:** AsyncStorage + `react-native-url-polyfill`
- **Icons:** lucide-react-native
- **Dev environment:** Rork (web-based simulator, accessed via QR code or browser)
- **Project ID (Rork/EAS):** `soq1hf2k3yx1ie9heuqn3`

### Backend repo: `westari/collectiq`
- **Hosting:** Vercel (Pro tier required for 300s function timeout for film)
- **Endpoints:** `api/generate-plan.js`, `api/coach-chat.js`, `api/analyze-film.js`, `api/_middleware.js`
- **Domain:** `collectiq-xi.vercel.app`

### AI providers
- **Plan generation + Coach X chat:** Claude Haiku (`claude-haiku-4-5-20251001`)
- **Film analysis:** Gemini 2.5 Flash (uses File API, requires polling every 5s up to 120s for ACTIVE state)

### Other services
- **Supabase URL:** `https://tvtojlwdpipntkktguck.supabase.co`
- **Image generation (Coach X portraits):** Dreamina / Seedream 4.5 (NOT Gemini/Nano Banana — character consistency is better)
- **YouTube embeds:** `react-native-youtube-iframe` + `react-native-web-webview` for web compatibility

---

## Critical file locations

### App (`westari/ATHLT`)
```
expo/app/(tabs)/today.tsx          ← Main today/onboarding/climax orchestrator
expo/app/(tabs)/film.tsx           ← Film Room tab
expo/app/(tabs)/coachx.tsx         ← Old Coach X tab (hidden via href: null)
expo/app/(tabs)/_layout.tsx        ← Tab navigation config
expo/app/(tabs)/more.tsx           ← Settings/logout
expo/app/drill/[id].tsx            ← Drill detail screen (uses resolveDrill)
expo/app/session.tsx               ← Active workout session

expo/components/CoachXPill.tsx     ← Persistent "Ask Coach X" pill at top of screens
expo/components/CoachXBottomSheet.tsx ← Chat modal that slides up
expo/components/CoachXClimax.tsx   ← Onboarding climax (4-card swipeable carousel)
expo/components/TodayHome.tsx      ← Plan view layout (Coach X talking + plan + buttons)
expo/components/AuthScreen.tsx     ← Sign up / sign in UI

expo/lib/supabaseSync.ts           ← Cloud sync helpers
expo/lib/memorySync.ts             ← logDrillResult, logSession (skill_state, drill_results, sessions tables)
expo/lib/resolveDrill.ts           ← Maps a plan drill {drillId, time} to full library data

expo/constants/supabase.ts         ← Supabase client config
expo/constants/drillLibrary.ts     ← THE 213-DRILL LIBRARY (see below)
expo/constants/colors.ts           ← Theme colors

expo/store/planStore.ts            ← Zustand store: plan, profile, completedDrills, currentDayIndex
```

### Backend (`westari/collectiq`)
```
api/_middleware.js                 ← CORS, rate limiting, body size limits
api/generate-plan.js               ← Plan generation, picks drills BY drillId from library index
api/coach-chat.js                  ← Coach X chat with memory (JWT auth, pulls last 3 sessions + skill_state + last 10 drill_results)
api/analyze-film.js                ← Gemini film analysis
```

---

## The drill library (CRITICAL — don't miss this)

Located at `expo/constants/drillLibrary.ts`. **213 drills total** across 8 categories:
- Ball Handling (30): `bh-1` through `bh-30`
- Shooting (28): `sh-1` through `sh-28`
- Finishing (27): `fn-1` through `fn-27`
- Defense (25): `df-1` through `df-25`
- Speed & Agility (25): `sa-1` through `sa-25`
- Warmup & Cooldown (25): `wu-1` through `wu-25`
- Conditioning (25): `cd-1` through `cd-25`
- Basketball IQ (28): `iq-1` through `iq-28`

Each drill has: `id`, `name`, `category`, `duration`, `difficulty`, `equipment`, `type`, `summary`, `steps`, `coachingPoints`, `commonMistakes`, optional `variations`, optional `videoUrl`.

### How drills flow through the app (current architecture)

1. **`generate-plan.js`** has the entire drill library as a compact INDEX in its prompt (id|name|type|difficulty|duration|primarySkill). Coach X is FORCED to pick drills by `drillId` from this index. He cannot invent drills.
2. Plan returned to app contains drill objects shaped like: `{ drillId: "sh-7", time: "10 min" }`. Nothing else.
3. App uses `expo/lib/resolveDrill.ts` `resolvePlanDrill()` to look up the full drill data by `drillId` from `expo/constants/drillLibrary.ts`.
4. UI renders the resolved drill — name, summary, steps, coaching points, common mistakes, video.

**If you change drill IDs in `drillLibrary.ts`, you MUST also update the DRILL_INDEX constant in `generate-plan.js` to match.** They're synced manually right now.

### YouTube videos

Drills can have a `youtubeId` field (not yet populated for all 213). The drill detail screen renders the YouTube video inline via `react-native-youtube-iframe`. If a drill has no `youtubeId`, the screen shows "Video coming soon" placeholder.

Plan: gradually fill in YouTube IDs for the most-frequently-assigned drills (probably ~30 drills cover 80% of sessions). No urgency to do all 213.

---

## Supabase schema

```
profiles                — user profile + onboarding answers (RLS on)
plans                   — current weekly plan per user (RLS on)
completed_drills        — which drills the user has marked done (UNIQUE on user_id, day_index, drill_index)
weekly_plans            — older plan storage table (still used by today.tsx in some paths)
user_onboarding         — onboarding answers (still used in some paths)
skill_state             — Coach X memory: per-skill levels over time
drill_results           — per-drill log entries
sessions                — per-session log entries (last 3 are pulled into Coach X chat memory)
film_analyses           — uploaded film analysis history
```

**Important Supabase notes:**
- Free tier hard cap of **2 emails/hour** for auth — affects testing
- `completed_drills` upsert uses `onConflict: 'user_id,day_index,drill_index'` — requires that unique constraint or it errors
- RLS is enabled on all user-data tables
- Email confirmation should be turned OFF in Supabase Auth settings for testing

---

## Vercel environment variables

Currently set in Vercel for `westari/collectiq`:
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `SUPABASE_URL` (the ATHLT one, NOT the old Parlai one)
- `SUPABASE_SERVICE_ROLE_KEY`

Old "needs attention" warnings on `BALLDONTLIE_API_KEY`, `ODDS_API_KEY` etc. are leftovers from a previous business (Parlai) — ignore them.

---

## Key technical learnings (don't repeat these mistakes)

- `fetch(uri).blob()` and `atob()` do NOT work in React Native for local file URIs. Use `FormData` with the file URI directly for Supabase uploads.
- Gemini File API requires polling every 5 seconds up to 120 seconds until state is ACTIVE.
- Gemini frequently wraps JSON responses in markdown backticks — strip before parsing.
- Vercel Pro is required for the 300-second function timeout needed for film analysis (free tier 60s is insufficient for film, fine for plan gen).
- Vercel has a 4.5MB body limit — use FormData instead of base64 for video.
- `react-native-url-polyfill` MUST be imported for Supabase auth to work in React Native.
- `useEffect` dependency arrays must be carefully scoped — including `profile` and `plan` in some places caused the results screen to be skipped.
- `react-native-youtube-iframe` requires `react-native-web-webview` to be in `package.json` for Rork's web build to work.
- When installing npm packages, always use `--legacy-peer-deps --save` flag because of conflicts between `lucide-react-native` and React 19. Without `--save`, the package installs locally but doesn't get added to package.json, so Rork's build fails.

---

## What's currently working

- Onboarding flow with skill scoring (computeSkills function in `today.tsx`)
- Plan generation via `generate-plan.js` — Coach X now picks drills by drillId from the real library
- Drill detail screen — looks up full drill data from library, shows video if available
- Coach X chat with memory (last 3 sessions + skill_state + last 10 drill_results)
- Film analysis via Gemini (4-clip onboarding assessment + ongoing film uploads)
- TodayHome with Coach X portrait LEFT, talking line, day pills, Start session + Edit workout buttons
- Onboarding climax screen (4-card swipeable Coach X summary)
- Coach X persistent pill at top of screens
- Backend security middleware (CORS, rate limit 10 plans/IP/hour, body size limits)
- EAS Build project configured (UUID `0eaeb587-8e3a-4b29-a454-a26eb329a971`)

## What's NOT done yet (in priority order)

1. **Edit Workout screen** — `/edit-workout` route is referenced but the screen doesn't exist yet
2. **YouTube IDs for drills** — most drills don't have videos yet
3. **Coach X memory system** — backend deployed, but film analysis needs to be more specific (Coach X should reference exact moments/clips, not generic feedback)
4. **Apple Developer account** — waiting on Eric (dad) to set this up under his name ($99/year)
5. **Paywall implementation** — likely RevenueCat + hybrid IAP/Stripe approach (US ruling May 2025 allows external Stripe links for digital goods)
6. **Real Coach X portrait** — using placeholder `coach-x-small.png`, need Dreamina-generated final
7. **CV combine onboarding** — researched extensively, deferred until Apple Developer is set up
8. **TestFlight / App Store launch** — blocked on Apple Developer

## Things ruled out — DO NOT re-suggest

- AAU Team Mode (too crowded market, can't sell to AAU coaches as a 14-year-old)
- Daily Hoops Log / journaling features (Ari rejected — "no player wants to do that")
- Real-time CV form analysis during drills (HomeCourt/TruRep/Hoops AI already do this — wouldn't differentiate)
- Drill-level film coaching where every rep gets uploaded (too much friction + cost)
- Decision-making mini-games as the "big feature" (Ari said it's a side feature, not the core)
- Coach X AI voice/video daily messages ("creepy")
- Standalone fitness apps' marketing language ("AI replaces your coach") — research shows only 11% of Gen Z prefers AI over human coaching
- Removing drills from the library (they exist for variety, Coach X picks what's relevant)

## Last big decisions

- **Drill library is real and used.** `generate-plan.js` was updated to force Coach X to pick drills by drillId from the 213-drill library. Drill detail screen looks up full data via `resolveDrill.ts`.
- **TodayHome layout:** Coach X portrait LEFT, message RIGHT, tighter spacing, two buttons stacked (Start session primary, Edit workout secondary).
- **The "big feature" search ended at:** make existing features deeper, not add new ones. Specifically: drill library + YouTube videos + better Coach X film specificity. Build the app AROUND Coach X is the long-term vision.
- **Payment plan:** when paywall comes, use RevenueCat with hybrid Apple IAP + Stripe external link (the May 2025 ruling allows external Stripe for digital goods, ~30% savings vs IAP-only).
- **Business entity:** none yet. Form an LLC only when revenue justifies the $800/year California franchise tax. Until then, Apple Developer + Stripe under Eric's name as sole proprietor.

---

## Naming and tone for Coach X

- Real-coach voice. Not AI-sounding. Not corporate.
- Short and confident. "Shooting day. Let's eat." "Defense day. Sit down and guard."
- Never claims to have watched film unless he actually did.
- Direct, honest, doesn't hedge.
- Reference player's actual weaknesses by name from their data.
- Vibe: a real high school/AAU trainer. Not a personal trainer at a chain gym.
