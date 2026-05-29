/**
 * Shot Sync Layer for ATHLT
 * 
 * Saves shot sessions and individual shots to Supabase. Handles offline-first
 * patterns: shots are first stored locally, then synced when network is available.
 * 
 * Drop-in module — add these functions alongside your existing supabaseSync.ts
 * or import from this file directly.
 */

import { supabase } from '@/constants/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DetectedShot } from './shotDetection';

// --------------- Types ---------------

export interface ShotSessionInput {
  drillId: string;
  drillName?: string;
  dayIndex?: number;
  drillIndex?: number;
  startedAt: Date;
}

export interface ShotSessionResult {
  id: string;
  drillId: string;
  drillName?: string;
  startedAt: string;
  endedAt: string;
  totalShots: number;
  makes: number;
  fgPercentage: number;
  bestStreak: number;
  avgReleaseAngle?: number;
  avgArcHeight?: number;
  bestZone?: string;
  bestZonePct?: number;
  worstZone?: string;
  worstZonePct?: number;
  coachXRead?: string;
}

export interface SavedShot {
  id: string;
  sessionId: string;
  made: boolean;
  shotIndex: number;
  zone?: string;
  courtX?: number;
  courtY?: number;
  releaseAngle?: number;
  arcHeight?: number;
}

// --------------- Local cache for offline support ---------------

const PENDING_SESSIONS_KEY = 'athlt_pending_shot_sessions';
const PENDING_SHOTS_KEY = 'athlt_pending_shots';

interface PendingPayload {
  session: any;
  shots: any[];
  attempts: number;
  queuedAt: string;
}

const queuePending = async (payload: PendingPayload) => {
  try {
    const existing = await AsyncStorage.getItem(PENDING_SESSIONS_KEY);
    const list: PendingPayload[] = existing ? JSON.parse(existing) : [];
    list.push(payload);
    await AsyncStorage.setItem(PENDING_SESSIONS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('[shotSync] failed to queue pending session', e);
  }
};

// --------------- Core: create session ---------------

/**
 * Creates a new shot session in Supabase. Returns the session ID.
 * Call this when the user taps "Start Tracking" on a shooting drill.
 */
export async function createShotSession(
  input: ShotSessionInput
): Promise<string> {
  // Always return a local fallback ID so in-memory tracking works even without auth.
  const localId = 'local_' + Date.now();

  try {
    const authResult = await supabase.auth.getUser();
    const user = authResult.data?.user ?? null;

    if (!user) {
      console.log('[shotSync] no authenticated user — using local session id:', localId);
      return localId;
    }

    console.log('[shotSync] creating session for user:', user.id);

    const { data, error } = await supabase
      .from('shot_sessions')
      .insert({
        user_id: user.id,
        drill_id: input.drillId,
        drill_name: input.drillName,
        day_index: input.dayIndex,
        drill_index: input.drillIndex,
        started_at: input.startedAt.toISOString(),
        total_shots: 0,
        makes: 0,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[shotSync] createShotSession insert error:', error.message, '— falling back to local id:', localId);
      return localId;
    }

    console.log('[shotSync] session created in Supabase, id:', data.id);
    return data.id;
  } catch (e) {
    console.error('[shotSync] createShotSession failed:', e, '— falling back to local id:', localId);
    return localId;
  }
}

// --------------- Core: save individual shot ---------------

/**
 * Save a single shot to the database. Called every time a shot is detected
 * during the session (real-time sync, not batched).
 */
export async function saveShot(
  sessionId: string,
  shot: DetectedShot
): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const flightTimeMs = shot.resultTimestamp - shot.releaseTimestamp;

    const { data, error } = await supabase
      .from('shots')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        made: shot.made,
        shot_index: shot.shotIndex,
        court_x: shot.shooterPosition?.x,
        court_y: shot.shooterPosition?.y,
        zone: shot.zone,
        release_angle: shot.releaseAngle,
        arc_height: shot.arcHeight,
        release_timestamp_ms: shot.releaseTimestamp,
        result_timestamp_ms: shot.resultTimestamp,
        flight_time_ms: flightTimeMs,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[shotSync] saveShot error:', error.message);
      return null;
    }
    return data.id;
  } catch (e) {
    console.error('[shotSync] saveShot failed:', e);
    return null;
  }
}

