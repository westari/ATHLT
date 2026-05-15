// expo/components/CountdownOverlay.tsx
// Big 3-2-1 GO countdown shown at:
//   1. Before the demo video starts
//   2. Before the drill actually starts (after demo ends)
//
// Visual only — no audio per v1 spec.
// Calls onComplete when the countdown finishes.

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing,
} from 'react-native';

type Props = {
  /** Final label shown at the end (e.g. "WATCH" or "GO"). */
  finalLabel: string;
  /** Called once the countdown + final label has finished. */
  onComplete: () => void;
  /** Optional context line above the number (e.g. "Drill 3 of 7"). */
  contextLabel?: string;
};

export default function CountdownOverlay({
  finalLabel,
  onComplete,
  contextLabel,
}: Props) {
  // Sequence: 3 → 2 → 1 → finalLabel → done
  const [step, setStep] = useState<3 | 2 | 1 | 'final' | 'done'>(3);

  // Animated scale + opacity for each number
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step === 'done') {
      onComplete();
      return;
    }

    // Reset and animate in
    scale.setValue(0.6);
    opacity.setValue(0);

    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // After ~850ms hold, advance to next step
    const t = setTimeout(() => {
      // Fade out before advancing
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.4,
          duration: 150,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (step === 3) setStep(2);
        else if (step === 2) setStep(1);
        else if (step === 1) setStep('final');
        else if (step === 'final') setStep('done');
      });
    }, step === 'final' ? 700 : 700);

    return () => clearTimeout(t);
  }, [step, scale, opacity, onComplete]);

  if (step === 'done') return null;

  const displayText = step === 'final' ? finalLabel : String(step);
  const isFinal = step === 'final';

  return (
    <View style={styles.container} pointerEvents="none">
      {contextLabel && (
        <Text style={styles.contextLabel}>{contextLabel}</Text>
      )}
      <Animated.Text
        style={[
          styles.number,
          isFinal && styles.finalText,
          { transform: [{ scale }], opacity },
        ]}
      >
        {displayText}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 900,
  },
  contextLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
    marginBottom: 16,
  },
  number: {
    fontSize: 180,
    fontWeight: '900',
    color: '#D4A017',
    letterSpacing: -6,
    textShadowColor: 'rgba(212, 160, 23, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  finalText: {
    fontSize: 110,
    letterSpacing: 6,
  },
});
