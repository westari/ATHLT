import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  RefreshCw, LogOut, Star, Shield, Info, ChevronRight, ClipboardList,
  Dumbbell, BookOpen, Bell, Settings, HelpCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { supabase } from '@/constants/supabase';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { clearAll, profile, currentStreak, totalSessions } = usePlanStore();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [memberSince, setMemberSince] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const checkAuth = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user && mounted) {
          const u = sessionData.session.user;
          setUserEmail(u.email || null);
          setIsLoadingAuth(false);
          if (u.created_at) {
            setMemberSince(new Date(u.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
          }
          return;
        }
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user && mounted) {
          setUserEmail(userData.user.email || null);
          if (userData.user.created_at) {
            setMemberSince(new Date(userData.user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
          }
        }
      } catch (e) {
        console.error('Auth check failed:', e);
      } finally {
        if (mounted) setIsLoadingAuth(false);
      }
    };
    checkAuth();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUserEmail(session?.user?.email ?? null);
      setIsLoadingAuth(false);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useFocusEffect(useCallback(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUserEmail(data.session.user.email || null);
      else supabase.auth.getUser().then(({ data: ud }) => setUserEmail(ud.user?.email || null));
    });
  }, []));

  const tap = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLogout = () => {
    tap();
    if (Platform.OS === 'web') { void doLogout(); return; }
    Alert.alert(
      'Log out',
      'Your data will be saved to your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: doLogout },
      ]
    );
  };

  const doLogout = async () => {
    try { await supabase.auth.signOut(); } catch (e) { console.error('signOut error:', e); }
    clearAll();
    setUserEmail(null);
  };

  const handleReset = () => {
    tap();
    if (Platform.OS === 'web') { clearAll(); return; }
    Alert.alert(
      'Reset Training Profile',
      "This clears your plan and progress but keeps your account active. You'll go through onboarding again.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => clearAll() },
      ]
    );
  };

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'A';
  const displayName = profile?.name || userEmail?.split('@')[0] || 'Athlete';

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Page header */}
        <Text style={s.pageTitle}>Profile</Text>

        {/* Avatar + identity card */}
        <View style={s.identityCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={s.identityInfo}>
            {isLoadingAuth ? (
              <Text style={s.displayName}>Loading...</Text>
            ) : (
              <>
                <Text style={s.displayName}>{displayName}</Text>
                {userEmail ? (
                  <Text style={s.identityEmail}>{userEmail}</Text>
                ) : (
                  <Text style={s.identityEmail}>Not signed in</Text>
                )}
                {memberSince && (
                  <Text style={s.memberSince}>Member since {memberSince}</Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* Stats summary */}
        <View style={s.statsSummary}>
          <View style={s.statSummaryItem}>
            <Text style={s.statSummaryVal}>{currentStreak}</Text>
            <Text style={s.statSummaryLabel}>DAY STREAK</Text>
          </View>
          <View style={s.statSummaryDivider} />
          <View style={s.statSummaryItem}>
            <Text style={s.statSummaryVal}>{totalSessions}</Text>
            <Text style={s.statSummaryLabel}>SESSIONS</Text>
          </View>
          <View style={s.statSummaryDivider} />
          <View style={s.statSummaryItem}>
            <Text style={s.statSummaryVal}>{profile?.position?.split(' ')[0] ?? '—'}</Text>
            <Text style={s.statSummaryLabel}>POSITION</Text>
          </View>
        </View>

        {/* TRAINING group */}
        <Text style={s.groupLabel}>TRAINING</Text>
        <View style={s.group}>
          <MenuItem icon={ClipboardList} label="Game History" sub="Your logged games and stats" onPress={() => { tap(); router.push('/game-history'); }} />
          <Divider />
          <MenuItem icon={Dumbbell} label="Drill Library" sub="Browse all 213 drills" onPress={() => { tap(); router.push('/(tabs)/library'); }} />
        </View>

        {/* APP group */}
        <Text style={s.groupLabel}>APP</Text>
        <View style={s.group}>
          <MenuItem icon={Star}        label="Rate ATHLT"     onPress={tap} />
          <Divider />
          <MenuItem icon={Shield}      label="Privacy Policy" onPress={tap} />
          <Divider />
          <MenuItem icon={Info}        label="About ATHLT"    sub="v1.0.0 — Scaled Studios" onPress={tap} />
        </View>

        {/* ACCOUNT group */}
        <Text style={s.groupLabel}>ACCOUNT</Text>
        <View style={s.group}>
          <MenuItem
            icon={RefreshCw}
            label="Reset Training Profile"
            sub="Clears plan & progress, keeps account"
            labelColor={Colors.danger}
            iconBg="rgba(224,72,72,0.10)"
            iconColor={Colors.danger}
            onPress={handleReset}
          />
          <Divider />
          <MenuItem
            icon={LogOut}
            label="Log out"
            labelColor={Colors.danger}
            iconBg="rgba(224,72,72,0.10)"
            iconColor={Colors.danger}
            onPress={handleLogout}
          />
        </View>

        <Text style={s.footer}>ATHLT v1.0.0 — Scaled Studios</Text>
        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

function MenuItem({
  icon: IconComp,
  label,
  sub,
  labelColor,
  iconBg,
  iconColor,
  onPress,
}: {
  icon: any;
  label: string;
  sub?: string;
  labelColor?: string;
  iconBg?: string;
  iconColor?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={s.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.menuIcon, { backgroundColor: iconBg ?? Colors.inkA8 }]}>
        <IconComp size={18} color={iconColor ?? Colors.textPrimary} />
      </View>
      <View style={s.menuTextWrap}>
        <Text style={[s.menuLabel, labelColor ? { color: labelColor } : null]}>{label}</Text>
        {sub ? <Text style={s.menuSub}>{sub}</Text> : null}
      </View>
      <ChevronRight size={15} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={s.divider} />;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24 },

  pageTitle: {
    fontSize: 28, fontWeight: '300', color: Colors.textPrimary,
    letterSpacing: -0.6, paddingTop: 16, marginBottom: 20,
  },

  identityCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.hairline,
    padding: 18, marginBottom: 12,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: Colors.primary, letterSpacing: -0.3 },
  identityInfo: { flex: 1 },
  displayName: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.3, marginBottom: 2 },
  identityEmail: { fontSize: 13, color: Colors.textMuted },
  memberSince: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  statsSummary: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.hairline,
    paddingVertical: 18, marginBottom: 24,
  },
  statSummaryItem: { flex: 1, alignItems: 'center' },
  statSummaryVal: {
    fontSize: 22, fontWeight: '300', color: Colors.textPrimary,
    letterSpacing: -0.6, fontVariant: ['tabular-nums'],
  },
  statSummaryLabel: {
    fontSize: 10, fontWeight: '500', color: Colors.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 3,
  },
  statSummaryDivider: { width: 1, height: 32, backgroundColor: Colors.hairline },

  groupLabel: {
    fontSize: 11, fontWeight: '500', color: Colors.textMuted,
    letterSpacing: 1.1, textTransform: 'uppercase',
    marginBottom: 10, marginLeft: 4,
  },
  group: {
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.hairline,
    marginBottom: 24, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  menuTextWrap: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary, letterSpacing: -0.2 },
  menuSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.hairline, marginLeft: 66 },

  footer: {
    fontSize: 12, color: Colors.textMuted, textAlign: 'center',
    letterSpacing: 0.3, marginBottom: 10,
  },
});
