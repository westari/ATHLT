/**
 * GlassPanel — universal glass-effect container.
 *
 * Render path priority:
 *   1. expo-glass-effect GlassView (iOS 26+, native Liquid Glass)
 *   2. expo-blur BlurView (iOS <26, Android, or if native module not registered)
 *
 * The NativeModules check before rendering GlassView eliminates the console
 * warning "NativeViewManagerAdapter isn't exported by expo-modules-core" that
 * appears when expo-glass-effect is installed but incompatible with the current
 * SDK. We silently fall back to BlurView in that case.
 *
 * Install (after running npm install):
 *   npx expo install expo-glass-effect   ← use this instead of npm install
 *   (picks SDK-compatible version automatically, then EAS rebuild required)
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, NativeModules } from 'react-native';
import { BlurView } from 'expo-blur';

// ---- Module-level guard ----
//
// We check THREE conditions before ever trying to render GlassView:
//   1. The JS module exports GlassView (package is installed)
//   2. The native module is registered in NativeModules (EAS build includes it)
//   3. isLiquidGlassSupported() returns true (iOS 26+)
//
// If any check fails we skip GlassView entirely and use BlurView — no warnings.

let GlassView: React.ComponentType<any> | null = null;
let nativeIsSupported = false;

try {
  const mod = require('expo-glass-effect');

  // Check 1: JS export exists
  if (mod?.GlassView) {
    // Check 2: native module is actually registered (not just installed as JS)
    // The module registers under 'ExpoGlassEffect' or 'GlassView' in NativeModules
    const nativeRegistered =
      !!NativeModules.ExpoGlassEffect ||
      !!NativeModules.GlassView ||
      !!NativeModules.RCTExpoGlassEffect;

    if (nativeRegistered) {
      GlassView = mod.GlassView;
      // Check 3: OS supports Liquid Glass (iOS 26+)
      if (typeof mod.isLiquidGlassSupported === 'function') {
        nativeIsSupported = mod.isLiquidGlassSupported();
      }
    }
    // If not nativeRegistered: silently skip — BlurView will be used, no warning logged
  }
} catch {
  // Package not installed at all — fine, BlurView is the fallback
}

// ---- Props ----

export interface GlassPanelProps {
  /** Blur intensity for BlurView fallback (0–100). GlassView ignores this. Default 50. */
  intensity?: number;
  /** Visual tint. 'systemMaterial' maps to 'light' on BlurView fallback. */
  tint?: 'light' | 'dark' | 'systemMaterial';
  /** Optional color overlay inside the glass (e.g. gold-tinted buttons). */
  tintColor?: string;
  /** Sets borderRadius + overflow:'hidden' together. Always use this instead of style. */
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[] | (ViewStyle | null | undefined)[];
  children?: React.ReactNode;
}

// ---- Component ----

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

  const overlay = tintColor ? (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: tintColor, borderRadius }]}
      pointerEvents="none"
    />
  ) : null;

  // Liquid Glass path
  if (GlassView !== null && nativeIsSupported) {
    return (
      <GlassView tint={tint} style={flatStyle}>
        {overlay}
        {children}
      </GlassView>
    );
  }

  // BlurView fallback
  const blurTint = tint === 'systemMaterial' ? 'light' : tint;

  return (
    <BlurView
      intensity={intensity}
      tint={blurTint}
      experimentalBlurMethod="blur"
      style={flatStyle}
    >
      {overlay}
      {children}
    </BlurView>
  );
}
