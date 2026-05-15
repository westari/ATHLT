// expo/components/SessionSetupOverlay.tsx
// Setup instructions shown:
//   1. At the first drill of every session
//   2. Again if the user rotates their phone back to portrait mid-session
//
// Renders an overlay on top of the session screen. Has a "Ready" CTA
// that dismisses the overlay and starts the next phase (demo video).

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import Svg, { Rect, Line, Circle } from 'react-native-svg';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

type Props = {
  drillName: string;
  drillIndex: number;
  totalDrills: number;
  onReady: () => void;
  isPortraitWarning?: boolean; // true when shown because user rotated back to portrait
};

export default function SessionSetupOverlay({
  drillName,
  drillIndex,
  totalDrills,
  onReady,
  isPortraitWarning,
}: Props) {
  const handleReady = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReady();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Top tag */}
        <View style={styles.tag}>
          <Text style={styles.tagText}>
            {isPortraitWarning ? 'TURN YOUR PHONE BACK' : 'GET SET UP'}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {isPortraitWarning
            ? 'Rotate to landscape'
            : 'Lay your phone sideways'}
        </Text>

        <Text style={styles.subtitle}>
          {isPortraitWarning
            ? 'The session keeps going. Get back in landscape to continue.'
            : 'Set your phone horizontally on a tripod or against something flat. Step back 6-8 feet so your full body is in frame.'}
        </Text>

        {/* Illustration of phone in landscape */}
        <View style={styles.illustration}>
          <Svg width={200} height={120} viewBox="0 0 200 120">
            {/* Phone in landscape position */}
            <Rect
              x="20"
              y="30"
              width="160"
              height="80"
              rx="10"
              fill="none"
              stroke={Colors.primary}
              strokeWidth="3"
            />
            {/* Screen */}
            <Rect
              x="28"
              y="38"
              width="144"
              height="64"
              rx="4"
              fill={Colors.primary}
              fillOpacity="0.15"
            />
            {/* Camera dot */}
            <Circle cx="100" cy="34" r="2" fill={Colors.primary} />

            {/* Ground line */}
            <Line
              x1="0"
              y1="115"
              x2="200"
              y2="115"
              stroke={Colors.surfaceBorder}
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          </Svg>
        </View>

        {/* Checklist */}
        <View style={styles.checklist}>
          <ChecklistItem text="Phone is sideways (landscape)" />
          <ChecklistItem text="Phone is stable (tripod or flat surface)" />
          <ChecklistItem text="You're 6-8 feet back, full body in frame" />
        </View>

        {/* Drill info */}
        <View style={styles.drillInfo}>
          <Text style={styles.drillInfoLabel}>
            DRILL {drillIndex + 1} OF {totalDrills}
          </Text>
          <Text style={styles.drillInfoName} numberOfLines={2}>
            {drillName}
          </Text>
        </View>

        {/* Ready button */}
        <TouchableOpacity
          style={styles.readyBtn}
          onPress={handleReady}
          activeOpacity={0.85}
        >
          <Text style={styles.readyBtnText}>I'm ready</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ChecklistItem({ text }: { text: string }) {
  return (
    <View style={styles.checkItem}>
      <View style={styles.checkIcon}>
        <Check size={11} color={Colors.primary} strokeWidth={3} />
      </View>
      <Text style={styles.checkText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
  },
  tag: {
    backgroundColor: 'rgba(212, 160, 23, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 23, 0.35)',
    marginBottom: 12,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 380,
  },
  illustration: {
    marginBottom: 16,
  },
  checklist: {
    alignSelf: 'stretch',
    maxWidth: 360,
    width: '100%',
    marginBottom: 20,
    gap: 8,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(212, 160, 23, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
  },
  drillInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  drillInfoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  drillInfoName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
  },
  readyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 100,
    minWidth: 200,
    alignItems: 'center',
  },
  readyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.2,
  },
});
