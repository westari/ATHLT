/**
 * CourtHeatmap — basketball half-court diagram with 6 shot zones.
 *
 * Each zone is color-coded by FG%:
 *   >= 60%  → gold  70% opacity (very hot)
 *   45–60%  → gold  45% opacity (hot)
 *   30–45%  → muted 30% opacity (average)
 *   < 30%   → red   30% opacity (cold)
 *   no data → hairline fill    (new user)
 *
 * See components/CourtHeatmap.md for full API reference.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import Svg, { Path, Circle, Line, Rect, Text as SvgText, G } from 'react-native-svg';
import Colors from '@/constants/colors';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ZoneData {
  makes: number;
  attempts: number;
}

export interface CourtHeatmapZones {
  leftCorner: ZoneData;
  leftWing:   ZoneData;
  topOfKey:   ZoneData;
  rightWing:  ZoneData;
  rightCorner: ZoneData;
  paint:      ZoneData;
}

interface CourtHeatmapProps {
  zones:        CourtHeatmapZones;
  onZoneTap?:  (zoneName: string) => void;
  showLabels?: boolean;
}

// ─── Empty (zero) zones ───────────────────────────────────────────────────────

export const EMPTY_ZONES: CourtHeatmapZones = {
  leftCorner:  { makes: 0, attempts: 0 },
  leftWing:    { makes: 0, attempts: 0 },
  topOfKey:    { makes: 0, attempts: 0 },
  rightWing:   { makes: 0, attempts: 0 },
  rightCorner: { makes: 0, attempts: 0 },
  paint:       { makes: 0, attempts: 0 },
};

// ─── Color coding ─────────────────────────────────────────────────────────────

function zoneColor(z: ZoneData): string {
  if (z.attempts === 0) return 'rgba(220,214,202,0.15)';
  const pct = (z.makes / z.attempts) * 100;
  if (pct >= 60) return 'rgba(201,162,74,0.70)';
  if (pct >= 45) return 'rgba(201,162,74,0.45)';
  if (pct >= 30) return 'rgba(138,144,153,0.30)';
  return 'rgba(224,72,72,0.30)';
}

function zonePctLabel(z: ZoneData): string {
  if (z.attempts === 0) return '--';
  return `${Math.round((z.makes / z.attempts) * 100)}%`;
}

function hotZoneName(zones: CourtHeatmapZones): string | null {
  const entries: [string, ZoneData][] = [
    ['Left corner',  zones.leftCorner],
    ['Left wing',    zones.leftWing],
    ['Top of key',   zones.topOfKey],
    ['Right wing',   zones.rightWing],
    ['Right corner', zones.rightCorner],
    ['Paint',        zones.paint],
  ];
  const withData = entries.filter(([, z]) => z.attempts > 0);
  if (withData.length === 0) return null;
  const best = withData.reduce((a, b) =>
    (b[1].makes / b[1].attempts) > (a[1].makes / a[1].attempts) ? b : a
  );
  return best[0];
}

// ─── SVG constants ─────────────────────────────────────────────────────────────
// Half-court, hoop at bottom-center.
//
// ViewBox: 0 0 400 370
// Hoop center:       (200, 300)
// 3pt arc:           center (200,300), radius 146
// 3pt junctions:     (55, 285) and (345, 285)
// 3pt arc top:       (200, 154)
// Paint lane:        x 155–245, y 190–355
// Free throw line:   y 190, x 155–245
// FT circle:         center (200,190), radius 50 (upper arc only)
// Backboard:         y 278, x 188–212
// Hoop circle:       (200, 293), radius 10
//
// Zone 6 arc command (55,285)→(345,285) via top:  A 146 146 0 0 0 345 285
// Zones 2/4 arc direction:                         A 146 146 0 0 0 97 197 etc.

const W = 400;
const H = 370;
const COURT_STROKE = Colors.inkA24;     // '#0B0E12' at 24% — matches design system
const COURT_SW     = 1.5;
const ARC_SW       = 1.5;
const HOOP_FILL    = Colors.primary;    // gold

// Zone path definitions — these tile the full visible half court with no gaps/overlaps.
// See cv/SHOT-ZONES.md for coordinate derivation.
const PATHS = {
  leftCorner:  'M 10 355 L 55 355 L 55 285 L 10 285 Z',
  leftWing:    'M 10 197 L 10 285 L 55 285 A 146 146 0 0 0 97 197 Z',
  topOfKey:    'M 10 20 L 10 197 L 97 197 A 146 146 0 0 0 303 197 L 390 197 L 390 20 Z',
  rightWing:   'M 303 197 L 390 197 L 390 285 L 345 285 A 146 146 0 0 1 303 197 Z',
  rightCorner: 'M 345 285 L 390 285 L 390 355 L 345 355 Z',
  paint:       'M 55 355 L 55 285 A 146 146 0 0 0 345 285 L 345 355 Z',
};

// Visual center of each zone for label placement
const LABEL_POS = {
  leftCorner:  { x: 32,  y: 325 },
  leftWing:    { x: 38,  y: 243 },
  topOfKey:    { x: 200, y: 100 },
  rightWing:   { x: 362, y: 243 },
  rightCorner: { x: 368, y: 325 },
  paint:       { x: 200, y: 265 },
};

const ZONE_KEYS = ['leftCorner', 'leftWing', 'topOfKey', 'rightWing', 'rightCorner', 'paint'] as const;
type ZoneKey = typeof ZONE_KEYS[number];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CourtHeatmap({ zones, onZoneTap, showLabels = false }: CourtHeatmapProps) {
  const hasAnyData = ZONE_KEYS.some(k => zones[k].attempts > 0);

  return (
    <View style={s.wrap}>
      <Svg width="100%" height={undefined} viewBox={`0 0 ${W} ${H}`} style={s.svg}>

        {/* ── Court outline ─────────────────────────────────────────────────── */}
        {/* Court boundary */}
        <Rect
          x={10} y={20} width={380} height={335}
          fill="none"
          stroke={COURT_STROKE}
          strokeWidth={COURT_SW}
        />

        {/* Paint lane fill (lighter warm tone) */}
        <Rect
          x={155} y={190} width={90} height={165}
          fill="rgba(11,14,18,0.03)"
          stroke={COURT_STROKE}
          strokeWidth={COURT_SW}
        />

        {/* Free throw line */}
        <Line
          x1={155} y1={190} x2={245} y2={190}
          stroke={COURT_STROKE} strokeWidth={COURT_SW}
        />

        {/* Free throw circle — top half only */}
        <Path
          d="M 150 190 A 50 50 0 0 1 250 190"
          fill="none"
          stroke={COURT_STROKE}
          strokeWidth={COURT_SW}
        />

        {/* 3-point corner lines */}
        <Line x1={55} y1={355} x2={55} y2={285} stroke={COURT_STROKE} strokeWidth={ARC_SW} />
        <Line x1={345} y1={355} x2={345} y2={285} stroke={COURT_STROKE} strokeWidth={ARC_SW} />

        {/* 3-point arc */}
        <Path
          d="M 55 285 A 146 146 0 0 0 345 285"
          fill="none"
          stroke={COURT_STROKE}
          strokeWidth={ARC_SW}
        />

        {/* Backboard */}
        <Line x1={188} y1={278} x2={212} y2={278} stroke={COURT_STROKE} strokeWidth={2} />

        {/* Restricted area arc (small semi-circle under basket) */}
        <Path
          d="M 180 300 A 20 20 0 0 0 220 300"
          fill="none"
          stroke={COURT_STROKE}
          strokeWidth={1}
        />

        {/* ── Zone fills ───────────────────────────────────────────────────── */}
        {ZONE_KEYS.map(key => (
          <Path
            key={key}
            d={PATHS[key]}
            fill={zoneColor(zones[key])}
            stroke="none"
          />
        ))}

        {/* ── Hoop (gold circle) ───────────────────────────────────────────── */}
        <Circle cx={200} cy={293} r={10} fill={HOOP_FILL} opacity={0.9} />

        {/* ── Zone labels ──────────────────────────────────────────────────── */}
        {showLabels && ZONE_KEYS.map(key => {
          const pos = LABEL_POS[key];
          const pct = zonePctLabel(zones[key]);
          return (
            <SvgText
              key={key}
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fontWeight="600"
              fill={Colors.textPrimary}
              opacity={0.85}
            >
              {pct}
            </SvgText>
          );
        })}

        {/* ── Empty state overlay ──────────────────────────────────────────── */}
        {!hasAnyData && (
          <SvgText
            x={200}
            y={200}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={12}
            fontWeight="500"
            fill={Colors.textMuted}
          >
            Start training to see your shot map
          </SvgText>
        )}

      </Svg>

      {/* Tappable zone overlay (invisible, on top of SVG) */}
      {onZoneTap && ZONE_KEYS.map(key => (
        <ZoneTapTarget
          key={key}
          zoneKey={key}
          onPress={onZoneTap}
        />
      ))}
    </View>
  );
}

