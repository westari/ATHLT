/**
 * CourtHeatmap — premium shot density heatmap on an accurate NBA half-court.
 *
 * Renders smooth inferno-colormap heat blobs (radial gradients) at each zone's
 * representative shooting position. Blobs grow with attempt count and shift color
 * with FG%: cold purple → magenta → orange → pale yellow.
 *
 * Court geometry: NBA proportions at 9px/ft. Basket at bottom, half-court at top.
 * All arc math verified against real measurements.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Path, Circle, Line, Rect, Text as SvgText,
  Defs, RadialGradient, Stop,
  LinearGradient as SvgLinearGradient,
} from 'react-native-svg';
import Colors from '@/constants/colors';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ZoneData {
  makes:    number;
  attempts: number;
}

export interface CourtHeatmapZones {
  leftCorner:  ZoneData;
  leftWing:    ZoneData;
  topOfKey:    ZoneData;
  rightWing:   ZoneData;
  rightCorner: ZoneData;
  paint:       ZoneData;
}

/** Raw shot coordinates — if available these are rendered as individual blobs. */
export interface ShotPoint {
  x:    number;   // normalized 0–1 (0 = left sideline, 1 = right sideline)
  y:    number;   // normalized 0–1 (0 = baseline, 1 = half-court line)
  made: boolean;
}

interface CourtHeatmapProps {
  zones:       CourtHeatmapZones;
  shots?:      ShotPoint[];
  onZoneTap?:  (zoneName: string) => void;  // kept for API compat
  showLabels?: boolean;
}

// ─── Empty zones / hot-zone helper (exported for TodayHome) ──────────────────

export const EMPTY_ZONES: CourtHeatmapZones = {
  leftCorner:  { makes: 0, attempts: 0 },
  leftWing:    { makes: 0, attempts: 0 },
  topOfKey:    { makes: 0, attempts: 0 },
  rightWing:   { makes: 0, attempts: 0 },
  rightCorner: { makes: 0, attempts: 0 },
  paint:       { makes: 0, attempts: 0 },
};

export function hotZoneName(zones: CourtHeatmapZones): string | null {
  const entries: [string, ZoneData][] = [
    ['Left corner',  zones.leftCorner],
    ['Left wing',    zones.leftWing],
    ['Top of key',   zones.topOfKey],
    ['Right wing',   zones.rightWing],
    ['Right corner', zones.rightCorner],
    ['Paint',        zones.paint],
  ];
  const withData = entries.filter(([, z]) => z.attempts >= 3);
  if (withData.length === 0) return null;
  return withData.reduce((a, b) =>
    (b[1].makes / b[1].attempts) > (a[1].makes / a[1].attempts) ? b : a
  )[0];
}

// ─── Court geometry — NBA proportions at 9 px / ft ──────────────────────────
//
//   Half-court: 50 ft wide × 47 ft long  →  450 px × 423 px
//   ViewBox: 500 × 480  (25 px side margins, plus 20 px legend strip at bottom)
//
//   Basket → baseline:  5.25 ft  =  47 px  →  basket y = 450 − 47 = 403
//   Paint width:        16 ft    = 144 px  →  x = 178 … 322  (±72 from center)
//   FT line:            15 ft from baseline = 135 px  →  y = 315
//   FT / center circle: 6 ft radius = 54 px
//   Restricted area:    4 ft radius = 36 px
//   3pt radius:         23.75 ft = 214 px  (center at basket)
//   3pt corner x:       22 ft    = 198 px  →  x = 52 / 448
//   3pt corner y:       basket_y − √(214²−198²) = 403 − 81 = 322

const W  = 500;
const H  = 480;   // extra 30 px below baseline for legend
const CX = 250;   // center x

// Court boundary
const BL  = 450;  // baseline y
const HL  = 25;   // half-court line y
const LS  = 25;   // left sideline x
const RS  = 475;  // right sideline x

