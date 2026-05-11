// expo/components/CoachXBubble.tsx
// Coach X speech bubble for the home screen.
// Renders the gold silhouette + bubble image with the daily line
// rendered as live text positioned inside the bubble area.

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ImageBackground, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  pickCoachXLineForToday,
  SessionStateInput,
} from '@/lib/coachXSelector';
import { CoachXLine } from '@/lib/coachXLines';

// === Image geometry (measured from the asset) ===
// The source image is 1536 x 1024 (aspect 1.5).
// The bubble's inner gold area spans:
//   x: 50.0% to 96.4%
//   y: 21.8% to 74.1%
// We render the text inside that box, using percent-based positioning
// so it scales with whatever size the container is rendered at.
const IMAGE_ASPECT = 1536 / 1024; // 1.5
const BUBBLE_LEFT_PCT = 50.0;
const BUBBLE_RIGHT_PCT = 96.4;
const BUBBLE_TOP_PCT = 21.8;
const BUBBLE_BOTTOM_PCT = 74.1;

// Inner padding inside the bubble (so text doesn't kiss the gold edges)
const BUBBLE_INNER_PADDING_PCT = 2.5;

// Asset path — update this if you put the image somewhere else
const COACH_X_BUBBLE_IMAGE = require('@/assets/images/coach-x-speech-bubble.png');

type Props = {
  sessionState: SessionStateInput;
  onPress?: () => void;
};

export default function CoachXBubble({ sessionState, onPress }: Props) {
  const [line, setLine] = useState<CoachXLine | null>(null);

  useEffect(() => {
    let cancelled = false;
    pickCoachXLineForToday(sessionState).then(picked => {
      if (!cancelled) setLine(picked);
    });
    return () => { cancelled = true; };
  }, [sessionState.skippedYesterday, sessionState.sessionsLast7Days]);

  const handlePress = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  // Bubble inner area, expressed as percent insets within the image
  const bubbleStyle = {
    position: 'absolute' as const,
    left:   `${BUBBLE_LEFT_PCT  + BUBBLE_INNER_PADDING_PCT}%`,
    right:  `${100 - BUBBLE_RIGHT_PCT + BUBBLE_INNER_PADDING_PCT}%`,
    top:    `${BUBBLE_TOP_PCT   + BUBBLE_INNER_PADDING_PCT}%`,
    bottom: `${100 - BUBBLE_BOTTOM_PCT + BUBBLE_INNER_PADDING_PCT}%`,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={handlePress}
      style={styles.touchable}
    >
      <ImageBackground
        source={COACH_X_BUBBLE_IMAGE}
        resizeMode="contain"
        style={styles.imageBg}
        imageStyle={styles.image}
      >
        {line && (
          <View style={bubbleStyle}>
            <Text
              numberOfLines={3}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              allowFontScaling={false}
              style={[
                styles.bubbleText,
                { fontSize: line.fontSize },
              ]}
            >
              {line.text}
            </Text>
          </View>
        )}
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
    aspectRatio: IMAGE_ASPECT,
  },
  imageBg: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  bubbleText: {
    color: '#000',
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: undefined, // let RN compute based on fontSize
  },
});
