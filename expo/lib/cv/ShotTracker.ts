/**
 * ShotTracker — unified interface over the shot detection algorithm.
 *
 * Wraps lib/shotDetection.ts (the core ShotDetector state machine) and
 * adds:
 *   - Detection type mapping (className → ShotDetector inputs)
 *   - Rim position smoothing via EMA
 *   - Frame processing entry point that matches the CameraView contract
 *   - Session stats aggregation
 *
 * Usage:
 *   const tracker = new ShotTracker();
 *   tracker.onShot = (event) => { updateUI(event); saveToDB(event); };
 *
 *   // In frame processor callback (JS thread):
 *   tracker.processFrame(detections, timestampMs);
 *
 *   // On session end:
 *   const summary = tracker.getSummary();
 *   tracker.reset();
 */

import {
  ShotDetector,
  type FrameDetection,
  type BoundingBox,
  type DetectedShot,
  computeSessionStats,
  type SessionStats,
} from '../shotDetection';
import { getCourtZone, type CourtZone, type RimPosition } from './CourtZones';
import type { Detection } from '@/modules/shot-detector/src/ShotDetector.types';

// ---- Public types ----

export interface ShotEvent {
  type: 'make' | 'miss';
  timestamp: number;
  zone: CourtZone | null;
  confidence: number;
  releaseAngle?: number;
  arcHeight?: number;
  ballPositions: Array<{ x: number; y: number; t: number }>;
}

export interface TrackerSummary {
  makes: number;
  misses: number;
  totalShots: number;
  fgPct: number;
  bestStreak: number;
  currentStreak: number;
  shotEvents: ShotEvent[];
  sessionStats: SessionStats;
  durationMs: number;
}

// ---- EMA smoothing for rim position ----

const EMA_ALPHA = 0.15;  // low alpha = very smooth (rim barely moves)

interface SmoothedRim {
  x: number; y: number; width: number; height: number;
  lastSeen: number;
}

// ---- ShotTracker ----

export class ShotTracker {
  private detector = new ShotDetector();
  private smoothedRim: SmoothedRim | null = null;
  private shotEvents: ShotEvent[] = [];
  private sessionStartMs = Date.now();
  private frameCount = 0;

  public onShot: ((event: ShotEvent) => void) | null = null;
  public onPhaseChange: ((phase: string) => void) | null = null;

  constructor() {
    this.detector.onShot = this.handleDetectedShot.bind(this);
    this.detector.onPhaseChange = (p) => this.onPhaseChange?.(p);
  }

  /**
   * Process one frame's detections. Call this from the VisionCamera frame
   * processor callback (runs on JS thread via Worklets.createRunOnJS).
   *
   * @param detections  Array of Detection objects from the native inference module
   * @param timestampMs Frame timestamp in milliseconds
   */
  processFrame(detections: Detection[], timestampMs: number): void {
    this.frameCount++;

    // Find ball, rim, and ball_in_basket from this frame
    let ballBox: BoundingBox | null = null;
    let rimBox:  BoundingBox | null = null;
    let ballInBasket = false;

    for (const det of detections) {
      if (det.confidence < 0.30) continue;

      const bb: BoundingBox = {
        x: det.bbox.x,
        y: det.bbox.y,
        width: det.bbox.width,
        height: det.bbox.height,
        confidence: det.confidence,
      };

      switch (det.className) {
        case 'ball':
          // Keep the highest-confidence ball detection
          if (!ballBox || det.confidence > (ballBox.confidence ?? 0)) {
            ballBox = bb;
          }
          break;
        case 'basket':
          rimBox = bb;
          break;
        case 'ball_in_basket':
          ballInBasket = true;
          // The ball-in-basket detection gives us both ball position + implicit rim
          if (!ballBox) ballBox = bb;
          break;
      }
    }

    // Update smoothed rim position via EMA
    if (rimBox) {
      this.updateRim(rimBox, timestampMs);
    }

    // Feed the ShotDetector state machine
    const rimForDetector = this.smoothedRim
      ? { x: this.smoothedRim.x, y: this.smoothedRim.y, width: this.smoothedRim.width, height: this.smoothedRim.height }
      : null;

    const frame: FrameDetection = {
      ballBox,
      rimBox: rimForDetector,
      ballInBasket,
      timestamp: timestampMs,
    };

    this.detector.feedFrame(frame);
  }

