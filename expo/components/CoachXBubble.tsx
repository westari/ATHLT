// expo/components/CoachXBubble.tsx
// Coach X bubble — just the image, capped at a reasonable size.

import React from 'react';
import {
  View, StyleSheet, TouchableOpacity, Image, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const COACH_X_IMAGE = require('@/assets/images/coach-x-bubble.png');

// Image is 1612 x 956 — aspect ratio ~1.69
const IMAGE_ASPECT = 1612 / 956;

// Cap the bubble width so it doesn't dominate the screen.
// '78%' means it takes 78% of the parent width, centered.
const WIDTH_PCT: `${number}%` = '78%';

type Props = {
  onPress?: () => void;
};

export default function CoachXBubble({ onPress }: Props) {
  const handlePress = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <View style={styles.outerWrap}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        style={styles.inner}
      >
        <Image
          source={COACH_X_IMAGE}
          style={styles.image}
          resizeMode="contain"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    width: '100%',
    alignItems: 'center', // centers the capped-width inner
  },
  inner: {
    width: WIDTH_PCT,
    aspectRatio: IMAGE_ASPECT,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
