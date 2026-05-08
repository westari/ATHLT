/**
 * Shot Detection Logic for ATHLT
 * 
 * Takes a stream of ball + rim detections from the camera/ML model
 * and determines: makes, misses, shot positions, and basic form metrics.
 * 
 * No native code, no API calls. Pure logic that runs on the phone alongside
 * the camera frame processor.
 * 
 * Usage:
 *   const detector = new ShotDetector(rimBox);
 *   detector.feedFrame({ ballBox, rimBox, timestamp });
 *   detector.onShot = (shot) => { ... };
 */

// --------------- Types ---------------

export interface BoundingBox {
  x: number;       // 0..1 (left edge of frame to right)
  y: number;       // 0..1 (top of frame to bottom)
  width: number;   // 0..1
  height: number;  // 0..1
  confidence?: number;
}

export interface FrameDetection {
  ballBox: BoundingBox | null;
  rimBox: BoundingBox | null;
  ballInBasket?: boolean; // direct from Roboflow model if available
  timestamp: number; // ms
}

export interface DetectedShot {
  made: boolean;
  shotIndex: number;
  releaseTimestamp: number;
  resultTimestamp: number;
  releaseAngle?: number;        // degrees
  arcHeight?: number;           // 0..1, peak height relative to rim
  trajectoryPoints: Array<{ x: number; y: number; t: number }>;
  shooterPosition?: { x: number; y: number }; // estimated court position 0..1
  zone?: string;
}

// --------------- Helpers ---------------

const dist = (ax: number, ay: number, bx: number, by: number) =>
  Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);

const center = (b: BoundingBox) => ({
  x: b.x + b.width / 2,
  y: b.y + b.height / 2,
});

// --------------- Phase machine ---------------

type Phase =
  | 'idle'         // no shot in progress, ball at rest or in shooter's hands
  | 'rising'       // ball moving upward toward rim
  | 'descending'   // ball past peak, falling toward rim
  | 'evaluating';  // ball reached rim, decide make/miss within next ~10 frames

// --------------- Main class ---------------

export class ShotDetector {
  // Frame buffer of recent detections
  private frames: FrameDetection[] = [];
  private maxBufferSize = 90; // 3 seconds at 30 FPS

  // State machine
  private phase: Phase = 'idle';
  private currentTrajectory: Array<{ x: number; y: number; t: number }> = [];
  private peakY: number = 1;
  private peakTimestamp: number = 0;
  private releaseTimestamp: number = 0;
  private releasePosition: { x: number; y: number } | null = null;
  private rimReachedTimestamp: number = 0;

  // Shot history
  private shots: DetectedShot[] = [];

  // Callbacks
  public onShot: ((shot: DetectedShot) => void) | null = null;
  public onPhaseChange: ((phase: Phase) => void) | null = null;

  // Config
  private rimYThreshold = 0.5; // ball must rise above this y (top half) to be a shot
  private velocityThreshold = 0.005; // min vertical velocity per frame to register motion
  private minTrajectoryFrames = 6; // shot must have at least this many frames

  constructor(private knownRimBox?: BoundingBox) {}

  /**
   * Set or update the known rim position. Call this once during calibration
   * (the user's phone is on a tripod facing the hoop).
   */
  setRim(rim: BoundingBox) {
    this.knownRimBox = rim;
  }

  /**
   * Feed a single frame's detection. Call this on every camera frame.
   */
  feedFrame(detection: FrameDetection) {
    this.frames.push(detection);
    if (this.frames.length > this.maxBufferSize) {
      this.frames.shift();
    }

    // use last known rim if not in this frame
    const rim = detection.rimBox || this.knownRimBox || this.lastSeenRim();
    if (!rim) return;

    // ball-in-basket signal directly from Roboflow model takes priority
    if (detection.ballInBasket && this.phase === 'evaluating') {
      this.completeShot(true, detection.timestamp);
      return;
    }

    if (!detection.ballBox) {
      // ball not visible this frame; if we're mid-shot, that's okay (might be in flight at edge)
      if (this.phase === 'evaluating') {
        // give it a few more frames to resolve
        if (detection.timestamp - this.rimReachedTimestamp > 1000) {
          // 1 second has passed at the rim, no ball-in-basket detected → miss
          this.completeShot(false, detection.timestamp);
        }
      }
      return;
    }

    const ball = center(detection.ballBox);
    const rimC = center(rim);

    switch (this.phase) {
      case 'idle':
        // detect a release: ball moves upward sharply
        this.detectRelease(ball, detection.timestamp);
        break;

      case 'rising':
        this.currentTrajectory.push({ x: ball.x, y: ball.y, t: detection.timestamp });
        // track peak
        if (ball.y < this.peakY) {
          this.peakY = ball.y;
          this.peakTimestamp = detection.timestamp;
        }
        // detect transition to descending
        if (this.currentTrajectory.length >= 4) {
          const recent = this.currentTrajectory.slice(-4);
          const dy =
            recent[recent.length - 1].y - recent[0].y;
          // y increasing = falling on screen
          if (dy > this.velocityThreshold * 3) {
            this.setPhase('descending');
          }
        }
        // safety: if ball drops below release without hitting rim, abort
        if (this.releasePosition && ball.y > this.releasePosition.y + 0.1) {
          this.abortShot();
        }
        break;

      case 'descending':
        this.currentTrajectory.push({ x: ball.x, y: ball.y, t: detection.timestamp });
        // detect ball reaching rim region
        if (this.ballNearRim(ball, rim)) {
          this.setPhase('evaluating');
          this.rimReachedTimestamp = detection.timestamp;
        }
        // safety: if descending too long without hitting rim, treat as miss
        if (detection.timestamp - this.peakTimestamp > 2000) {
          this.completeShot(false, detection.timestamp);
        }
        break;

      case 'evaluating':
        this.currentTrajectory.push({ x: ball.x, y: ball.y, t: detection.timestamp });
        // ball-in-basket would have been caught above
        // if ball moves significantly DOWN from rim, that's a make (passed through)
        // if ball bounces away (significant horizontal motion), that's a miss
        const verticalDrop = ball.y - rimC.y;
        const horizontalDrift = Math.abs(ball.x - rimC.x);

        if (verticalDrop > 0.05 && horizontalDrift < 0.06) {
          // ball is below rim and roughly centered → made it through
          this.completeShot(true, detection.timestamp);
        } else if (horizontalDrift > 0.12) {
          // ball bounced away → miss
          this.completeShot(false, detection.timestamp);
        } else if (detection.timestamp - this.rimReachedTimestamp > 1500) {
          // 1.5s timeout at rim — call it a miss
          this.completeShot(false, detection.timestamp);
        }
        break;
    }
  }

