// expo/components/SessionSetupOverlay.tsx
// Minimal "rotate phone" overlay.
// - Shows phone with curved arrows rotating around it
// - Single line of copy: "Rotate phone"
// - Exit button (X) top-right to leave the session
// - "I'm ready" only used at drill 1; portrait warning auto-dismisses on rotate

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Platform,
} from 'react-native';
import Svg, { Rect, Circle, Path } from 'react-native-svg';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

type Props = {
  /** First time of the session — shows "I'm ready" button. */
  isInitialSetup: boolean;
  /** Mid-session portrait warning — no button, auto-dismisses on rotate. */
  isPortraitWarning: boolean;
  /** Called when user taps "I'm ready" (initial setup only). */
  onReady: () => void;
  /** Called when user taps X to exit session. */
  onExit: () => void;
};

export default function SessionSetupOverlay({
  isInitialSetup,
  isPortraitWarning,
  onReady,
  onExit,
}: Props) {
  // Rotation animation — phone + arrows pulse rotation continuously
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

  // Phone rocks from -15° to +15° to suggest rotation
  const phoneRotate = spin.interpolate({
    inputRange:  [0,     0.5,    1],
    outputRange: ['-12deg', '12deg', '-12deg'],
  });
  // Arrows pulse opacity in sync
  const arrowOpacity = spin.interpolate({
    inputRange:  [0,   0.5, 1],
    outputRange: [0.5, 1,   0.5],
  });

  const handleReady = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReady();
  };

  const handleExit = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onExit();
  };

  return (
    <View style={styles.container}>
      {/* Exit button — always available */}
      <TouchableOpacity style={styles.exitBtn} onPress={handleExit} activeOpacity={0.7}>
        <X size={20} color="rgba(255,255,255,0.8)" />
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Animated phone + rotating arrows */}
        <View style={styles.animationWrap}>
          {/* Top-right curved arrow */}
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

          {/* Phone — rocks back and forth */}
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

          {/* Bottom-left curved arrow */}
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

        {/* Copy */}
        <Text style={styles.label}>Rotate phone</Text>
        {isInitialSetup && (
          <Text style={styles.sublabel}>
            Lay it sideways on a flat surface. Step back so your body is in frame.
          </Text>
        )}

        {/* Button — only shown on initial setup */}
        {isInitialSetup && !isPortraitWarning && (
          <TouchableOpacity
            style={styles.readyBtn}
            onPress={handleReady}
            activeOpacity={0.85}
          >
            <Text style={styles.readyBtnText}>I'm ready</Text>
          </TouchableOpacity>
        )}

        {isPortraitWarning && (
          <Text style={styles.autoResumeHint}>
            Session resumes automatically when you rotate back.
          </Text>
        )}
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
    top: 50,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  animationWrap: {
    width: 240,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
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
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  sublabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    maxWidth: 320,
  },
  readyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 100,
    marginTop: 8,
  },
  readyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.2,
  },
  autoResumeHint: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
    marginTop: 8,
  },
});
