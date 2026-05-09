import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
  Home, Video, BookOpen, BarChart3, Plus,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PlusActionSheet from '@/components/PlusActionSheet';

const GOLD = '#D4AF37';

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const [plusOpen, setPlusOpen] = useState(false);

  const tabs = [
    { name: 'today', label: 'Today', Icon: Home },
    { name: 'film', label: 'Film', Icon: Video },
    { name: 'library', label: 'Library', Icon: BookOpen },
    { name: 'progress', label: 'Progress', Icon: BarChart3 },
  ];

  return (
    <>
      <View style={[styles.barWrap, { paddingBottom: insets.bottom + 10 }]}>
        {/* Pill container — strong frost glass */}
        <View style={styles.pillOuter}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 100 : 120}
            tint="systemUltraThinMaterialLight"
            style={styles.pillBlur}
          >
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
                      color={isFocused ? GOLD : 'rgba(255,255,255,0.55)'}
                      strokeWidth={isFocused ? 2.5 : 2}
                    />
                    <Text style={[
                      styles.tabLabel,
                      { color: isFocused ? GOLD : 'rgba(255,255,255,0.55)' },
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

        {/* Plus button — gold */}
        <TouchableOpacity
          style={styles.plusBtn}
          onPress={() => {
            if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setPlusOpen(true);
          }}
          activeOpacity={0.85}
        >
          <Plus size={28} color="#000000" strokeWidth={2.5} />
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
      <Tabs.Screen name="library" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="more" options={{ href: null }} />
      <Tabs.Screen name="coachx" options={{ href: null }} />
      <Tabs.Screen name="_layout" options={{ href: null }} />
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
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  pillBlur: {
    flex: 1,
    backgroundColor: Platform.OS === 'android' ? 'rgba(30,30,30,0.78)' : 'rgba(40,35,28,0.55)',
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
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