  /**
   * Get all shots detected in this session.
   */
  getShots(): DetectedShot[] {
    return [...this.shots];
  }

  /**
   * Reset the detector for a new session.
   */
  reset() {
    this.frames = [];
    this.shots = [];
    this.currentTrajectory = [];
    this.setPhase('idle');
  }

  /**
   * Manually correct the last shot's result. Used when the user taps "tap to fix"
   * on a misclassified shot.
   */
  correctLastShot(made: boolean) {
    if (this.shots.length === 0) return;
    this.shots[this.shots.length - 1].made = made;
  }

  // --------------- Internals ---------------

  private setPhase(phase: Phase) {
    if (this.phase !== phase) {
      this.phase = phase;
      this.onPhaseChange?.(phase);
    }
  }

  private detectRelease(ball: { x: number; y: number }, timestamp: number) {
    // need at least 3 prior frames to detect motion
    if (this.frames.length < 3) return;
    const prior = this.frames.slice(-4, -1).filter(f => f.ballBox).map(f => center(f.ballBox!));
    if (prior.length < 2) return;

    const avgPriorY = prior.reduce((s, p) => s + p.y, 0) / prior.length;
    // ball must be moving upward fast (lower y on screen = higher in real space)
    const upwardVelocity = avgPriorY - ball.y;

    if (upwardVelocity > this.velocityThreshold * 2) {
      // shot started
      this.currentTrajectory = [...prior.map(p => ({ x: p.x, y: p.y, t: timestamp - 100 })), { x: ball.x, y: ball.y, t: timestamp }];
      this.peakY = ball.y;
      this.peakTimestamp = timestamp;
      this.releaseTimestamp = timestamp;
      this.releasePosition = { x: prior[0].x, y: prior[0].y };
      this.setPhase('rising');
    }
  }

  private ballNearRim(ball: { x: number; y: number }, rim: BoundingBox): boolean {
    const rimC = center(rim);
    const proximity = dist(ball.x, ball.y, rimC.x, rimC.y);
    // ball is "near" rim if within 2x rim diameter
    return proximity < rim.width * 1.5;
  }

  private completeShot(made: boolean, timestamp: number) {
    if (this.currentTrajectory.length < this.minTrajectoryFrames) {
      this.abortShot();
      return;
    }

    const releaseAngle = this.computeReleaseAngle();
    const arcHeight = this.computeArcHeight();
    const shooterPos = this.releasePosition || undefined;

    const shot: DetectedShot = {
      made,
      shotIndex: this.shots.length,
      releaseTimestamp: this.releaseTimestamp,
      resultTimestamp: timestamp,
      releaseAngle,
      arcHeight,
      trajectoryPoints: [...this.currentTrajectory],
      shooterPosition: shooterPos,
      zone: shooterPos ? estimateZone(shooterPos.x, shooterPos.y) : undefined,
    };

    this.shots.push(shot);
    this.onShot?.(shot);
    this.resetShotState();
  }

  private abortShot() {
    this.resetShotState();
  }

  private resetShotState() {
    this.currentTrajectory = [];
    this.peakY = 1;
    this.peakTimestamp = 0;
    this.releaseTimestamp = 0;
    this.releasePosition = null;
    this.rimReachedTimestamp = 0;
    this.setPhase('idle');
  }