// Key positions
const BASK_X  = CX;
const BASK_Y  = 403;  // rim center
const PAINT_L = 178;
const PAINT_R = 322;
const FT_Y    = 315;  // free throw line y
const FT_R    = 54;   // free throw / center circle radius
const RA_R    = 36;   // restricted area radius

// 3-point line
const TP_R  = 214;  // arc radius (23.75 ft × 9)
const TP_CL = 52;   // left corner x  (250 − 198)
const TP_CR = 448;  // right corner x (250 + 198)
const TP_Y  = 322;  // y where corner segments meet the arc

// Court line style — subtle light gray
const CS = 'rgba(255,255,255,0.22)';
const CW = 1.5;

// ─── Heatmap zones ───────────────────────────────────────────────────────────

type ZoneKey = keyof CourtHeatmapZones;
const ZONE_KEYS: ZoneKey[] = [
  'leftCorner', 'leftWing', 'topOfKey', 'rightWing', 'rightCorner', 'paint',
];

// Representative shooting position for each zone (SVG px)
const ZONE_POS: Record<ZoneKey, { x: number; y: number }> = {
  leftCorner:  { x: 40,  y: 426 },
  leftWing:    { x: 84,  y: 264 },
  topOfKey:    { x: CX,  y: 192 },
  rightWing:   { x: 416, y: 264 },
  rightCorner: { x: 460, y: 426 },
  paint:       { x: CX,  y: 368 },
};

// Base blob radii — scaled by attempt density at render time
const ZONE_BASE_R: Record<ZoneKey, number> = {
  leftCorner:  50,
  leftWing:    70,
  topOfKey:    86,
  rightWing:   70,
  rightCorner: 50,
  paint:       66,
};

// Inferno/magma colormap: center, mid-ring, outer-ring based on FG%
function heatColors(z: ZoneData): { c0: string; c1: string; c2: string; a: number } | null {
  if (z.attempts === 0) return null;
  const pct     = (z.makes / z.attempts) * 100;
  const density = Math.min(1.0, z.attempts / 20);
  const a       = 0.28 + density * 0.62;

  if (pct >= 55) return { c0: '#fcfdbf', c1: '#fe9f6d', c2: '#de4968', a };       // yellow → orange → red
  if (pct >= 40) return { c0: '#fe9f6d', c1: '#de4968', c2: '#8c2981', a };       // orange → red → magenta
  if (pct >= 25) return { c0: '#de4968', c1: '#8c2981', c2: '#3b0f70', a };       // red → magenta → purple
  return           { c0: '#8c2981', c1: '#3b0f70', c2: '#150030', a: a * 0.80 }; // cold: magenta → dark purple
}

