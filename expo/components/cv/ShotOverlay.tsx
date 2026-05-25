/**
 * ShotOverlay — rendered on top of the live camera feed.
 *
 * Shows:
 *  - Live make/miss counter and FG%
 *  - Flash animation when a shot is detected
 *  - Bounding boxes on detected objects (debug mode, toggled by long-press)
 *  - Last shot result badge
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
} from 'react-native';
import type { Detection } from '@/modules/shot-detector/src/ShotDetector.types';
import Colors from '@/constants/colors';

interface Props {
  makes: number;
  totalShots: number;
  lastShotType: 'make' | 'miss' | null;
  detections?: Detection[];  // for debug bounding boxes
  frameWidth?: number;
  frameHeight?: number;
  showDebugBoxes?: boolean;
}

export default function ShotOverlay({
  makes,
  totalShots,
  lastShotType,
  detections = [],
  frameWidth = 1,
  frameHeight = 1,
  showDebugBoxes = false,
}: Props) {
  const flashAnim   = useRef(new Animated.Value(0)).current;
  const [lastType, setLastType] = useState<'make' | 'miss' | null>(null);
  const prevLastShot = useRef<'make' | 'miss' | null>(null);

  const fgPct  = totalShots > 0 ? ((makes / totalShots) * 100).toFixed(1) : '--';
  const misses = totalShots - makes;

  // Flash animation whenever a new shot is detected
  useEffect(() => {
    if (lastShotType !== prevLastShot.current) {
      prevLastShot.current = lastShotType;
      if (lastShotType) {
        setLastType(lastShotType);
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
      }
    }
  }, [lastShotType, flashAnim]);

  const flashColor = lastType === 'make'
    ? 'rgba(76, 175, 80, 0.35)'
    : 'rgba(244, 67, 54, 0.35)';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">

      {/* Full-screen flash on shot detection */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: flashColor, opacity: flashAnim },
        ]}
        pointerEvents="none"
      />

      {/* Stats HUD — top right */}
      <View style={styles.hud}>
        <View style={styles.hudInner}>
          <Text style={styles.hudFg}>{fgPct}%</Text>
          <View style={styles.hudRow}>
            <Text style={[styles.hudNum, styles.makeColor]}>{makes}</Text>
            <Text style={styles.hudSlash}>/</Text>
            <Text style={styles.hudNum}>{totalShots}</Text>
          </View>
        </View>
      </View>

      {/* Last shot badge — briefly visible after each shot */}
      {lastShotType && (
        <Animated.View
          style={[
            styles.shotBadge,
            lastShotType === 'make' ? styles.makeBadge : styles.missBadge,
            { opacity: flashAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] }) },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.shotBadgeText}>
            {lastShotType === 'make' ? 'MAKE' : 'MISS'}
          </Text>
        </Animated.View>
      )}

      {/* Debug bounding boxes */}
      {showDebugBoxes && detections.map((det, i) => {
        const boxColor = getBoxColor(det.className);
        const x      = det.bbox.x * 100;
        const y      = det.bbox.y * 100;
        const width  = det.bbox.width * 100;
        const height = det.bbox.height * 100;
        return (
          <View
            key={i}
            style={[
              styles.bbox,
              {
                left:   `${x}%` as any,
                top:    `${y}%` as any,
                width:  `${width}%` as any,
                height: `${height}%` as any,
                borderColor: boxColor,
              },
            ]}
            pointerEvents="none"
          >
            <View style={[styles.bboxLabel, { backgroundColor: boxColor + 'CC' }]}>
              <Text style={styles.bboxLabelText}>
                {det.className} {(det.confidence * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
        );
      })}

    </View>
  );
}

function getBoxColor(className: string): string {
  switch (className) {
    case 'ball':            return '#FFD700';
    case 'ball_in_basket':  return '#4CAF50';
    case 'basket':          return '#2196F3';
    case 'player':          return '#FF9800';
    case 'player_shooting': return '#E91E63';
    default:                return '#FFFFFF';
  }
}

const styles = StyleSheet.create({
  hud: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  hudInner: {
    backgroundColor: 'rgba(0,0,0,0.60)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 72,
  },
  hudFg: {
    color: Colors.primary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  hudRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  hudNum: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  hudSlash: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
  makeColor: {
    color: '#66BB6A',
  },
  shotBadge: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 100,
  },
  makeBadge: { backgroundColor: 'rgba(76, 175, 80, 0.88)' },
  missBadge: { backgroundColor: 'rgba(244, 67, 54, 0.88)' },
  shotBadgeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 3,
  },
  bbox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 3,
  },
  bboxLabel: {
    position: 'absolute',
    top: -18,
    left: 0,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  bboxLabelText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
