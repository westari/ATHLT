/**
 * GlassPanel — universal glass-effect container.
 *
 * On iOS 26+ uses expo-glass-effect's GlassView (Apple Liquid Glass).
 * On older iOS and Android falls back to expo-blur's BlurView.
 *
 * Install:
 *   npm install expo-glass-effect --legacy-peer-deps --save
 *   (then EAS rebuild — native code required)
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

// Guard import — expo-glass-effect may not be installed yet
let GlassView: React.ComponentType<any> | null = null;
let nativeIsSupported = false;

try {
  const mod = require('expo-glass-effect');
  GlassView = mod.GlassView ?? null;
  // isLiquidGlassSupported is a function that checks the OS version at runtime
  if (typeof mod.isLiquidGlassSupported === 'function') {
    nativeIsSupported = mod.isLiquidGlassSupported();
  }
} catch {
  // expo-glass-effect not installed — BlurView fallback will be used
}

export interface GlassPanelProps {
  /** Blur intensity passed to BlurView fallback (0–100). Default 50. */
  intensity?: number;
  /** Visual tint. 'systemMaterial' maps to 'light' on the BlurView fallback. */
  tint?: 'light' | 'dark' | 'systemMaterial';
  /** Optional color overlay rendered on top of the blur/glass layer. */
  tintColor?: string;
  /** Shorthand for borderRadius — also sets overflow: 'hidden' automatically. */
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[] | (ViewStyle | null | undefined)[];
  children?: React.ReactNode;
}

export default function GlassPanel({
  intensity = 50,
  tint = 'dark',
  tintColor,
  borderRadius,
  style,
  children,
}: GlassPanelProps) {
  const overflowStyle: ViewStyle = borderRadius != null
    ? { borderRadius, overflow: 'hidden' }
    : {};

  // Flatten style array for consistent handling
  const flatStyle = [overflowStyle, style].filter(Boolean);

  // Color overlay (used for gold-tinted glass buttons etc.)
  const overlay = tintColor ? (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: tintColor, borderRadius },
      ]}
      pointerEvents="none"
    />
  ) : null;

  // ---- Liquid Glass path (iOS 26+) ----
  if (GlassView !== null && nativeIsSupported) {
    return (
      <GlassView tint={tint} style={flatStyle}>
        {overlay}
        {children}
      </GlassView>
    );
  }

  // ---- BlurView fallback (iOS <26, Android) ----
  const blurTint = tint === 'systemMaterial' ? 'light' : tint;

  return (
    <BlurView
      intensity={intensity}
      tint={blurTint}
      // experimentalBlurMethod only applies on Android; harmless on iOS
      experimentalBlurMethod="blur"
      style={flatStyle}
    >
      {overlay}
      {children}
    </BlurView>
  );
}