function blobR(zone: ZoneKey, attempts: number): number {
  if (attempts === 0) return 0;
  return ZONE_BASE_R[zone] * (0.65 + Math.sqrt(Math.min(attempts, 30) / 30) * 0.55);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CourtHeatmap({
  zones,
  shots,
  showLabels = false,
}: CourtHeatmapProps) {
  const hasData = ZONE_KEYS.some(k => zones[k].attempts > 0)
    || (shots != null && shots.length > 0);
  const totalAtt = ZONE_KEYS.reduce((s, k) => s + zones[k].attempts, 0)
    + (shots?.length ?? 0);

  return (
    <View>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>SHOT MAP</Text>
        {hasData
          ? <Text style={s.subtitle}>{totalAtt} shot{totalAtt !== 1 ? 's' : ''} · 30 days</Text>
          : <Text style={s.subtitle}>No shots tracked yet</Text>
        }
      </View>

      {/* Court */}
      <View style={s.courtWrap}>
        <Svg width="100%" height={undefined} viewBox={`0 0 ${W} ${H}`} style={s.svg}>

          {/* ── Gradient definitions ──────────────────────────────────────── */}
          <Defs>

            {/* Legend bar */}
            <SvgLinearGradient id="lgnd" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%"   stopColor="#150030" stopOpacity="1" />
              <Stop offset="20%"  stopColor="#3b0f70" stopOpacity="1" />
              <Stop offset="42%"  stopColor="#8c2981" stopOpacity="1" />
              <Stop offset="64%"  stopColor="#de4968" stopOpacity="1" />
              <Stop offset="83%"  stopColor="#fe9f6d" stopOpacity="1" />
              <Stop offset="100%" stopColor="#fcfdbf" stopOpacity="1" />
            </SvgLinearGradient>

            {/* Per-zone radial heat blobs */}
            {ZONE_KEYS.map(key => {
              const h = heatColors(zones[key]);
              if (!h) return null;
              return (
                <RadialGradient key={`rg_${key}`} id={`rg_${key}`}
                  cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <Stop offset="0%"   stopColor={h.c0} stopOpacity={h.a.toFixed(2)} />
                  <Stop offset="30%"  stopColor={h.c1} stopOpacity={(h.a * 0.68).toFixed(2)} />
                  <Stop offset="62%"  stopColor={h.c2} stopOpacity={(h.a * 0.32).toFixed(2)} />
                  <Stop offset="100%" stopColor={h.c2} stopOpacity="0" />
                </RadialGradient>
              );
            })}

            {/* Per-shot gradients (raw coordinate mode) */}
            {shots?.map((sh, i) => (
              <RadialGradient key={`rgs_${i}`} id={`rgs_${i}`}
                cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <Stop offset="0%"   stopColor={sh.made ? '#fe9f6d' : '#8c2981'} stopOpacity="0.72" />
                <Stop offset="55%"  stopColor={sh.made ? '#de4968' : '#3b0f70'} stopOpacity="0.28" />
                <Stop offset="100%" stopColor={sh.made ? '#de4968' : '#3b0f70'} stopOpacity="0" />
              </RadialGradient>
            ))}

          </Defs>

          {/* ── Court fill ───────────────────────────────────────────────── */}
          <Rect x={LS} y={HL} width={RS - LS} height={BL - HL}
            fill="rgba(255,255,255,0.018)" stroke="none" />

          {/* ── Heat blobs — rendered BELOW court lines ───────────────────── */}

          {/* Zone blobs */}
          {ZONE_KEYS.map(key => {
            const z   = zones[key];
            const r   = blobR(key, z.attempts);
            if (r === 0) return null;
            const pos = ZONE_POS[key];
            return (
              <Circle key={`blob_${key}`}
                cx={pos.x} cy={pos.y} r={r}
                fill={`url(#rg_${key})`} />
            );
          })}

          {/* Raw shot blobs */}
          {shots?.map((sh, i) => {
            const sx = LS + sh.x * (RS - LS);
            const sy = BL - sh.y * (BL - HL);
            return (
              <Circle key={`sh_${i}`} cx={sx} cy={sy} r={26}
                fill={`url(#rgs_${i})`} />
            );
          })}

          {/* ── Court lines — drawn on top of heatmap ─────────────────────── */}

          {/* Court boundary */}
          <Rect x={LS} y={HL} width={RS - LS} height={BL - HL}
            fill="none" stroke={CS} strokeWidth={CW} />

          {/* Half-court center circle — lower arc only (bulges into court) */}
          <Path
            d={`M ${CX - FT_R} ${HL} A ${FT_R} ${FT_R} 0 0 1 ${CX + FT_R} ${HL}`}
            fill="none" stroke={CS} strokeWidth={CW} />

          {/* Paint lane */}
          <Rect x={PAINT_L} y={FT_Y} width={PAINT_R - PAINT_L} height={BL - FT_Y}
            fill="rgba(255,255,255,0.025)" stroke={CS} strokeWidth={CW} />

          {/* Free throw circle — lower solid arc (faces basket) */}
          <Path
            d={`M ${CX - FT_R} ${FT_Y} A ${FT_R} ${FT_R} 0 0 1 ${CX + FT_R} ${FT_Y}`}
            fill="none" stroke={CS} strokeWidth={CW} />

          {/* Free throw circle — upper dashed arc (faces center court) */}
          <Path
            d={`M ${CX - FT_R} ${FT_Y} A ${FT_R} ${FT_R} 0 0 0 ${CX + FT_R} ${FT_Y}`}
            fill="none" stroke={CS} strokeWidth={CW} strokeDasharray="6 4" />

          {/* Restricted area arc (faces center court — upper semicircle) */}
          <Path
            d={`M ${BASK_X - RA_R} ${BASK_Y} A ${RA_R} ${RA_R} 0 0 0 ${BASK_X + RA_R} ${BASK_Y}`}
            fill="none" stroke={CS} strokeWidth={CW} />

          {/* 3-point corner straight segments */}
          <Line x1={TP_CL} y1={BL} x2={TP_CL} y2={TP_Y} stroke={CS} strokeWidth={CW} />
          <Line x1={TP_CR} y1={BL} x2={TP_CR} y2={TP_Y} stroke={CS} strokeWidth={CW} />

          {/* 3-point arc — small CCW arc from left corner to right corner via top */}
          <Path
            d={`M ${TP_CL} ${TP_Y} A ${TP_R} ${TP_R} 0 0 0 ${TP_CR} ${TP_Y}`}
            fill="none" stroke={CS} strokeWidth={CW} />

          {/* Backboard */}
          <Line
            x1={CX - 27} y1={BL - 5}
            x2={CX + 27} y2={BL - 5}
            stroke="rgba(255,255,255,0.45)" strokeWidth={2.5} strokeLinecap="round" />

          {/* Rim — gold ring with inner dot */}
          <Circle cx={BASK_X} cy={BASK_Y} r={10}
            fill="none" stroke={Colors.primary} strokeWidth={2.5} />
          <Circle cx={BASK_X} cy={BASK_Y} r={3}
            fill={Colors.primary} opacity={0.7} />

          {/* ── Zone % labels (when showLabels=true and data exists) ────── */}
          {showLabels && ZONE_KEYS.map(key => {
            const z = zones[key];
            if (z.attempts < 1) return null;
            const pos = ZONE_POS[key];
            const pct = Math.round((z.makes / z.attempts) * 100);
            return (
              <SvgText key={`lbl_${key}`}
                x={pos.x} y={pos.y}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={11} fontWeight="700"
                fill="#FFFFFF" fillOpacity={0.92}>
                {pct}%
              </SvgText>
            );
          })}

          {/* ── Empty-state text ─────────────────────────────────────────── */}
          {!hasData && (
            <>
              <SvgText x={CX} y={232}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={13} fontWeight="500"
                fill={Colors.textMuted}>
                Start training to see
              </SvgText>
              <SvgText x={CX} y={254}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={13} fontWeight="500"
                fill={Colors.textMuted}>
                your shot map
              </SvgText>
            </>
          )}

          {/* ── Legend bar ───────────────────────────────────────────────── */}
          {hasData && (
            <>
              <SvgText x={LS}       y={H - 8}
                fontSize={8} fontWeight="600" letterSpacing={0.5}
                fill={Colors.textMuted}>
                COLD
              </SvgText>
              <Rect x={LS + 34} y={H - 17} width={RS - LS - 68} height={8}
                fill="url(#lgnd)" rx={4} ry={4} />
              <SvgText x={RS - 2}  y={H - 8}
                textAnchor="end"
                fontSize={8} fontWeight="600" letterSpacing={0.5}
                fill={Colors.textMuted}>
                HOT
              </SvgText>
            </>
          )}

        </Svg>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Colors.primary,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: -0.1,
  },
  courtWrap: {
    width: '100%',
    aspectRatio: W / H,
  },
  svg: {
    flex: 1,
  },
});
