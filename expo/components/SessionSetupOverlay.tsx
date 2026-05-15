// expo/components/SessionSetupOverlay.tsx
// Shown only when phone is in PORTRAIT orientation.
// Auto-dismisses when user rotates to landscape — no button, no description.
// Just: rotate animation, "Rotate phone" label, and an exit X.

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Platform,
} from 'react-native';
import Svg, { Rect, Circle, Path } from 'react-native-svg';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

type Props = {
  onExit?: () => void;
};

export default function SessionSetupOverlay({ onExit }: Props) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const phoneRotate = spin.interpolate({
    inputRange:  [0,      0.5,    1],
    outputRange: ['-12deg', '12deg', '-12deg'],
  });
  const arrowOpacity = spin.interpolate({
    inputRange:  [0,   0.5, 1],
    outputRange: [0.5, 1,   0.5],
  });

  const handleExit = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (typeof onExit === 'function') onExit();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.exitBtn}
        onPress={handleExit}
        activeOpacity={0.7}
        hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
      >
        <X size={20} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.animationWrap}>
          <Animated.View style={[styles.arrow, styles.arrowTopRight, { opacity: arrowOpacity }]}>
            <Svg width={50} height={50} viewBox="0 0 50 50">
              <Path
                d="M 8 25 Q 8 8 25 8 L 30 8 M 30 8 L 24 4 M 30 8 L 24 12"
                stroke="#fff"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>

          <Animated.View style={{ transform: [{ rotate: phoneRotate }] }}>
            <Svg width={180} height={100} viewBox="0 0 180 100">
              <Rect
                x="10"
                y="20"
                width="160"
                height="60"
                rx="8"
                fill="none"
                stroke="#fff"
                strokeWidth="2.5"
              />
              <Circle cx="90" cy="14" r="1.5" fill="#fff" />
            </Svg>
          </Animated.View>

          <Animated.View style={[styles.arrow, styles.arrowBottomLeft, { opacity: arrowOpacity }]}>
            <Svg width={50} height={50} viewBox="0 0 50 50">
              <Path
                d="M 42 25 Q 42 42 25 42 L 20 42 M 20 42 L 26 38 M 20 42 L 26 46"
                stroke="#fff"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
        </View>

        <Text style={styles.label}>Rotate phone</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  exitBtn: {
    position: 'absolute',
    top: 30,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  content: {
    alignItems: 'center',
  },
  animationWrap: {
    width: 240,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  arrow: {
    position: 'absolute',
  },
  arrowTopRight: {
    top: 0,
    right: 0,
  },
  arrowBottomLeft: {
    bottom: 0,
    left: 0,
  },
  label: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.4,
  },
});
