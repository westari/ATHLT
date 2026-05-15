// expo/components/CoachXBubble.tsx
// Coach X bubble — uses an EMPTY bubble image with clean text overlay.
// Text shows the user's total drills completed.
//
// Text rendering quality fixes applied:
//  - allowFontScaling: false (no accessibility blow-up)
//  - fontWeight: '800' (heavy, matches the gold's visual weight)
//  - letterSpacing: -0.4 (tight, modern)
//  - tabular-nums (digits align cleanly)
//  - PixelRatio.roundToNearestPixel (sharp rendering, no sub-pixel blur)

import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Platform, PixelRatio,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';

const COACH_X_IMAGE = require('@/assets/images/coach-x-bubble.png');

// Image aspect ratio — update if you re-crop the asset
const IMAGE_ASPECT = 1605 / 949; // ~1.69

// Bubble inner area as percentages of the image (where text should sit)
// Measured from the prior empty-bubble version:
//   x: 50.0% to 96.4%
//   y: 21.8% to 74.1%
const BUBBLE_LEFT_PCT = 50.0;
const BUBBLE_RIGHT_PCT = 96.4;
const BUBBLE_TOP_PCT = 21.8;
const BUBBLE_BOTTOM_PCT = 74.1;

// Small inner padding so text doesn't kiss the bubble edges
const INNER_PAD_PCT = 3;

// Bubble width on screen — bleed past parent padding to flush left edge
const WIDTH_PCT: `${number}%` = '60%';
const BLEED_LEFT = -16;

// Crisp font size, locked, no system scaling
const FONT_SIZE = PixelRatio.roundToNearestPixel(15);

type Props = {
  onPress?: () => void;
};

export default function CoachXBubble({ onPress }: Props) {
  const { plan, completedDrills } = usePlanStore();

  // Count total drills completed across the entire plan
  const totalDrills = useMemo(() => {
    if (!plan?.days) return 0;
    let count = 0;
    plan.days.forEach((d, dayIdx) => {
      const drills = (d.drills || []).map(x => resolvePlanDrill(x)).filter(Boolean) as NonNullable<ReturnType<typeof resolvePlanDrill>>[];
      drills.forEach((_, drillIdx) => {
        if (completedDrills[dayIdx + '-' + drillIdx]) count += 1;
      });
    });
    return count;
  }, [plan, completedDrills]);

  // Format the stat line
  const statText = useMemo(() => {
    if (totalDrills === 0) return 'Time to get to work.';
    if (totalDrills === 1) return '1 drill in the bank.';
    return `${totalDrills} drills in the bank.`;
  }, [totalDrills]);

  const handlePress = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  // Text overlay box positioned inside the bubble area
  const textOverlayStyle = {
    position: 'absolute' as const,
    left: `${BUBBLE_LEFT_PCT + INNER_PAD_PCT}%`,
    right: `${100 - BUBBLE_RIGHT_PCT + INNER_PAD_PCT}%`,
    top: `${BUBBLE_TOP_PCT + INNER_PAD_PCT}%`,
    bottom: `${100 - BUBBLE_BOTTOM_PCT + INNER_PAD_PCT}%`,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={styles.container}
    >
      <Image
        source={COACH_X_IMAGE}
        style={styles.image}
        resizeMode="contain"
      />

      <View style={textOverlayStyle}>
        <Text
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          allowFontScaling={false}
          style={styles.statText}
        >
          {statText}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: WIDTH_PCT,
    aspectRatio: IMAGE_ASPECT,
    marginLeft: BLEED_LEFT,
    alignSelf: 'flex-start',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  statText: {
    color: '#000',
    fontSize: FONT_SIZE,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    // System default font — looks clean for short stat lines.
    // If you want even more premium, load a custom font (Inter, SF Pro, etc.)
    // via expo-font and set fontFamily here.
  },
});
