/**
 * CV Session Sync — high-level orchestrator for saving CV sessions.
 *
 * Thin wrapper over lib/shotSync.ts that:
 *  1. Creates the session record when tracking starts
 *  2. Saves each shot in real time as it's detected
 *  3. Finalizes and sends to Coach X when session ends
 *  4. Fetches Coach X analysis and stores it back on the session
 *
 * Usage:
 *   const sync = new CVSessionSync();
 *   await sync.start({ drillId: 'sh-7', drillName: 'Spot Shooting', ... });
 *   sync.recordShot(shotEvent);          // call for each detected shot
 *   const recap = await sync.finish();   // call when session ends
 */

import {
  createShotSession,
  saveShot,
  finalizeShotSession,
  type ShotSessionInput,
} from '../shotSync';
import type { DetectedShot } from '../shotDetection';
import type { ShotEvent } from './ShotTracker';
import type { TrackerSummary } from './ShotTracker';

const BACKEND_URL = 'https://www.tryparlai.com';

export interface CVSessionConfig {
  drillId?: string;
  drillName?: string;
  dayIndex?: number;
  drillIndex?: number;
  sessionType: 'guided' | 'open_run';
}

export interface CoachAnalysis {
  message: string;
  planAdjustment: {
    shouldAdjust: boolean;
    reason: string;
    suggestedFocus: string;
  };
}

export interface SessionRecap {
  sessionId: string | null;
  makes: number;
  misses: number;
  totalShots: number;
  fgPct: number;
  bestStreak: number;
  durationSeconds: number;
  coachAnalysis: CoachAnalysis | null;
}

export class CVSessionSync {
  private sessionId: string | null = null;
  private shotIndex = 0;
  private startTime = Date.now();
  private config: CVSessionConfig | null = null;

  /** Start a new tracking session. Returns a session ID (Supabase or local fallback). */
  async start(config: CVSessionConfig): Promise<string> {
    this.config    = config;
    this.shotIndex = 0;
    this.startTime = Date.now();

    const input: ShotSessionInput = {
      drillId:    config.drillId    ?? 'open_run',
      drillName:  config.drillName  ?? 'Open Run',
      dayIndex:   config.dayIndex,
      drillIndex: config.drillIndex,
      startedAt:  new Date(),
    };

    try {
      this.sessionId = await createShotSession(input);
    } catch (e) {
      this.sessionId = 'local_' + Date.now();
      console.error('[CVSessionSync] start failed, using local id:', this.sessionId, e);
    }
    return this.sessionId;
  }

  /**
   * Record a detected shot. Fire-and-forget — we don't await each save
   * to avoid blocking the UI during live tracking.
   */
  recordShot(event: ShotEvent): void {
    if (!this.sessionId) return;

    const shot: DetectedShot = {
      made:              event.type === 'make',
      shotIndex:         this.shotIndex++,
      releaseTimestamp:  event.timestamp - 500,  // rough estimate
      resultTimestamp:   event.timestamp,
      trajectoryPoints:  event.ballPositions,
      releaseAngle:      event.releaseAngle,
      arcHeight:         event.arcHeight,
      shooterPosition:   event.ballPositions.length > 0
        ? { x: event.ballPositions[0].x, y: event.ballPositions[0].y }
        : undefined,
      zone: event.zone ?? undefined,
    };

    saveShot(this.sessionId, shot).catch(e =>
      console.warn('[CVSessionSync] saveShot failed:', e)
    );
  }

  /**
   * Finalize the session: persist aggregate stats, fetch Coach X analysis,
   * store it back on the session record.
   */
  async finish(summary: TrackerSummary, userId?: string): Promise<SessionRecap> {
    const durationSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    // Zone data is only populated when ShotTracker (JS) runs inference.
    // ATHLTCamera native module doesn't surface zone data yet — guard with ?. ?? [].
    const sortedZones = [...(summary.sessionStats?.byZone ?? [])].sort((a, b) => b.pct - a.pct);
    const bestZone    = sortedZones[0];
    const worstZone   = sortedZones[sortedZones.length - 1];

    if (this.sessionId) {
      await finalizeShotSession({
        sessionId:         this.sessionId,
        totalShots:        summary.totalShots,
        makes:             summary.makes,
        bestStreak:        summary.bestStreak,
        avgReleaseAngle:   summary.sessionStats.averageReleaseAngle,
        avgArcHeight:      summary.sessionStats.averageArcHeight,
        bestZone:          bestZone?.zone,
        bestZonePct:       bestZone?.pct,
        worstZone:         worstZone?.zone,
        worstZonePct:      worstZone?.pct,
        durationSeconds,
      });
    }

    // Fetch Coach X analysis
    let coachAnalysis: CoachAnalysis | null = null;
    if (summary.totalShots >= 3 && userId) {
      coachAnalysis = await this.fetchCoachAnalysis(summary, userId);
    }

    return {
      sessionId:       this.sessionId,
      makes:           summary.makes,
      misses:          summary.misses,
      totalShots:      summary.totalShots,
      fgPct:           summary.fgPct,
      bestStreak:      summary.bestStreak,
      durationSeconds,
      coachAnalysis,
    };
  }

  private async fetchCoachAnalysis(summary: TrackerSummary, userId: string): Promise<CoachAnalysis | null> {
    try {
      const zoneData = (summary.sessionStats?.byZone ?? []).reduce((acc, z) => {
        acc[z.zone] = { attempts: z.attempts, makes: z.makes, pct: z.pct.toFixed(1) };
        return acc;
      }, {} as Record<string, any>);

      const response = await fetch(`${BACKEND_URL}/api/coach-shot-read`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sessionData: {
            makes:       summary.makes,
            misses:      summary.misses,
            totalShots:  summary.totalShots,
            fgPct:       summary.fgPct.toFixed(1),
            bestStreak:  summary.bestStreak,
            zoneData,
            drillId:     this.config?.drillId,
            drillName:   this.config?.drillName,
            sessionType: this.config?.sessionType,
          },
        }),
      });

      if (!response.ok) return null;
      const json = await response.json();
      return json as CoachAnalysis;
    } catch (e) {
      console.warn('[CVSessionSync] fetchCoachAnalysis failed:', e);
      return null;
    }
  }
}
