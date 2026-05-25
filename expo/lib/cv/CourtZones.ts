/**
 * Court zone mapping for shot tracking.
 *
 * The camera is positioned behind or beside the player, looking toward the rim.
 * Ball and rim positions are in normalized frame coordinates (0..1, 0..1),
 * with origin at top-left.
 *
 * Zone calculation is rim-relative: once we know where the rim is in the frame,
 * we can estimate the shot distance and angle relative to the basket.
 */

export type CourtZone =
  | 'Restricted Area'
  | 'Left Block'
  | 'Right Block'
  | 'Left Elbow'
  | 'Right Elbow'
  | 'Free Throw'
  | 'Left Mid'
  | 'Right Mid'
  | 'Left Corner 3'
  | 'Right Corner 3'
  | 'Left Wing 3'
  | 'Right Wing 3'
  | 'Top of Key 3'
  | 'Unknown';

export interface RimPosition {
  x: number;   // center x, 0..1
  y: number;   // center y, 0..1
  width: number;
  height: number;
}

export interface ZoneResult {
  zone: CourtZone;
  distanceFromRim: number;   // normalized 0..1
  angleFromCenter: number;   // degrees, 0 = straight on, negative = left, positive = right
}

/**
 * Map a ball/shooter position in the frame to a court zone.
 *
 * @param shooterX  Ball or shooter x position, 0..1 (left to right in frame)
 * @param shooterY  Ball or shooter y position, 0..1 (top to bottom in frame)
 * @param rim       Known rim position in frame (from ball/basket detection)
 */
export function getCourtZone(
  shooterX: number,
  shooterY: number,
  rim?: RimPosition | null
): ZoneResult {
  // Use detected rim as anchor if available; fall back to assumed center position
  const rimCx = rim ? rim.x + rim.width / 2 : 0.5;
  const rimCy = rim ? rim.y + rim.height / 2 : 0.42;

  const dx = shooterX - rimCx;
  // y grows downward in frame; shooter below rim in frame = closer to camera = closer to basket
  const dy = shooterY - rimCy;
  const distFromRim = Math.sqrt(dx * dx + dy * dy);

  // Angle in degrees: 0 = directly in front of rim (left/right center)
  // Negative = shooter is to the left, positive = to the right
  const angleFromCenter = Math.atan2(dx, Math.max(dy, 0.01)) * (180 / Math.PI);

  let zone: CourtZone;

  if (distFromRim < 0.08) {
    zone = 'Restricted Area';
  } else if (distFromRim < 0.15) {
    // Block / close range
    zone = dx < -0.04 ? 'Left Block' : dx > 0.04 ? 'Right Block' : 'Restricted Area';
  } else if (distFromRim < 0.24) {
    // Mid-range
    if (Math.abs(dx) < 0.07) {
      zone = 'Free Throw';
    } else if (dx < 0) {
      zone = distFromRim < 0.18 ? 'Left Elbow' : 'Left Mid';
    } else {
      zone = distFromRim < 0.18 ? 'Right Elbow' : 'Right Mid';
    }
  } else {
    // Three-point range
    if (Math.abs(dx) > 0.30) {
      zone = dx < 0 ? 'Left Corner 3' : 'Right Corner 3';
    } else if (Math.abs(dx) > 0.16) {
      zone = dx < 0 ? 'Left Wing 3' : 'Right Wing 3';
    } else {
      zone = 'Top of Key 3';
    }
  }

  return { zone, distanceFromRim: distFromRim, angleFromCenter };
}

/**
 * Simple zone grouping for summary display.
 * Groups the fine zones into broader categories for the post-session recap.
 */
export function getZoneGroup(zone: CourtZone): string {
  switch (zone) {
    case 'Restricted Area':
    case 'Left Block':
    case 'Right Block':
      return 'At the Rim';
    case 'Left Elbow':
    case 'Right Elbow':
    case 'Free Throw':
    case 'Left Mid':
    case 'Right Mid':
      return 'Mid-Range';
    case 'Left Corner 3':
    case 'Right Corner 3':
      return 'Corner 3';
    case 'Left Wing 3':
    case 'Right Wing 3':
    case 'Top of Key 3':
      return 'Above the Break 3';
    default:
      return 'Unknown';
  }
}

/**
 * Zone breakdown: given an array of shot zones with make/miss,
 * return sorted stats for display in PostSessionRecap.
 */
export function computeZoneStats(
  shotZones: Array<{ zone: CourtZone; made: boolean }>
): Array<{ zone: CourtZone; attempts: number; makes: number; pct: number }> {
  const map = new Map<CourtZone, { attempts: number; makes: number }>();

  for (const { zone, made } of shotZones) {
    if (!map.has(zone)) map.set(zone, { attempts: 0, makes: 0 });
    const entry = map.get(zone)!;
    entry.attempts++;
    if (made) entry.makes++;
  }

  return Array.from(map.entries())
    .map(([zone, { attempts, makes }]) => ({
      zone,
      attempts,
      makes,
      pct: attempts > 0 ? (makes / attempts) * 100 : 0,
    }))
    .sort((a, b) => b.attempts - a.attempts);
}

/**
 * Convert normalized frame coordinates to a display string for the user.
 * e.g. "Left Wing 3 (63%)" or "Top of Key 3 (41%)"
 */
export function formatZoneStats(stats: ReturnType<typeof computeZoneStats>): string {
  return stats
    .filter(s => s.attempts >= 2)
    .slice(0, 3)
    .map(s => `${s.zone}: ${s.makes}/${s.attempts} (${s.pct.toFixed(0)}%)`)
    .join(' · ');
}
