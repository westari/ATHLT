/**
 * coach-shot-read.js — Coach X postgame analysis for CV shooting sessions.
 *
 * COPY THIS FILE TO: collectiq/api/coach-shot-read.js
 *
 * POST /api/coach-shot-read
 * Body: {
 *   userId: string,
 *   sessionData: {
 *     makes: number,
 *     misses: number,
 *     totalShots: number,
 *     fgPct: string,          // "63.6"
 *     bestStreak: number,
 *     zoneData: Record<string, { attempts, makes, pct }>,
 *     drillId?: string,
 *     drillName?: string,
 *     sessionType: 'guided' | 'open_run',
 *   }
 * }
 *
 * Returns: {
 *   message: string,           // Coach X one-para analysis
 *   planAdjustment: {
 *     shouldAdjust: boolean,
 *     reason: string,
 *     suggestedFocus: string,
 *   }
 * }
 */

const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase  = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

module.exports = async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS_HEADERS).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).set(CORS_HEADERS).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, sessionData } = req.body;
    if (!userId || !sessionData) {
      return res.status(400).set(CORS_HEADERS).json({ error: 'Missing userId or sessionData' });
    }

    // Load user profile + plan context from Supabase
    const [profileRes, planRes, recentSessionsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('plans').select('week_title, ai_insight, days').eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('shot_sessions').select('makes, total_shots, fg_percentage, best_zone, worst_zone, started_at').eq('user_id', userId).not('ended_at', 'is', null).order('started_at', { ascending: false }).limit(5),
    ]);

    const profile        = profileRes.data;
    const plan           = planRes.data;
    const recentSessions = recentSessionsRes.data || [];

    // Build context string
    const playerDesc = profile
      ? `${profile.position || 'Guard'}, ${profile.experience || 'HS player'}, goal: ${profile.goal || 'improve shooting'}`
      : 'Basketball player';

    const planContext = plan
      ? `Current plan: "${plan.week_title}". Plan insight: ${plan.ai_insight}`
      : 'No active plan.';

    // Zone data summary
    const zoneLines = Object.entries(sessionData.zoneData || {})
      .filter(([, v]) => v.attempts >= 2)
      .sort(([, a], [, b]) => b.attempts - a.attempts)
      .slice(0, 5)
      .map(([zone, v]) => `  ${zone}: ${v.makes}/${v.attempts} (${v.pct}%)`)
      .join('\n');

    const sessionContext = sessionData.drillName
      ? `Session type: guided drill "${sessionData.drillName}" (${sessionData.drillId})`
      : 'Session type: open run';

    const recentContext = recentSessions.length > 0
      ? `Recent sessions (last ${recentSessions.length}): ` +
        recentSessions.map(s => `${(s.fg_percentage || 0).toFixed(1)}%`).join(', ')
      : 'No recent sessions on record.';

    const prompt = `You are Coach X — a real basketball trainer. Direct, honest, no fluff. Short sentences.

Player: ${playerDesc}
${planContext}
${recentContext}

THIS SESSION:
${sessionContext}
Makes: ${sessionData.makes}/${sessionData.totalShots} (${sessionData.fgPct}% FG)
Best streak: ${sessionData.bestStreak}
Zone breakdown:
${zoneLines || '  No zone data.'}

Write a short postgame read (2–4 sentences max). Speak to the player directly.
Rules:
- Lead with what the numbers actually show. No spin.
- If the shooting was bad, say it straight — don't soften.
- If it was good, acknowledge it briefly then point to what to fix next.
- Mention 1 specific zone or pattern from the data if any zone has >= 5 attempts.
- End with ONE thing to work on next session based on the weak zone or overall FG%.
- DO NOT use words: "champion", "warrior", "grind", "mindset", "journey", "level up".
- Coach voice. Real. No corporate language.

Then return a JSON object in this format after the message (separated by ---JSON---):
{
  "shouldAdjust": boolean,
  "reason": "one sentence",
  "suggestedFocus": "specific drill focus or area"
}
shouldAdjust should be true if FG% < 40% or if there's a clear weak zone with >= 5 attempts.`;

    const completion = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages:   [{ role: 'user', content: prompt }],
    });

    const rawText = completion.content[0]?.text ?? '';

    // Split message from JSON adjustment data
    let message = rawText.trim();
    let planAdjustment = { shouldAdjust: false, reason: '', suggestedFocus: '' };

    if (rawText.includes('---JSON---')) {
      const parts = rawText.split('---JSON---');
      message = parts[0].trim();
      try {
        const jsonStr = parts[1]
          .trim()
          .replace(/^```json\s*/i, '')
          .replace(/```\s*$/,     '');
        planAdjustment = JSON.parse(jsonStr);
      } catch {
        // JSON parse failed — use defaults, keep message
      }
    }

    // Store analysis back on the most recent session for this user
    await supabase
      .from('shot_sessions')
      .update({ coach_x_read: message, coach_analysis: { message, planAdjustment } })
      .eq('user_id', userId)
      .is('coach_x_read', null)
      .order('created_at', { ascending: false })
      .limit(1);

    return res.status(200).set(CORS_HEADERS).json({ message, planAdjustment });
  } catch (err) {
    console.error('[coach-shot-read] error:', err);
    return res.status(500).set(CORS_HEADERS).json({
      error: 'Internal server error',
      message: 'Coach X is offline. Check your connection.',
      planAdjustment: { shouldAdjust: false, reason: '', suggestedFocus: '' },
    });
  }
};