  /**
   * Get a summary of the current session (makes, misses, stats, events).
   */
  getSummary(): TrackerSummary {
    const detectedShots = this.detector.getShots();
    const stats = computeSessionStats(detectedShots);
    const durationMs = Date.now() - this.sessionStartMs;

    return {
      makes: stats.makes,
      misses: stats.totalShots - stats.makes,
      totalShots: stats.totalShots,
      fgPct: stats.fgPercentage,
      bestStreak: stats.bestStreak,
      currentStreak: stats.currentStreak,
      shotEvents: this.shotEvents,
      sessionStats: stats,
      durationMs,
    };
  }

  /**
   * Reset for a new session. Call when the user taps "Start Tracking."
   */
  reset(): void {
    this.detector.reset();
    this.shotEvents = [];
    this.smoothedRim = null;
    this.frameCount = 0;
    this.sessionStartMs = Date.now();
  }

  /**
   * Manually correct the last shot result (user taps to fix a misclassification).
   */
  correctLast(made: boolean): void {
    if (this.shotEvents.length === 0) return;
    const last = this.shotEvents[this.shotEvents.length - 1];
    last.type = made ? 'make' : 'miss';
    this.detector.correctLastShot(made);
  }

  /**
   * Current makes count (for live UI updates).
   */
  getMakes(): number {
    return this.detector.getShots().filter(s => s.made).length;
  }

  /**
   * Current total shot count (for live UI updates).
   */
  getTotalShots(): number {
    return this.detector.getShots().length;
  }

  // ---- Internal ----

  private handleDetectedShot(shot: DetectedShot): void {
    // Derive zone from release position and smoothed rim
    let zone: CourtZone | null = null;
    if (shot.shooterPosition) {
      const rimPos: RimPosition | null = this.smoothedRim
        ? { x: this.smoothedRim.x, y: this.smoothedRim.y, width: this.smoothedRim.width, height: this.smoothedRim.height }
        : null;
      const zoneResult = getCourtZone(shot.shooterPosition.x, shot.shooterPosition.y, rimPos);
      zone = zoneResult.zone;
    }

    const event: ShotEvent = {
      type: shot.made ? 'make' : 'miss',
      timestamp: shot.resultTimestamp,
      zone,
      confidence: 0.8,  // heuristic; future: calibrate from detection confidence history
      releaseAngle: shot.releaseAngle,
      arcHeight: shot.arcHeight,
      ballPositions: shot.trajectoryPoints,
    };

    this.shotEvents.push(event);
    this.onShot?.(event);
  }

  private updateRim(detected: BoundingBox, ts: number): void {
    if (!this.smoothedRim) {
      this.smoothedRim = {
        x: detected.x,
        y: detected.y,
        width: detected.width,
        height: detected.height,
        lastSeen: ts,
      };
      return;
    }

    // Exponential moving average — rim barely moves so keep alpha low
    this.smoothedRim.x      = EMA_ALPHA * detected.x + (1 - EMA_ALPHA) * this.smoothedRim.x;
    this.smoothedRim.y      = EMA_ALPHA * detected.y + (1 - EMA_ALPHA) * this.smoothedRim.y;
    this.smoothedRim.width  = EMA_ALPHA * detected.width  + (1 - EMA_ALPHA) * this.smoothedRim.width;
    this.smoothedRim.height = EMA_ALPHA * detected.height + (1 - EMA_ALPHA) * this.smoothedRim.height;
    this.smoothedRim.lastSeen = ts;
  }
}