// ─── Zone tap target (approximate hit areas) ──────────────────────────────────
// We can't do precise SVG hit detection in RN, so we use approximate View
// hit areas that roughly correspond to each zone. Fine for a heatmap.

const ZONE_HIT: Record<ZoneKey, { left: string; top: string; width: string; height: string }> = {
  leftCorner:  { left: '2.5%',  top: '75%',  width: '11%', height: '25%' },
  leftWing:    { left: '2.5%',  top: '45%',  width: '14%', height: '30%' },
  topOfKey:    { left: '14%',   top: '0%',   width: '72%', height: '50%' },
  rightWing:   { left: '83.5%', top: '45%',  width: '14%', height: '30%' },
  rightCorner: { left: '86%',   top: '75%',  width: '11%', height: '25%' },
  paint:       { left: '13.5%', top: '50%',  width: '72%', height: '50%' },
};

function ZoneTapTarget({ zoneKey, onPress }: { zoneKey: ZoneKey; onPress: (name: string) => void }) {
  const hit = ZONE_HIT[zoneKey];
  const display: Record<ZoneKey, string> = {
    leftCorner: 'Left corner', leftWing: 'Left wing', topOfKey: 'Top of key',
    rightWing: 'Right wing', rightCorner: 'Right corner', paint: 'Paint',
  };
  return (
    <TouchableOpacity
      style={[s.zoneTap, { left: hit.left as any, top: hit.top as any, width: hit.width as any, height: hit.height as any }]}
      onPress={() => onPress(display[zoneKey])}
      activeOpacity={0.85}
    />
  );
}

// ─── Helpers (exported for TodayHome) ─────────────────────────────────────────

export { hotZoneName };

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: W / H, position: 'relative' },
  svg:  { flex: 1 },
  zoneTap: { position: 'absolute' },
});
