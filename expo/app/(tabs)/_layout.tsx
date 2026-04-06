import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { Calendar, Film, BookOpen, BarChart3, Menu } from 'lucide-react-native';
import Colors from '@/constants/colors';
import CoachX from '@/components/CoachX';
import { Asset } from 'expo-asset';

export default function TabsLayout() {
React.useEffect(() => {
    Asset.loadAsync(require('@/assets/images/coach-x-small.png'));
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
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
      <CoachX />
    </View>
  );
}