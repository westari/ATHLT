// expo/components/CoachXBubble.tsx
// Coach X bubble — just renders the image asset.
// All text is baked into the image. No overlay, no selector, no SVG.

import React from 'react';
import {
  View, StyleSheet, TouchableOpacity, Image, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const COACH_X_IMAGE = require('@/assets/images/coach-x-bubble.png');

// Image is 1638 x 981 — aspect ratio ~1.67
const IMAGE_ASPECT = 1638 / 981;

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
    width: '100%',
    aspectRatio: IMAGE_ASPECT,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
