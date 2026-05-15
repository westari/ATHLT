// expo/components/CoachXBubble.tsx
// Coach X bubble — flush left, comes from the LEFT edge of the screen.
// The image content already has Coach X cropped at his left side,
// so we let the image extend past the home screen's left padding so it
// reads as "coming out of the screen edge."

import React from 'react';
import {
  View, StyleSheet, TouchableOpacity, Image, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const COACH_X_IMAGE = require('@/assets/images/coach-x-bubble.png');

// Image is ~1605 x 949 — aspect ratio ~1.69
const IMAGE_ASPECT = 1605 / 949;

// How much of the parent width the bubble should take.
// Smaller number = smaller bubble. Tune freely.
const WIDTH_PCT: `${number}%` = '60%';

// Negative left margin makes the image bleed past the parent's left padding,
// so it reads as flush against the screen edge (Coach X coming from the side).
// The parent (TodayHome) uses paddingHorizontal: 16, so -16 pulls it back to 0.
const BLEED_LEFT = -16;

type Props = {
  onPress?: () => void;
};

export default function CoachXBubble({ onPress }: Props) {
  const handlePress = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: WIDTH_PCT,
    aspectRatio: IMAGE_ASPECT,
    marginLeft: BLEED_LEFT, // bleed to true screen edge
    alignSelf: 'flex-start',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