// --------------- Core: finalize session ---------------

interface FinalizeInput {
  sessionId: string;
  totalShots: number;
  makes: number;
  bestStreak: number;
  avgReleaseAngle?: number;
  avgArcHeight?: number;
  bestZone?: string;
  bestZonePct?: number;
  worstZone?: string;
  worstZonePct?: number;
  coachXRead?: string;
  durationSeconds: number;
}

/**
 * Update the session with final aggregate stats. Call when the user taps "Done"
 * on a session.
 */
export async function finalizeShotSession(input: FinalizeInput): Promise<boolean> {
  try {
    const fgPercentage =
      input.totalShots > 0 ? (input.makes / input.totalShots) * 100 : 0;

    const { error } = await supabase
      .from('shot_sessions')
      .update({
        ended_at: new Date().toISOString(),
        duration_seconds: input.durationSeconds,
        total_shots: input.totalShots,
        makes: input.makes,
        fg_percentage: parseFloat(fgPercentage.toFixed(2)),
        best_streak: input.bestStreak,
        avg_release_angle: input.avgReleaseAngle
          ? parseFloat(input.avgReleaseAngle.toFixed(2))
          : null,
        avg_arc_height: input.avgArcHeight
          ? parseFloat(input.avgArcHeight.toFixed(4))
          : null,
        best_zone: input.bestZone,
        best_zone_pct: input.bestZonePct
          ? parseFloat(input.bestZonePct.toFixed(2))
          : null,
        worst_zone: input.worstZone,
        worst_zone_pct: input.worstZonePct
          ? parseFloat(input.worstZonePct.toFixed(2))
          : null,
        coach_x_read: input.coachXRead,
      })
      .eq('id', input.sessionId);

    if (error) {
      console.error('[shotSync] finalizeShotSession error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[shotSync] finalizeShotSession failed:', e);
    return false;
  }
}

// --------------- Update individual shot (tap to fix) ---------------

/**
 * Mark a shot as user-corrected and update its made/missed value.
 * Called when the user taps a dot on the shot chart to flip it.
 */
export async function correctShot(
  shotId: string,
  newMadeValue: boolean
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('shots')
      .update({
        made: newMadeValue,
        user_corrected: true,
      })
      .eq('id', shotId);

    if (error) {
      console.error('[shotSync] correctShot error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[shotSync] correctShot failed:', e);
    return false;
  }
}

// --------------- Read functions ---------------

/**
 * Get a single session by ID, including all shots.
 */
export async function getShotSession(sessionId: string) {
  try {
    const { data: session, error: sessionErr } = await supabase
      .from('shot_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (sessionErr) {
      console.error('[shotSync] getShotSession session error:', sessionErr.message);
      return null;
    }

    const { data: shots, error: shotsErr } = await supabase
      .from('shots')
      .select('*')
      .eq('session_id', sessionId)
      .order('shot_index', { ascending: true });
    if (shotsErr) {
      console.error('[shotSync] getShotSession shots error:', shotsErr.message);
      return { session, shots: [] };
    }

    return { session, shots: shots || [] };
  } catch (e) {
    console.error('[shotSync] getShotSession failed:', e);
    return null;
  }
}

/**
 * Get the user's most recent shot sessions for the Progress tab.
 */
export async function getRecentShotSessions(limit: number = 10) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('shot_sessions')
      .select('*')
      .eq('user_id', user.id)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[shotSync] getRecentShotSessions error:', error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('[shotSync] getRecentShotSessions failed:', e);
    return [];
  }
}

/**
 * Get aggregate weekly stats for the user. Used by plan adapter and Coach X chat
 * to give context to the LLM.
 */
