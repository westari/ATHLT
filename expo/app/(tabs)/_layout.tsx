import { Tabs } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Calendar, MessageCircle, BookOpen, BarChart3, Menu } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';

export default function TabsLayout() {
  const [hideTabBar, setHideTabBar] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const raw = await AsyncStorage.getItem('athlt_plan_store');
        if (raw) {
          const d = JSON.parse(raw);
          if (d.profile) setHideTabBar(false);
        }
      } catch (e) {}
    };
    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: hideTabBar ? { display: 'none' } : {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.surfaceBorder,
            borderTopWidth: 1,
            height: 85,
            paddingTop: 10,
            paddingBottom: 28,
          },
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            letterSpacing: 0.3,
            marginTop: 4,
            fontFamily: 'Inter_600SemiBold',
          },
          tabBarActiveTintColor: Colors.textPrimary,
          tabBarInactiveTintColor: Colors.textMuted,
        }}
      >
        <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: ({ color }) => <Calendar size={20} color={color} /> }} />
        <Tabs.Screen name="coachx" options={{ title: 'Coach X', tabBarIcon: ({ color }) => <MessageCircle size={20} color={color} /> }} />
        <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: ({ color }) => <BookOpen size={20} color={color} /> }} />
        <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: ({ color }) => <BarChart3 size={20} color={color} /> }} />
        <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <Menu size={20} color={color} /> }} />
        <Tabs.Screen name="film" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
