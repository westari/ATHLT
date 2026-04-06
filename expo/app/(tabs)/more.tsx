import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, RefreshCw, LogOut, Star, Shield, Info, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { supabase } from '@/constants/supabase';

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { profile, plan, currentStreak, totalSessions, clearAll } = usePlanStore();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserEmail(data.user.email || null);
    });
  }, []);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      supabase.auth.signOut();
      clearAll();
      return;
    }
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            clearAll();
          },
        },
      ]
    );
  };

  const handleResetOnboarding = () => {
    if (Platform.OS === 'web') { clearAll(); return; }
    Alert.alert(
      'Reset Training Profile',
      'This will delete your current plan, profile, and all progress. You\'ll go through onboarding again. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset Everything', style: 'destructive', onPress: () => { clearAll(); } },
      ]
    );
  };

  const STYLE_MAP: Record<string, string> = {
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

        {/* Account card */}
        <View style={s.accountCard}>
          <View style={s.accountIcon}>
            <User size={24} color={Colors.primary} />
          </View>
          <View style={s.accountInfo}>
            {userEmail ? (
              <>
                <Text style={s.accountEmail}>{userEmail}</Text>
                <Text style={s.accountType}>ATHLT Account</Text>
              </>
            ) : (
              <>
                <Text style={s.accountEmail}>Guest</Text>
                <Text style={s.accountType}>No account — progress saved locally only</Text>
              </>
            )}
          </View>
        </View>

        {/* Player card */}
        {profile && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>PLAYER PROFILE</Text>
            <View style={s.playerHeader}>
              <View>
                <Text style={s.playerPosition}>{profile.position}</Text>
                <Text style={s.playerExp}>{profile.experience} experience</Text>
              </View>
              <View style={s.playerStats}>
                <View style={s.playerStat}>
                  <Text style={s.playerStatVal}>{totalSessions}</Text>
                  <Text style={s.playerStatLbl}>Sessions</Text>
                </View>
                <View style={s.playerStat}>
                  <Text style={s.playerStatVal}>{currentStreak}</Text>
                  <Text style={s.playerStatLbl}>Streak</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Play style */}
        {profile && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>YOUR PLAY STYLE</Text>
            {[
              { l: 'Goal', v: profile.goal },
              { l: 'Weakness', v: profile.weakness, red: true },
              { l: 'Driving', v: STYLE_MAP[profile.driving || ''] || profile.driving },
              { l: 'Left hand', v: STYLE_MAP[profile.leftHand || ''] || profile.leftHand },
              { l: 'Under pressure', v: STYLE_MAP[profile.pressure || ''] || profile.pressure },
              { l: 'Go-to move', v: profile.goToMove },
              { l: 'Three-point', v: STYLE_MAP[profile.threeConfidence || ''] || profile.threeConfidence },
              { l: 'Free throw', v: profile.freeThrow },
            ].filter(x => x.v).map((x, i) => (
              <View key={i} style={s.row}>
                <Text style={s.rowLabel}>{x.l}</Text>
                <Text style={[s.rowValue, x.red && { color: '#C47A6C' }]}>{x.v}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Schedule */}
        {profile && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>TRAINING SCHEDULE</Text>
            <View style={s.row}><Text style={s.rowLabel}>Frequency</Text><Text style={s.rowValue}>{profile.frequency}</Text></View>
            <View style={s.row}><Text style={s.rowLabel}>Session length</Text><Text style={s.rowValue}>{profile.duration}</Text></View>
            <View style={s.row}><Text style={s.rowLabel}>Facilities</Text><Text style={s.rowValue}>{Array.isArray(profile.access) ? profile.access.join(', ') : profile.access}</Text></View>
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

        {/* Menu */}
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
        <TouchableOpacity style={s.resetBtn} onPress={handleResetOnboarding} activeOpacity={0.7}>
          <RefreshCw size={18} color="#C47A6C" />
          <Text style={s.resetTxt}>Reset Training Profile</Text>
        </TouchableOpacity>

        {/* Logout */}
        {userEmail && (
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <LogOut size={18} color="#C47A6C" />
            <Text style={s.logoutTxt}>Log out</Text>
          </TouchableOpacity>
        )}

        <Text style={s.version}>ATHLT v1.0.0 — Scaled Studios</Text>
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, paddingTop: 16, marginBottom: 20 },
  accountCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 18, marginBottom: 14,
  },
  accountIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#1A1708',
    borderWidth: 2, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  accountInfo: { flex: 1 },
  accountEmail: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  accountType: { fontSize: 12, color: Colors.textMuted },
  section: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 20, marginBottom: 14,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 14 },
  playerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  playerPosition: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 2 },
  playerExp: { fontSize: 13, color: Colors.textMuted },
  playerStats: { flexDirection: 'row', gap: 20 },
  playerStat: { alignItems: 'center' },
  playerStatVal: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 2 },
  playerStatLbl: { fontSize: 10, color: Colors.textMuted },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#222',
  },
  rowLabel: { fontSize: 13, color: Colors.textMuted },
  rowValue: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right', flex: 1, marginLeft: 16 },
  planTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  planInsight: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  menu: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder,
    marginBottom: 14, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#222',
  },
  menuItemText: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary, flex: 1 },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: 14, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: '#3A2020', marginBottom: 10,
  },
  resetTxt: { fontSize: 14, fontWeight: '600', color: '#C47A6C' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: 14, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: '#3A2020', marginBottom: 20,
  },
  logoutTxt: { fontSize: 14, fontWeight: '600', color: '#C47A6C' },
  version: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginBottom: 10 },
});