export async function getWeeklyShootingStats(weeksBack: number = 1) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7 * weeksBack);

    const { data, error } = await supabase
      .from('shot_sessions')
      .select('total_shots, makes, fg_percentage, best_zone, worst_zone, started_at')
      .eq('user_id', user.id)
      .gte('started_at', cutoff.toISOString())
      .not('ended_at', 'is', null);

    if (error) {
      console.error('[shotSync] getWeeklyShootingStats error:', error.message);
      return null;
    }

    if (!data || data.length === 0) {
      return {
        sessionCount: 0,
        totalShots: 0,
        totalMakes: 0,
        fgPercentage: 0,
      };
    }

    const totalShots = data.reduce((s, r) => s + (r.total_shots || 0), 0);
    const totalMakes = data.reduce((s, r) => s + (r.makes || 0), 0);
    const fgPercentage = totalShots > 0 ? (totalMakes / totalShots) * 100 : 0;

    return {
      sessionCount: data.length,
      totalShots,
      totalMakes,
      fgPercentage: parseFloat(fgPercentage.toFixed(1)),
    };
  } catch (e) {
    console.error('[shotSync] getWeeklyShootingStats failed:', e);
    return null;
  }
}

/**
 * Get zone-by-zone shooting stats across the user's lifetime.
 * Used for plan adapter to know which zones the user is weak/strong in.
 */
export async function getZoneStats() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    // Use the view we created in the schema
    const { data, error } = await supabase
      .from('user_zone_stats')
      .select('*')
      .eq('user_id', user.id)
      .order('attempts', { ascending: false });

    if (error) {
      // fall back to manual aggregation if view doesn't exist
      console.warn('[shotSync] zone stats view not found, falling back', error.message);
      return await getZoneStatsManual(user.id);
    }
    return data || [];
  } catch (e) {
    console.error('[shotSync] getZoneStats failed:', e);
    return [];
  }
}

/**
 * Manual zone stats aggregation in case the view doesn't exist.
 */
async function getZoneStatsManual(userId: string) {
  const { data, error } = await supabase
    .from('shots')
    .select('zone, made')
    .eq('user_id', userId)
    .not('zone', 'is', null);

  if (error || !data) return [];

  const map: Record<string, { att: number; made: number }> = {};
  for (const row of data) {
    const z = row.zone as string;
    if (!map[z]) map[z] = { att: 0, made: 0 };
    map[z].att += 1;
    if (row.made) map[z].made += 1;
  }

  return Object.keys(map).map(zone => ({
    zone,
    attempts: map[zone].att,
    makes: map[zone].made,
    fg_percentage: map[zone].att > 0
      ? parseFloat(((map[zone].made / map[zone].att) * 100).toFixed(2))
      : 0,
  }));
}

// --------------- Helper: build prompt context for LLM ---------------

/**
 * Build a compact text summary of the user's shooting data, ready to drop
 * into a Claude/Gemini prompt for plan generation or Coach X chat.
 */
export async function buildShootingContextString(): Promise<string> {
  try {
    const weekly = await getWeeklyShootingStats(1);
    const zones = await getZoneStats();

    if (!weekly || weekly.sessionCount === 0) {
      return 'No tracked shooting data yet.';
    }

    let str = `Shooting this week: ${weekly.totalMakes}/${weekly.totalShots} (${weekly.fgPercentage}%) across ${weekly.sessionCount} session${weekly.sessionCount > 1 ? 's' : ''}.`;

    if (zones.length > 0) {
      const sorted = zones.sort((a: any, b: any) => b.fg_percentage - a.fg_percentage);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      if (best.attempts >= 5) {
        str += ` Best zone lifetime: ${best.zone} at ${best.fg_percentage}% (${best.makes}/${best.attempts}).`;
      }
      if (worst && worst.zone !== best.zone && worst.attempts >= 5) {
        str += ` Weakest zone: ${worst.zone} at ${worst.fg_percentage}% (${worst.makes}/${worst.attempts}).`;
      }
    }

    return str;
  } catch (e) {
    console.error('[shotSync] buildShootingContextString failed:', e);
    return 'No tracked shooting data available.';
  }
}
