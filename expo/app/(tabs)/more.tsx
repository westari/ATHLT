// expo/app/(tabs)/more.tsx
// More tab — fully redesigned.
//
// REMOVED (was onboarding-echo junk that just re-displayed answers):
//   - PLAYER PROFILE block
//   - YOUR PLAY STYLE block (+ the big STYLE_MAP)
//   - TRAINING SCHEDULE block
//   - CURRENT PLAN block
//
// NEW structure — clean grouped "folders":
//   - Account card (email / status)
//   - YOUR GAME    → Game History
//   - APP          → Rate, Privacy, About
//   - ACCOUNT      → Reset Training Profile, Log out (danger styled)
//
// Auth logic preserved exactly from the working version.

import React, { useState, useEffect, useCallback } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';
import {
  User, RefreshCw, LogOut, Star, Shield, Info,
  ChevronRight, ClipboardList,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { supabase } from '@/constants/supabase';

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { clearAll } = usePlanStore();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user && mounted) {
          setUserEmail(sessionData.session.user.email || null);
          setIsLoadingAuth(false);
          return;
        }
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user && mounted) {
          setUserEmail(userData.user.email || null);
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

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          setUserEmail(data.session.user.email || null);
        } else {
          supabase.auth.getUser().then(({ data: userData }) => {
            setUserEmail(userData.user?.email || null);
          });
        }
      });
    }, [])
  );

  const tap = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLogout = () => {
    tap();
    if (Platform.OS === 'web') { void doLogout(); return; }
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
    tap();
    if (Platform.OS === 'web') { clearAll(); return; }
    Alert.alert(
      'Reset Training Profile',
      "This will delete your current plan, profile, and all progress. You'll go through onboarding again. Your account stays active.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset Everything', style: 'destructive', onPress: () => { clearAll(); } },
      ]
    );
  };

  const goGameHistory = () => {
    tap();
    router.push('/game-history');
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.headerTitle}>More</Text>

        {/* Account card */}
        <View style={s.accountCard}>
          <View style={s.accountIcon}>
            {userEmail ? (
              <Text style={s.accountInitials}>
                {userEmail.slice(0, 2).toUpperCase()}
              </Text>
            ) : (
              <User size={22} color={Colors.primary} />
            )}
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
                <Text style={s.accountType}>ATHLT Member</Text>
              </>
            ) : (
              <>
                <Text style={s.accountEmail}>Not signed in</Text>
                <Text style={s.accountType}>Progress will not be saved</Text>
              </>
            )}
          </View>
        </View>

        {/* YOUR GAME */}
        <Text style={s.groupLabel}>YOUR GAME</Text>
        <View style={s.group}>
          <TouchableOpacity style={s.groupItem} onPress={goGameHistory} activeOpacity={0.7}>
            <View style={s.itemIcon}>
              <ClipboardList size={18} color={Colors.textPrimary} />
            </View>
            <View style={s.itemTextWrap}>
              <Text style={s.itemTitle}>Game History</Text>
              <Text style={s.itemSub}>Your logged games and stats</Text>
            </View>
            <ChevronRight size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* APP */}
        <Text style={s.groupLabel}>APP</Text>
        <View style={s.group}>
          <TouchableOpacity style={s.groupItem} onPress={tap} activeOpacity={0.7}>
            <View style={s.itemIcon}>
              <Star size={18} color={Colors.textPrimary} />
            </View>
            <Text style={s.itemTitleFlat}>Rate ATHLT</Text>
            <ChevronRight size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={s.divider} />

          <TouchableOpacity style={s.groupItem} onPress={tap} activeOpacity={0.7}>
            <View style={s.itemIcon}>
              <Shield size={18} color={Colors.textPrimary} />
            </View>
            <Text style={s.itemTitleFlat}>Privacy Policy</Text>
            <ChevronRight size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          <View style={s.divider} />

          <TouchableOpacity style={s.groupItem} onPress={tap} activeOpacity={0.7}>
            <View style={s.itemIcon}>
              <Info size={18} color={Colors.textPrimary} />
            </View>
            <Text style={s.itemTitleFlat}>About ATHLT</Text>
            <ChevronRight size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ACCOUNT (danger zone) */}
        <Text style={s.groupLabel}>ACCOUNT</Text>
        <View style={s.group}>
          <TouchableOpacity style={s.groupItem} onPress={handleResetOnboarding} activeOpacity={0.7}>
            <View style={[s.itemIcon, s.itemIconDanger]}>
              <RefreshCw size={18} color={Colors.danger} />
            </View>
            <View style={s.itemTextWrap}>
              <Text style={[s.itemTitle, { color: Colors.danger }]}>Reset Training Profile</Text>
              <Text style={s.itemSub}>Clears plan & progress, keeps account</Text>
            </View>
          </TouchableOpacity>

          <View style={s.divider} />

          <TouchableOpacity style={s.groupItem} onPress={handleLogout} activeOpacity={0.7}>
            <View style={[s.itemIcon, s.itemIconDanger]}>
              <LogOut size={18} color={Colors.danger} />
            </View>
            <Text style={[s.itemTitleFlat, { color: Colors.danger }]}>Log out</Text>
          </TouchableOpacity>
        </View>

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
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.hairline,
    padding: 18, marginBottom: 24,
  },
  accountIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  accountInitials: {
    fontSize: 18, fontWeight: '700', color: Colors.primary, letterSpacing: -0.3,
  },
  accountInfo: { flex: 1 },
  accountEmail: {
    fontSize: 15, fontWeight: '600', color: Colors.textPrimary,
    marginBottom: 2, letterSpacing: -0.3,
  },
  accountType: { fontSize: 12, color: Colors.textMuted, letterSpacing: 0.2 },

  groupLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 10, marginLeft: 4,
  },
  group: {
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.hairline,
    marginBottom: 24, overflow: 'hidden',
  },
  groupItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  itemIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.inkA8,
    alignItems: 'center', justifyContent: 'center',
  },
  itemIconDanger: {
    backgroundColor: 'rgba(224, 72, 72, 0.10)',
  },
  itemTextWrap: { flex: 1 },
  itemTitle: {
    fontSize: 15, fontWeight: '600', color: Colors.textPrimary,
    letterSpacing: -0.2, marginBottom: 2,
  },
  itemTitleFlat: {
    fontSize: 15, fontWeight: '600', color: Colors.textPrimary,
    letterSpacing: -0.2, flex: 1,
  },
  itemSub: {
    fontSize: 12, fontWeight: '500', color: Colors.textMuted,
  },
  divider: {
    height: 1, backgroundColor: Colors.hairline, marginLeft: 66,
  },

  version: {
    fontSize: 12, color: Colors.textMuted, textAlign: 'center', letterSpacing: 0.3, marginBottom: 10,
  },
});