  private lastSeenRim(): BoundingBox | null {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      if (this.frames[i].rimBox) return this.frames[i].rimBox!;
    }
    return null;
  }

  private computeReleaseAngle(): number | undefined {
    if (this.currentTrajectory.length < 3) return undefined;
    // first two points after release
    const p1 = this.currentTrajectory[0];
    const p2 = this.currentTrajectory[2];
    const dx = p2.x - p1.x;
    const dy = p1.y - p2.y; // invert because y increases downward
    if (dx === 0) return 90;
    const radians = Math.atan2(dy, Math.abs(dx));
    return (radians * 180) / Math.PI;
  }

  private computeArcHeight(): number | undefined {
    if (!this.releasePosition) return undefined;
    // peak height relative to release point, normalized
    return Math.max(0, this.releasePosition.y - this.peakY);
  }
}

// --------------- Court zone estimation ---------------

/**
 * Given a shooter's normalized position in the camera frame (0..1, 0..1),
 * estimate which court zone they're shooting from.
 * 
 * This is a rough estimate based on the assumption that the camera is positioned
 * on the baseline or sideline facing the rim. For v1 we keep it simple — a
 * proper implementation would use court keypoint detection from a separate model.
 * 
 * Coordinate system assumptions:
 *  - x = 0 is left side of frame, 1 is right
 *  - y = 0 is top, 1 is bottom (closer to baseline)
 *  - the rim/hoop is roughly center frame
 */
export function estimateZone(shooterX: number, shooterY: number): string {
  // Simple grid-based estimation
  // Distance from rim center (assume rim at x=0.5, y=0.5 in frame)
  const dx = shooterX - 0.5;
  const dy = shooterY - 0.5;
  const distFromRim = Math.sqrt(dx * dx + dy * dy);

  // Very close to rim = restricted/block
  if (distFromRim < 0.12) {
    return 'Restricted';
  }

  // Mid-range
  if (distFromRim < 0.28) {
    if (Math.abs(dx) < 0.08) return 'Free Throw';
    if (dx < 0) return shooterY > 0.5 ? 'Left Block' : 'Left Mid';
    return shooterY > 0.5 ? 'Right Block' : 'Right Mid';
  }

  // Three-point range
  if (Math.abs(dx) > 0.32) {
    return dx < 0 ? 'Left Corner 3' : 'Right Corner 3';
  }
  if (Math.abs(dx) < 0.1) return 'Top of Key 3';
  return dx < 0 ? 'Left Wing 3' : 'Right Wing 3';
}

/**
 * Map normalized frame position to half-court coordinates for the shot chart visualization.
 * Returns { x: 0..1, y: 0..1 } where x is left-right of half court and y is baseline-to-half.
 */
export function frameToCourtPosition(
  frameX: number,
  frameY: number
): { x: number; y: number } {
  // For v1, do a simple linear mapping. A v2 would calibrate based on detected court lines.
  // Frame y near 1 (bottom) = closer to camera = closer to baseline
  // Frame y near 0 (top) = farther from camera = closer to half court
  return {
    x: frameX,
    y: 1 - frameY,
  };
}

// --------------- Aggregate stats helpers ---------------

export interface SessionStats {
  totalShots: number;
  makes: number;
  fgPercentage: number;
  bestStreak: number;
  currentStreak: number;
  byZone: Array<{ zone: string; attempts: number; makes: number; pct: number }>;
  averageReleaseAngle?: number;
  averageArcHeight?: number;
}

export function computeSessionStats(shots: DetectedShot[]): SessionStats {
  const totalShots = shots.length;
  const makes = shots.filter(s => s.made).length;
  const fgPercentage = totalShots > 0 ? (makes / totalShots) * 100 : 0;

  // streaks
  let bestStreak = 0;
  let currentStreak = 0;
  let runningStreak = 0;
  for (const s of shots) {
    if (s.made) {
      runningStreak += 1;
      if (runningStreak > bestStreak) bestStreak = runningStreak;
    } else {
      runningStreak = 0;
    }
  }
  currentStreak = runningStreak;

  // by zone
  const zoneMap: Record<string, { att: number; made: number }> = {};
  for (const s of shots) {
    const z = s.zone || 'Unknown';
    if (!zoneMap[z]) zoneMap[z] = { att: 0, made: 0 };
    zoneMap[z].att += 1;
    if (s.made) zoneMap[z].made += 1;
  }
  const byZone = Object.keys(zoneMap).map(z => ({
    zone: z,
    attempts: zoneMap[z].att,
    makes: zoneMap[z].made,
    pct: zoneMap[z].att > 0 ? (zoneMap[z].made / zoneMap[z].att) * 100 : 0,
  }));

  // form averages
  const angles = shots.map(s => s.releaseAngle).filter((a): a is number => a !== undefined);
  const averageReleaseAngle = angles.length > 0
    ? angles.reduce((a, b) => a + b, 0) / angles.length
    : undefined;

  const arcs = shots.map(s => s.arcHeight).filter((a): a is number => a !== undefined);
  const averageArcHeight = arcs.length > 0
    ? arcs.reduce((a, b) => a + b, 0) / arcs.length
    : undefined;

  return {
    totalShots,
    makes,
    fgPercentage,
    bestStreak,
    currentStreak,
    byZone,
    averageReleaseAngle,
    averageArcHeight,
  };
}
