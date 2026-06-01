/**
 * ShotOverlay — debug bounding-box layer over the live camera feed.
 *
 * Stats, flash animations, and shot indicators live in the parent screen
 * (open-run.tsx) so they can be wrapped in GlassPanel. This component
 * is responsible only for rendering ML detection boxes in debug mode.
 *
 * Toggle debug mode: long-press anywhere on the camera feed.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Detection } from '@/modules/shot-detector/src/ShotDetector.types';

interface Props {
  detections?: Detection[];
  showDebugBoxes?: boolean;
}

export default function ShotOverlay({ detections = [], showDebugBoxes = false }: Props) {
  if (!showDebugBoxes || detections.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {detections.map((det, i) => {
        const color  = getBoxColor(det.className);
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
                left:        `${x}%` as any,
                top:         `${y}%` as any,
                width:       `${width}%` as any,
                height:      `${height}%` as any,
                borderColor: color,
              },
            ]}
            pointerEvents="none"
          >
            <View style={[styles.label, { backgroundColor: color + 'CC' }]}>
              <Text style={styles.labelText}>
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
  bbox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 3,
  },
  label: {
    position: 'absolute',
    top: -18,
    left: 0,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  labelText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
