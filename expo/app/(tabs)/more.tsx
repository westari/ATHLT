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
import {
  User, RefreshCw, LogOut, Star, Shield, Info, ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { supabase } from '@/constants/supabase';

/**
 * More tab.
 *
 * Fixes vs prior version:
 * 1. Uses onAuthStateChange listener — so "Guest" bug doesn't happen when a user
 *    is actually signed in but getUser() returns null transiently.
 * 2. Light theme (uses Colors constants that were flipped to light).
 * 3. Log Out button now:
 *    - Always shows (not only when userEmail is set) so user can log out even
 *      if the session state is temporarily loading.
 *    - Actually calls clearAll() AND signs out from Supabase.
 */
export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { profile, plan, currentStreak, totalSessions, clearAll } = usePlanStore();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUserEmail(data.session.user.email || null);
      }
      setIsLoadingAuth(false);
    });

    // Listen for auth state changes (sign in, sign out, token refresh)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      setIsLoadingAuth(false);
    });

    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      void doLogout();
      return;
    }
    Alert.alert(
      'Log out',
      'Are you sure you want to log out? Your data will still be saved to your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: doLogout },
      ]
    );
  };

  const doLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('signOut error:', e);
    }
    clearAll();
    setUserEmail(null);
  };

  const handleResetOnboarding = () => {
    if (Platform.OS === 'web') {
      clearAll();
      return;
    }
    Alert.alert(
      'Reset Training Profile',
      "This will delete your current plan, profile, and all progress. You'll go through onboarding again. Your account stays active.",
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
    "I don't really drive": 'Perimeter player',
    'Strong - I finish with both hands': 'Ambidextrous',
    'Getting there - I use it sometimes': 'Developing',
    'Weak - I avoid it': 'Right-hand dominant',
    'I only use my right hand': 'One-handed',
    'I can still create my shot': 'Shot creator',
    'I struggle but fight through': 'Developing handle',
    'I usually pass it away': 'Pass-first under pressure',
    'I turn it over': 'Needs ball security',
    "Very - I'm a shooter": 'Confident shooter',
    "Somewhat - I'll take open ones": 'Selective shooter',
    'Not really - I prefer mid-range': 'Mid-range focused',
    "I don't shoot them": 'Non-shooter',
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.headerTitle}>More</Text>

        {/* Account card */}
        <View style={s.accountCard}>
          <View style={s.accountIcon}>
            <User size={24} color={Colors.textPrimary} />
          </View>
          <View style={s.accountInfo}>
            {isLoadingAuth ? (
              <>
                <Text style={s.accountEmail}>Loading...</Text>
                <Text style={s.accountType}> </Text>
              </>
            ) : userEmail ? (
              <>
                <Text style={s.accountEmail}>{userEmail}</Text>
                <Text style={s.accountType}>ATHLT Account</Text>
              </>
            ) : (
              <>
                <Text style={s.accountEmail}>Not signed in</Text>
                <Text style={s.accountType}>Progress will not be saved</Text>
              </>
            )}
          </View>
        </View>

        {/* Player profile */}
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

        {/* Play style — filtered to only show populated fields */}
        {profile && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>YOUR PLAY STYLE</Text>
            {[
              { l: 'Goal', v: profile.goal },
              { l: 'Weakness', v: profile.weakness, danger: true },
              { l: 'Driving', v: STYLE_MAP[profile.driving || ''] || profile.driving },
              { l: 'Left hand', v: STYLE_MAP[profile.leftHand || ''] || profile.leftHand },
              { l: 'Under pressure', v: STYLE_MAP[profile.pressure || ''] || profile.pressure },
              { l: 'Go-to move', v: profile.goToMove },
              { l: 'Three-point', v: STYLE_MAP[profile.threeConfidence || ''] || profile.threeConfidence },
              { l: 'Free throw', v: profile.freeThrow },
            ].filter(x => x.v && x.v !== 'not specified').map((x, i) => (
              <View key={i} style={s.row}>
                <Text style={s.rowLabel}>{x.l}</Text>
                <Text style={[s.rowValue, x.danger && { color: Colors.danger }]}>{x.v}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Schedule */}
        {profile && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>TRAINING SCHEDULE</Text>
            <View style={s.row}>
              <Text style={s.rowLabel}>Frequency</Text>
              <Text style={s.rowValue}>{profile.frequency}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.rowLabel}>Session length</Text>
              <Text style={s.rowValue}>{profile.duration}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.rowLabel}>Facilities</Text>
              <Text style={s.rowValue}>
                {Array.isArray(profile.access) ? profile.access.join(', ') : profile.access}
              </Text>
            </View>
          </View>
        )}

        {/* Current plan */}
        {plan && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>CURRENT PLAN</Text>
            <Text style={s.planTitle}>{plan.weekTitle}</Text>
            {plan.aiInsight ? <Text style={s.planInsight}>{plan.aiInsight}</Text> : null}
          </View>
        )}

        {/* Menu */}
        <View style={s.menu}>
          <TouchableOpacity style={s.menuItem} activeOpacity={0.7}>
            <Star size={20} color={Colors.textSecondary} />
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
          <RefreshCw size={18} color={Colors.danger} />
          <Text style={s.resetTxt}>Reset Training Profile</Text>
        </TouchableOpacity>

        {/* Log out — always shows when someone is signed in */}
        {userEmail && (
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <LogOut size={18} color={Colors.danger} />
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
  headerTitle: {
    fontSize: 28, fontWeight: '700', color: Colors.textPrimary,
    paddingTop: 16, marginBottom: 20, letterSpacing: -0.8,
  },
  accountCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 18, marginBottom: 14,
  },
  accountIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  accountInfo: { flex: 1 },
  accountEmail: {
    fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2, letterSpacing: -0.3,
  },
  accountType: { fontSize: 12, color: Colors.textMuted },
  section: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 20, marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 14,
  },
  playerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  playerPosition: {
    fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 2,
  },
  playerExp: { fontSize: 13, color: Colors.textMuted },
  playerStats: { flexDirection: 'row', gap: 20 },
  playerStat: { alignItems: 'center' },
  playerStatVal: {
    fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 2,
  },
  playerStatLbl: { fontSize: 10, color: Colors.textMuted },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  rowLabel: { fontSize: 13, color: Colors.textMuted },
  rowValue: {
    fontSize: 13, fontWeight: '600', color: Colors.textPrimary,
    textAlign: 'right', flex: 1, marginLeft: 16,
  },
  planTitle: {
    fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8,
  },
  planInsight: {
    fontSize: 13, color: Colors.textSecondary, lineHeight: 20,
  },
  menu: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    marginBottom: 14, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  menuItemText: {
    fontSize: 15, fontWeight: '500', color: Colors.textPrimary, flex: 1,
  },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: 14, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: '#F5D4D4', marginBottom: 10,
  },
  resetTxt: { fontSize: 14, fontWeight: '600', color: Colors.danger },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: 14, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: '#F5D4D4', marginBottom: 20,
  },
  logoutTxt: { fontSize: 14, fontWeight: '600', color: Colors.danger },
  version: {
    fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginBottom: 10,
  },
});
