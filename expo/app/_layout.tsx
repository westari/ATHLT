import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, LogBox } from 'react-native';
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

// Suppress network error overlays — all failures are caught with console.warn
LogBox.ignoreLogs([
  'Network request failed',
  'TypeError: Network request failed',
  'Error: Network request failed',
]);

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
      {/* translucent lets the warm bone root View show behind the status bar.
           backgroundColor is the Android fallback; on iOS the view hierarchy handles it. */}
      <StatusBar style="light" backgroundColor={Colors.background} translucent />
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
});
