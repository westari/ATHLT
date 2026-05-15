// expo/components/SessionHUD.tsx
// Bottom HUD overlay shown during a session.
// Layout: Timer center with gold progress arc, Reps left, Set right, Drill name below.
// Plus a thin top progress bar showing overall session progress.

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Pause, Play, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

type Props = {
  // Timer / progress
  drillName: string;
  drillSubtitle?: string;       // e.g. "Right elbow"
  timeRemainingSec: number;      // seconds left on current drill
  timeTotalSec: number;          // total seconds for current drill

  // Counts
  drillIndex: number;            // current drill, 0-based
  totalDrills: number;
  setIndex?: number;             // 0-based, optional
  totalSets?: number;
  repsDone?: number;
  repsTotal?: number;

  // Top progress
  sessionPctComplete: number;    // 0..100
  sessionTimeLabel?: string;     // e.g. "12:34"

  // Controls
  isPaused: boolean;
  onTogglePause: () => void;
  onExit: () => void;
};

export default function SessionHUD({
  drillName,
  drillSubtitle,
  timeRemainingSec,
  timeTotalSec,
  drillIndex,
  totalDrills,
  setIndex,
  totalSets,
  repsDone,
  repsTotal,
  sessionPctComplete,
  sessionTimeLabel,
  isPaused,
  onTogglePause,
  onExit,
}: Props) {
  const timeLabel = formatTime(timeRemainingSec);
  const arcPct = timeTotalSec > 0
    ? Math.max(0, Math.min(1, 1 - (timeRemainingSec / timeTotalSec)))
    : 0;

  const handleTogglePause = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTogglePause();
  };

  const handleExit = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onExit();
  };

  return (
    <>
      {/* Top status bar — overall session progress */}
      <View style={styles.topBar} pointerEvents="box-none">
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <TouchableOpacity onPress={handleExit} style={styles.exitBtn} activeOpacity={0.7}>
              <X size={16} color="#fff" />
            </TouchableOpacity>
            {sessionTimeLabel && (
              <Text style={styles.sessionTime}>
                {sessionTimeLabel} <Text style={styles.sessionPct}>· {Math.round(sessionPctComplete)}%</Text>
              </Text>
            )}
          </View>

          <View style={styles.drillCounter}>
            <Text style={styles.drillCounterGold}>DRILL {drillIndex + 1}</Text>
            <Text style={styles.drillCounterDim}>/ {totalDrills}</Text>
          </View>
        </View>

        <View style={styles.topProgressTrack}>
          <View style={[styles.topProgressFill, { width: `${sessionPctComplete}%` }]} />
        </View>
      </View>

      {/* Bottom HUD — timer, reps, set, drill name */}
      <View style={styles.bottomHud} pointerEvents="box-none">
        <View style={styles.bottomGradient} />

        <View style={styles.bottomContent}>
          {/* Counts row: Reps left | timer center | Set right */}
          <View style={styles.countsRow}>
            {/* Reps left */}
            <View style={styles.sideCount}>
              {repsTotal !== undefined ? (
                <>
                  <Text style={styles.sideCountLabel}>REPS</Text>
                  <Text style={styles.sideCountValue}>
                    {(repsDone ?? 0)} / {repsTotal}
                  </Text>
                </>
              ) : (
                <View style={{ width: 60 }} />
              )}
            </View>

            {/* Timer center with arc */}
            <TouchableOpacity
              style={styles.timerWrap}
              onPress={handleTogglePause}
              activeOpacity={0.85}
            >
              <Svg
                width={120}
                height={80}
                viewBox="0 0 120 80"
                style={styles.timerArc}
              >
                {/* Background arc */}
                <Path
                  d="M 12 72 A 48 48 0 0 1 108 72"
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                />
                {/* Active arc — animates with time elapsed */}
                <Path
                  d={`M 12 72 A 48 48 0 0 1 ${describeArcEndpoint(arcPct).x} ${describeArcEndpoint(arcPct).y}`}
                  stroke={Colors.primary}
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                />
              </Svg>

              <View style={styles.timerInner}>
                {isPaused ? (
                  <Play size={20} color={Colors.primary} fill={Colors.primary} />
                ) : (
                  <Text style={styles.timerText}>{timeLabel}</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Set count */}
            <View style={styles.sideCount}>
              {totalSets !== undefined ? (
                <>
                  <Text style={styles.sideCountLabel}>SET</Text>
                  <Text style={styles.sideCountValue}>
                    {(setIndex ?? 0) + 1} / {totalSets}
                  </Text>
                </>
              ) : (
                <View style={{ width: 60 }} />
              )}
            </View>
          </View>

          {/* Drill name */}
          <Text style={styles.drillName} numberOfLines={1}>
            {drillName}
            {drillSubtitle && (
              <Text style={styles.drillSubtitle}>{' · '}{drillSubtitle}</Text>
            )}
          </Text>
        </View>
      </View>
    </>
  );
}

// ===== Helpers =====

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/**
 * Returns the endpoint (x, y) of a half-circle arc at the given progress (0..1).
 * Arc starts at (12, 72), goes over a 48-radius arc, ending at (108, 72).
 */
function describeArcEndpoint(pct: number): { x: number; y: number } {
  // Half-circle from 180° to 0° (left to right over the top)
  const angleDeg = 180 - (pct * 180); // 180 → 0
  const angleRad = (angleDeg * Math.PI) / 180;
  const cx = 60;
  const cy = 72;
  const r = 48;
  const x = cx - r * Math.cos(angleRad);
  const y = cy - r * Math.sin(angleRad);
  // Floor at start to avoid the M and first arc point being identical
  if (pct <= 0.001) return { x: 12.01, y: 72 };
  return { x, y };
}

// ===== Styles =====

const styles = StyleSheet.create({
  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingHorizontal: 16,
    zIndex: 100,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exitBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  sessionTime: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  sessionPct: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  drillCounter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  drillCounterGold: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  drillCounterDim: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1,
  },
  topProgressTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  topProgressFill: {
    height: 2,
    backgroundColor: Colors.primary,
  },

  // Bottom HUD
  bottomHud: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
    zIndex: 100,
  },
  bottomGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  bottomContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    justifyContent: 'flex-end',
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  sideCount: {
    width: 60,
    alignItems: 'center',
  },
  sideCountLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  sideCountValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  timerWrap: {
    width: 120,
    height: 80,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  timerArc: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  timerInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  timerText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  drillName: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  drillSubtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
});
