import { supabase } from '@/constants/supabase';

/**
 * Memory system sync helpers.
 * These talk to the skill_state, drill_results, and sessions tables
 * created in Slice 1 of the memory system.
 */

// Freshness recovery rates (days to full 100% from 0%)
// Physical skills recover faster; mental/tactical recover slower.
const FRESHNESS_RECOVERY_DAYS: Record<string, number> = {
  ballHandling: 4,
  shooting: 4,
  shotForm: 4,
  finishing: 4,
  weakHand: 4,
  athleticism: 3,
  defense: 6,
  touch: 6,
  iq: 9,
  decisionMaking: 9,
  courtVision: 9,
  creativity: 9,
};

// How much freshness drops per session (based on user feedback intensity)
function freshnessDropFromFeedback(feedback: string | null): number {
  if (feedback === 'too_hard') return 70;   // intense drill, big drop
  if (feedback === 'right') return 50;       // moderate drop
  if (feedback === 'too_easy') return 30;    // light drop
  return 50; // default moderate
}

// How much a session's feedback nudges current_level
// (Option C safeguards from our design: max +/- 1.0 per session)
function levelDeltaFromFeedback(feedback: string | null): number {
  if (feedback === 'too_easy') return 0.3;   // bump up (drill was easy)
  if (feedback === 'right') return 0.1;      // small positive (handled it)
  if (feedback === 'too_hard') return -0.2;  // small negative (struggled)
  return 0;
}

/**
 * Save a drill_result row and update the relevant skill_state row.
 * Called every time a user completes a drill in the session screen.
 */
export async function logDrillResult(params: {
  drillId: string;
  primarySkill: string;
  sessionId?: string | null;
  outcomeType?: string | null;
  outcomeValue?: number | null;
  outcomeTarget?: number | null;
  userFeedback?: 'too_easy' | 'right' | 'too_hard' | null;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Guest users don't sync — that's fine, they're not logged in
    return { success: false, reason: 'no_user' };
  }

  const today = new Date().toISOString().split('T')[0];

  // 1. Insert the raw drill_result row
  const { error: drillErr } = await supabase.from('drill_results').insert({
    user_id: user.id,
    session_id: params.sessionId || null,
    drill_id: params.drillId,
    primary_skill: params.primarySkill,
    date: today,
    outcome_type: params.outcomeType || 'subjective_rating',
    outcome_value: params.outcomeValue || null,
    outcome_target: params.outcomeTarget || null,
    user_feedback: params.userFeedback || null,
  });

  if (drillErr) {
    console.error('logDrillResult: insert failed:', drillErr);
    return { success: false, reason: 'insert_failed', error: drillErr };
  }

  // 2. Update the skill_state row for this skill
  const { data: existing, error: readErr } = await supabase
    .from('skill_state')
    .select('*')
    .eq('user_id', user.id)
    .eq('skill_category', params.primarySkill)
    .maybeSingle();

  if (readErr) {
    console.error('logDrillResult: read skill_state failed:', readErr);
    return { success: true, reason: 'drill_saved_but_state_read_failed' };
  }

  // If no skill_state row exists for this skill yet, create it
  if (!existing) {
    const initialLevel = 5.0 + levelDeltaFromFeedback(params.userFeedback || null);
    const initialFreshness = Math.max(0, 100 - freshnessDropFromFeedback(params.userFeedback || null));
    const { error: insertErr } = await supabase.from('skill_state').insert({
      user_id: user.id,
      skill_category: params.primarySkill,
      current_level: Math.max(1, Math.min(10, initialLevel)),
      freshness_pct: initialFreshness,
      last_trained_date: today,
      recent_trend: 'flat',
      confidence: 'low',
      total_sessions_worked: 1,
    });
    if (insertErr) {
      console.error('logDrillResult: insert skill_state failed:', insertErr);
    }
    return { success: true, reason: 'created_new_skill_state' };
  }

  // Otherwise, update the existing row with weighted average and drops
  const currentLevel = Number(existing.current_level);
  const delta = levelDeltaFromFeedback(params.userFeedback || null);
  // Cap change per session to +/- 1.0 (Option C safeguard)
  const newLevel = Math.max(1, Math.min(10, currentLevel + delta));

  const drop = freshnessDropFromFeedback(params.userFeedback || null);
  const newFreshness = Math.max(0, (existing.freshness_pct ?? 100) - drop);

  const newTotal = (existing.total_sessions_worked ?? 0) + 1;
  // Confidence increases with more data points
  let newConfidence = existing.confidence || 'low';
  if (newTotal >= 10) newConfidence = 'high';
  else if (newTotal >= 4) newConfidence = 'medium';

  const { error: updateErr } = await supabase
    .from('skill_state')
    .update({
      current_level: newLevel,
      freshness_pct: newFreshness,
      last_trained_date: today,
      total_sessions_worked: newTotal,
      confidence: newConfidence,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('skill_category', params.primarySkill);

  if (updateErr) {
    console.error('logDrillResult: update skill_state failed:', updateErr);
    return { success: true, reason: 'drill_saved_but_state_update_failed' };
  }

  return { success: true, reason: 'updated' };
}

/**
 * Called when a user finishes a whole session (ends or quits).
 * Creates a sessions row summarizing the whole workout.
 */
export async function logSession(params: {
  dayIndex: number;
  completedDrillsCount: number;
  durationMinutes?: number;
  overallFeedback?: 'too_easy' | 'right' | 'too_hard' | null;
  skillsWorked: string[];
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, reason: 'no_user' };

  const today = new Date().toISOString().split('T')[0];

  const { error } = await supabase.from('sessions').insert({
    user_id: user.id,
    date: today,
    day_index: params.dayIndex,
    completed_drills_count: params.completedDrillsCount,
    duration_minutes: params.durationMinutes || null,
    overall_feedback: params.overallFeedback || null,
    skills_worked: params.skillsWorked,
  });

  if (error) {
    console.error('logSession failed:', error);
    return { success: false, error };
  }

  return { success: true };
}
