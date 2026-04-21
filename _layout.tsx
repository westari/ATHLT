import { Stack } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

// Apply Inter as the default font for all Text and TextInput elements
// so we don't have to touch every component.
function applyDefaultFont() {
  // @ts-ignore - defaultProps exists at runtime
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
      <Stack screenOptions={{ headerShown: false }}>
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
