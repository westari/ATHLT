/**
 * GlassPanel — frosted glass container backed by expo-blur.
 *
 * expo-glass-effect was removed (version 56.0.4 was incompatible with
 * expo-modules-core 3.x / SDK 54 and caused console warnings even before
 * render because NativeViewManagerAdapter isn't exported in this SDK).
 *
 * BlurView from expo-blur (already in the SDK) provides a perfectly good
 * frosted glass effect on iOS and falls back to a semi-transparent View
 * on Android.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

export interface GlassPanelProps {
  /** Blur intensity (0–100). Default 50. */
  intensity?: number;
  /** Visual tint. 'systemMaterial' maps to 'light'. */
  tint?: 'light' | 'dark' | 'systemMaterial';
  /** Optional color overlay (e.g. gold-tinted buttons). */
  tintColor?: string;
  /** Sets borderRadius + overflow:'hidden' together. */
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
  const shapeStyle: ViewStyle = borderRadius != null
    ? { borderRadius, overflow: 'hidden' }
    : {};

  const flatStyle = [shapeStyle, ...(Array.isArray(style) ? style : style ? [style] : [])];

  const blurTint = tint === 'systemMaterial' ? 'light' : tint;

  return (
    <BlurView intensity={intensity} tint={blurTint} style={flatStyle}>
      {tintColor ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: tintColor, borderRadius }]}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </BlurView>
  );
}
