import { Tabs } from 'expo-router';
import React from 'react';
import { Calendar, Film, BookOpen, BarChart3, Menu } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';

export default function TabsLayout() {
  const { profile } = usePlanStore();
  const hideTabBar = !profile;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: hideTabBar ? { display: 'none' } : {
          backgroundColor: '#0F0F0F',
          borderTopColor: Colors.surfaceBorder,
          borderTopWidth: 0.5,
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
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: ({ color }) => <Calendar size={20} color={color} /> }} />
      <Tabs.Screen name="film" options={{ title: 'Film', tabBarIcon: ({ color }) => <Film size={20} color={color} /> }} />
      <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: ({ color }) => <BookOpen size={20} color={color} /> }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: ({ color }) => <BarChart3 size={20} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <Menu size={20} color={color} /> }} />
    </Tabs>
  );
}