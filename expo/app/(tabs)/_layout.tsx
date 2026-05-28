import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
  Home, Video, Clock, User, Plus,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PlusActionSheet from '@/components/PlusActionSheet';
import { usePlanStore } from '@/store/planStore';
import Colors from '@/constants/colors';

const GOLD = Colors.primary;

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const [plusOpen, setPlusOpen] = useState(false);
  const onboardingComplete = usePlanStore(s => s.onboardingComplete);

  if (!onboardingComplete) return null;

  const tabs = [
    { name: 'today', label: 'Home', Icon: Home },
    { name: 'film', label: 'Record', Icon: Video },
    { name: 'progress', label: 'History', Icon: Clock },
    { name: 'more', label: 'Profile', Icon: User },
  ];

  return (
    <>
      <View style={[styles.barWrap, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.pillOuter}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 90}
            tint="dark"
            style={styles.pillBlur}
          >
            <View style={styles.darkOverlay} />
            <View style={styles.pillInner}>
              {tabs.map((tab) => {
                const route = state.routes.find((r: any) => r.name === tab.name);
                if (!route) return null;
                const isFocused = state.routes[state.index]?.name === tab.name;
                const { Icon } = tab;

                const onPress = () => {
                  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                };

                return (
                  <TouchableOpacity
                    key={tab.name}
                    onPress={onPress}
                    activeOpacity={0.7}
                    style={styles.tab}
                  >
                    <Icon
                      size={22}
                      color={isFocused ? GOLD : 'rgba(255,255,255,0.6)'}
                      strokeWidth={isFocused ? 2.2 : 1.8}
                    />
                    <Text style={[
                      styles.tabLabel,
                      { color: isFocused ? GOLD : 'rgba(255,255,255,0.6)' },
                      isFocused && { fontWeight: '700' },
                    ]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </BlurView>
        </View>

        <TouchableOpacity
          style={styles.plusBtn}
          onPress={() => {
            if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setPlusOpen(true);
          }}
          activeOpacity={0.85}
        >
          <Plus size={28} color={Colors.textPrimary} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <PlusActionSheet visible={plusOpen} onClose={() => setPlusOpen(false)} />
    </>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="film" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="more" />
      <Tabs.Screen name="library" options={{ href: null }} />
      <Tabs.Screen name="coachx" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 10,
    backgroundColor: 'transparent',
  },
  pillOuter: {
    flex: 1,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  pillBlur: {
    flex: 1,
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 15, 15, 0.78)',
  },
  pillInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  plusBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
});