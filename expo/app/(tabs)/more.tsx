import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, RefreshCw, MessageCircle, Info, ChevronRight, LogOut, Star, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { profile, plan, currentStreak, totalSessions, clearAll } = usePlanStore();

  const handleResetOnboarding = () => {
    if (Platform.OS === 'web') {
      clearAll();
      return;
    }
    Alert.alert(
      'Reset Training Profile',
      'This will delete your current plan, profile, and all progress. You\'ll go through onboarding again. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: () => {
            if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            clearAll();
          },
        },
      ]
    );
  };

  const PLAY_STYLE_MAP: Record<string, string> = {
    'I usually score': 'Strong finisher',
    'I get blocked or altered': 'Needs finishing work',
    'I pass it out': 'Pass-first tendency',
    'I lose the ball': 'Ball security needed',
    'I don\'t really drive': 'Perimeter player',
    'Strong — I finish with both hands': 'Ambidextrous',
    'Getting there — I use it sometimes': 'Developing',
    'Weak — I avoid it': 'Right-hand dominant',
    'I only use my right hand': 'One-handed',
    'I can still create my shot': 'Shot creator',
    'I struggle but fight through': 'Developing handle',
    'I usually pass it away': 'Pass-first under pressure',
    'I turn it over': 'Needs ball security',
    'Very — I\'m a shooter': 'Confident shooter',
    'Somewhat — I\'ll take open ones': 'Selective shooter',
    'Not really — I prefer mid-range': 'Mid-range focused',
    'I don\'t shoot them': 'Non-shooter',
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.headerTitle}>More</Text>

        {/* Player card */}
        {profile && (
          <View style={s.playerCard}>
            <View style={s.playerHeader}>
              <View style={s.avatarWrap}>
                <Image source={require('@/assets/images/coach-x.png')} style={s.avatar} resizeMode="cover" />
              </View>
              <View style={s.playerInfo}>
                <Text style={s.playerPosition}>{profile.position}</Text>
                <Text style={s.playerExperience}>{profile.experience} experience</Text>
              </View>
            </View>

            <View style={s.playerStats}>
              <View style={s.playerStat}>
                <Text style={s.playerStatValue}>{totalSessions}</Text>
                <Text style={s.playerStatLabel}>Sessions</Text>
              </View>
              <View style={s.playerStatDiv} />
              <View style={s.playerStat}>
                <Text style={s.playerStatValue}>{currentStreak}</Text>
                <Text style={s.playerStatLabel}>Streak</Text>
              </View>
              <View style={s.playerStatDiv} />
              <View style={s.playerStat}>
                <Text style={s.playerStatValue}>W1</Text>
                <Text style={s.playerStatLabel}>Week</Text>
              </View>
            </View>
          </View>
        )}

        {/* Play style breakdown */}
        {profile && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>YOUR PLAY STYLE</Text>

            <View style={s.styleRow}>
              <Text style={s.styleLabel}>Goal</Text>
              <Text style={s.styleValue}>{profile.goal}</Text>
            </View>
            <View style={s.styleRow}>
              <Text style={s.styleLabel}>Weakness</Text>
              <Text style={[s.styleValue, { color: '#C47A6C' }]}>{profile.weakness}</Text>
            </View>
            {profile.driving && (
              <View style={s.styleRow}>
                <Text style={s.styleLabel}>Driving</Text>
                <Text style={s.styleValue}>{PLAY_STYLE_MAP[profile.driving] || profile.driving}</Text>
              </View>
            )}
            {profile.leftHand && (
              <View style={s.styleRow}>
                <Text style={s.styleLabel}>Left hand</Text>
                <Text style={s.styleValue}>{PLAY_STYLE_MAP[profile.leftHand] || profile.leftHand}</Text>
              </View>
            )}
            {profile.pressure && (
              <View style={s.styleRow}>
                <Text style={s.styleLabel}>Under pressure</Text>
                <Text style={s.styleValue}>{PLAY_STYLE_MAP[profile.pressure] || profile.pressure}</Text>
              </View>
            )}
            {profile.goToMove && (
              <View style={s.styleRow}>
                <Text style={s.styleLabel}>Go-to move</Text>
                <Text style={s.styleValue}>{profile.goToMove}</Text>
              </View>
            )}
            {profile.threeConfidence && (
              <View style={s.styleRow}>
                <Text style={s.styleLabel}>Three-point</Text>
                <Text style={s.styleValue}>{PLAY_STYLE_MAP[profile.threeConfidence] || profile.threeConfidence}</Text>
              </View>
            )}
            {profile.freeThrow && (
              <View style={s.styleRow}>
                <Text style={s.styleLabel}>Free throw</Text>
                <Text style={s.styleValue}>{profile.freeThrow}</Text>
              </View>
            )}
          </View>
        )}

        {/* Schedule */}
        {profile && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>TRAINING SCHEDULE</Text>
            <View style={s.styleRow}>
              <Text style={s.styleLabel}>Frequency</Text>
              <Text style={s.styleValue}>{profile.frequency}</Text>
            </View>
            <View style={s.styleRow}>
              <Text style={s.styleLabel}>Session length</Text>
              <Text style={s.styleValue}>{profile.duration}</Text>
            </View>
            <View style={s.styleRow}>
              <Text style={s.styleLabel}>Facilities</Text>
              <Text style={s.styleValue}>{Array.isArray(profile.access) ? profile.access.join(', ') : profile.access}</Text>
            </View>
          </View>
        )}

        {/* Current plan */}
        {plan && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>CURRENT PLAN</Text>
            <Text style={s.planTitle}>{plan.weekTitle}</Text>
            {plan.aiInsight && <Text style={s.planInsight}>{plan.aiInsight}</Text>}
          </View>
        )}

        {/* Menu items */}
        <View style={s.menu}>
          <TouchableOpacity style={s.menuItem} activeOpacity={0.7}>
            <Star size={20} color={Colors.primary} />
            <Text style={s.menuItemText}>Rate ATHLT</Text>
            <ChevronRight size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={s.menuItem} activeOpacity={0.7}>
            <Shield size={20} color={Colors.textSecondary} />
            <Text style={s.menuItemText}>Privacy Policy</Text>
            <ChevronRight size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity style={s.menuItem} activeOpacity={0.7}>
            <Info size={20} color={Colors.textSecondary} />
            <Text style={s.menuItemText}>About ATHLT</Text>
            <ChevronRight size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Reset */}
        <TouchableOpacity style={s.resetButton} onPress={handleResetOnboarding} activeOpacity={0.7}>
          <RefreshCw size={18} color="#C47A6C" />
          <Text style={s.resetText}>Reset Training Profile</Text>
        </TouchableOpacity>

        <Text style={s.version}>ATHLT v1.0.0</Text>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, paddingTop: 16, marginBottom: 20 },
  // Player card
  playerCard: {
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 20, marginBottom: 16,
  },
  playerHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  avatarWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A1708',
    borderWidth: 2, borderColor: Colors.primary, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  playerInfo: { flex: 1 },
  playerPosition: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 2 },
  playerExperience: { fontSize: 13, color: Colors.textMuted },
  playerStats: { flexDirection: 'row', alignItems: 'center' },
  playerStat: { flex: 1, alignItems: 'center' },
  playerStatValue: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  playerStatLabel: { fontSize: 11, color: Colors.textMuted },
  playerStatDiv: { width: 1, height: 30, backgroundColor: Colors.surfaceBorder },
  // Sections
  section: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 20, marginBottom: 14,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 14 },
  styleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#222',
  },
  styleLabel: { fontSize: 13, color: Colors.textMuted },
  styleValue: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right', flex: 1, marginLeft: 16 },
  planTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  planInsight: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  // Menu
  menu: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder, marginBottom: 14, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  menuItemText: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary, flex: 1 },
  // Reset
  resetButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: 14,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#3A2020',
    marginBottom: 20,
  },
  resetText: { fontSize: 14, fontWeight: '600', color: '#C47A6C' },
  version: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginBottom: 10 },
});