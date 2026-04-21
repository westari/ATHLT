import { Stack } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Image, StatusBar, Platform } from 'react-native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import Colors from '@/constants/colors';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Preload interstitial images at boot so they're cached by the time
// user hits the onboarding interstitials.
const INTERSTITIAL_IMAGES = [
  require('@/assets/images/where-you-play.png'),
  require('@/assets/images/stats-locked.png'),
  require('@/assets/images/shot-mapped.png'),
  require('@/assets/images/scouting-ready.png'),
];

// Apply Inter as the default font for all Text elements
// so we don't have to touch every component.
function applyDefaultFont() {
  // @ts-ignore
  const textRender = Text.render;
  // @ts-ignore
  Text.render = function(...args: any[]) {
    const el = textRender.apply(this, args);
    return React.cloneElement(el, {
      style: [{ fontFamily: 'Inter_500Medium' }, el.props.style],
    });
  };
}

let fontApplied = false;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  useEffect(() => {
    if (fontsLoaded && !fontApplied) {
      applyDefaultFont();
      fontApplied = true;
    }
  }, [fontsLoaded]);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View style={s.container} onLayout={onLayoutRootView}>
      {Platform.OS === 'ios' && <StatusBar barStyle="dark-content" />}
      {Platform.OS === 'android' && <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />}

      {/* Invisible preload — keeps interstitial images in memory */}
      <View style={s.preload} pointerEvents="none">
        {INTERSTITIAL_IMAGES.map((src, i) => (
          <Image key={i} source={src} style={s.preloadImg} />
        ))}
      </View>

      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="session" />
        <Stack.Screen name="drill/[id]" />
      </Stack>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  preload: {
    position: 'absolute',
    top: -100, left: -100,
    width: 1, height: 1,
    opacity: 0,
  },
  preloadImg: { width: 1, height: 1 },
});
