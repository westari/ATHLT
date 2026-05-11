// expo/components/CoachXBubble.tsx
// Coach X speech bubble — pure code, no PNG asset.
// Small, compact, sits under the day strip on the home screen.

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import {
  pickCoachXLineForToday,
  SessionStateInput,
} from '@/lib/coachXSelector';
import { CoachXLine } from '@/lib/coachXLines';

const GOLD = Colors.primary; // #D4A017

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

  if (!line) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={styles.container}
    >
      {/* Coach X silhouette — small SVG of head + shoulder + pointing arm */}
      <View style={styles.coachWrap}>
        <Svg width={56} height={64} viewBox="0 0 56 64">
          {/* Head */}
          <Circle cx="30" cy="14" r="10" fill={GOLD} />
          {/* Neck */}
          <Path d="M 26 22 L 26 28 L 34 28 L 34 22 Z" fill={GOLD} />
          {/* Body / shoulder cropped at right edge */}
          <Path
            d="M 18 28
               Q 18 24 24 24
               L 56 24
               L 56 64
               L 18 64
               Z"
            fill={GOLD}
          />
          {/* Pointing arm coming forward */}
          <Path
            d="M 20 34
               Q 8 38 6 48
               Q 4 56 14 56
               Q 22 56 26 50
               Q 30 44 28 38
               Z"
            fill={GOLD}
          />
          {/* Fist / finger detail (subtle) */}
          <Circle cx="9" cy="50" r="5" fill={GOLD} />
        </Svg>
      </View>

      {/* Speech bubble */}
      <View style={styles.bubbleWrap}>
        {/* Tail (triangle pointing left toward coach) */}
        <Svg
          width={8}
          height={14}
          viewBox="0 0 8 14"
          style={styles.tail}
        >
          <Path d="M 8 0 L 0 7 L 8 14 Z" fill={GOLD} />
        </Svg>

        <View style={styles.bubble}>
          <Text
            numberOfLines={3}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            allowFontScaling={false}
            style={styles.bubbleText}
          >
            {line.text}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  coachWrap: {
    width: 56,
    height: 64,
    overflow: 'hidden',
    marginRight: 2,
  },
  bubbleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tail: {
    marginRight: -1,
  },
  bubble: {
    flex: 1,
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 52,
    justifyContent: 'center',
  },
  bubbleText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
});
