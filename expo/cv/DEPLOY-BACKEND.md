# Deploy: coach-shot-read.js Backend Endpoint

The endpoint file is at `expo/cv/backend-endpoint/coach-shot-read.js`.
The collectiq repo is not cloned locally — deploy via GitHub web UI.

---

## Steps

1. Go to **github.com/westari/collectiq**

2. Navigate to the **`api/`** folder

3. Click **"Add file"** → **"Create new file"**

4. Name the file exactly: `coach-shot-read.js`

5. Paste the full contents of `expo/cv/backend-endpoint/coach-shot-read.js`

6. Scroll down to **"Commit new file"**, add a commit message like:
   `Add coach-shot-read CV postgame analysis endpoint`

7. Click **"Commit new file"**

8. Vercel auto-deploys on push. Wait ~30 seconds, then test:
   ```
   POST https://www.tryparlai.com/api/coach-shot-read
   ```

---

## What the endpoint does

Accepts a completed CV shooting session's stats and returns a Coach X postgame read (2–4 sentences) plus a plan adjustment signal.

**Request body:**
```json
{
  "userId": "supabase-user-uuid",
  "sessionData": {
    "makes": 14,
    "misses": 8,
    "totalShots": 22,
    "fgPct": "63.6",
    "bestStreak": 5,
    "zoneData": {
      "Top of Key 3": { "attempts": 8, "makes": 4, "pct": "50.0" },
      "Left Wing 3":  { "attempts": 7, "makes": 5, "pct": "71.4" }
    },
    "drillId": "sh-7",
    "drillName": "Spot Shooting",
    "sessionType": "guided"
  }
}
```

**Response:**
```json
{
  "message": "Coach X analysis text (2-4 sentences)",
  "planAdjustment": {
    "shouldAdjust": false,
    "reason": "FG% is above threshold",
    "suggestedFocus": "continue current focus"
  }
}
```

---

## Dependencies

Uses packages already in collectiq:
- `@anthropic-ai/sdk` (Claude Haiku for analysis)
- `@supabase/supabase-js` (reads user profile + recent sessions; writes analysis back)

No new packages required.

---

## Env vars required (already set in Vercel)

- `ANTHROPIC_API_KEY`
- `SUPABASE_URL` (ATHLT Supabase: `https://tvtojlwdpipntkktguck.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Pattern match with other collectiq endpoints

This endpoint follows the same pattern as `coach-chat.js` and `generate-plan-v3.js`:
- `module.exports = async function handler(req, res)` (not ES modules)
- CORS headers via `CORS_HEADERS` object
- OPTIONS preflight handled first
- `createClient` with service role key for Supabase writes
- Claude Haiku (`claude-haiku-4-5-20251001`) for generation
- Strip markdown backticks from JSON responses before `JSON.parse`

The `coach-shot-read.js` file already uses this pattern exactly.
