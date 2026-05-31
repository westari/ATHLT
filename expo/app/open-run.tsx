/**
 * Open Run — Track Shots screen with Liquid Glass HUD.
 *
 * Camera fills the entire screen. All controls are GlassPanel overlays.
 * No solid-colored buttons — everything is frosted glass.
 *
 * Route: /open-run
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { X, Play, Square, Check } from 'lucide-react-native';
import GlassPanel from '@/components/ui/GlassPanel';
import CVCameraView from '@/components/cv/CameraView';
import PostSessionRecap from '@/components/cv/PostSessionRecap';
import { ShotTracker, type ShotEvent } from '@/lib/cv/ShotTracker';
import { CVSessionSync, type SessionRecap } from '@/lib/cv/ShotSync';
import { supabase } from '@/constants/supabase';

// Note: camera orientation is handled naturally by VisionCamera.
// Hold phone horizontally for the best shooting-session view.

const { width: SW } = Dimensions.get('window');
const BTN_HEIGHT = 64;
const BTN_BOTTOM = 40;

// Subtle text shadow for readability over any camera background
const TEXT_SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.45)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

type SessionPhase = 'idle' | 'tracking' | 'finishing' | 'recap';

export default function OpenRunScreen() {
  const safeInsets = useSafeAreaInsets();
  const router     = useRouter();

  // ---- Session state ----
  const [phase, setPhase]               = useState<SessionPhase>('idle');
  const [recap, setRecap]               = useState<SessionRecap | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [liveMakes, setLiveMakes]       = useState(0);
  const [liveTotal, setLiveTotal]       = useState(0);
  const [showHint, setShowHint]         = useState(true);
  const [lastShot, setLastShot]         = useState<{ type: 'make' | 'miss'; zone: string | null } | null>(null);

  // ---- CV ----
  const tracker = useMemo(() => new ShotTracker(), []);
  const sync    = useMemo(() => new CVSessionSync(), []);

  // ---- Animations ----
  const hintFade   = useRef(new Animated.Value(1)).current;
  const btnPhase   = useRef(new Animated.Value(0)).current; // 0 = start, 1 = stop
  const recPulse   = useRef(new Animated.Value(0.3)).current;
  const shotFade   = useRef(new Animated.Value(0)).current;
  const shotTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // REC dot pulse loop while tracking
  useEffect(() => {
    if (phase !== 'tracking') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(recPulse, { toValue: 1.0, duration: 900, useNativeDriver: true }),
        Animated.timing(recPulse, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);

  // Clean up shot timer on unmount
  useEffect(() => () => { if (shotTimer.current) clearTimeout(shotTimer.current); }, []);

  // ---- Animation helpers ----
  const dismissHint = () => {
    Animated.timing(hintFade, { toValue: 0, duration: 200, useNativeDriver: true })
      .start(() => setShowHint(false));
  };

  const flashLastShot = (event: ShotEvent) => {
    setLastShot({ type: event.type, zone: event.zone });
    if (shotTimer.current) clearTimeout(shotTimer.current);
    shotFade.setValue(0);
    Animated.timing(shotFade, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    shotTimer.current = setTimeout(() => {
      Animated.timing(shotFade, { toValue: 0, duration: 350, useNativeDriver: true }).start();
    }, 3000);
  };

  // ---- Shot detection ----
  const handleShotDetected = useCallback((event: ShotEvent) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sync.recordShot(event);
    setLiveMakes(tracker.getMakes());
    setLiveTotal(tracker.getTotalShots());
    flashLastShot(event);
  }, [sync, tracker]);

  // ---- Session control ----
  const handleStart = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dismissHint();
    Animated.timing(btnPhase, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    setPhase('tracking'); // immediate UI state change
    setLiveMakes(0);
    setLiveTotal(0);
    // Supabase sync in background — doesn't block UI
    try {
      tracker.reset();
      await sync.start({ sessionType: 'open_run' });
    } catch (e) {
      console.error('[open-run] handleStart error:', e);
    }
  };

  const handleStop = async () => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.timing(btnPhase, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    setPhase('finishing');
    setRecapLoading(true);
    try {
      const summary = tracker.getSummary();
      let userId: string | undefined;
      try {
        const ar = await supabase.auth.getUser();
        userId = ar.data?.user?.id ?? undefined;
      } catch {}
      const sessionRecap = await sync.finish(summary, userId);
      setRecap(sessionRecap);
    } catch (e) {
      console.error('[open-run] handleStop error:', e);
      setRecap(null);
    } finally {
      setRecapLoading(false);
      setPhase('recap');
    }
  };

  // ---- Derived display values ----
  const isTracking   = phase === 'tracking';
  const fgPctNum     = liveTotal > 0 ? Math.round((liveMakes / liveTotal) * 100) : null;
  const statText     = liveTotal > 0
    ? `${liveMakes} / ${liveTotal} · ${fgPctNum}%`
    : 'Tracking...';
  const lastShotText = lastShot
    ? `${lastShot.type === 'make' ? 'MAKE' : 'MISS'}${lastShot.zone ? ' · ' + lastShot.zone : ''}`
    : '';

  // Button cross-fade interpolations
  const startOpacity = btnPhase.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const stopOpacity  = btnPhase.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  // ---- Recap screen ----
  if (phase === 'recap' || phase === 'finishing') {
    const summary = tracker.getSummary();
    return (
      <View style={[s.full, { paddingTop: safeInsets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <PostSessionRecap
          recap={recap}
          summary={summary}
          loading={recapLoading}
          onDone={() => router.back()}
        />
      </View>
    );
  }

  // ---- Main screen ----
  return (
    <View style={s.full}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Camera — fills entire screen ── */}
      <CVCameraView
        tracker={tracker}
        active={isTracking}
        onShotDetected={handleShotDetected}
      />

      {/* ────────────────────────────────────────
          TOP BAR
          X left | title/REC center | stat right
      ──────────────────────────────────────── */}

      {/* X button — always visible */}
      <View style={[s.topLeft, { top: safeInsets.top + 12 }]}>
        <GlassPanel style={s.iconBtn} borderRadius={22} tint="dark">
          <TouchableOpacity
            style={s.iconBtnInner}
            onPress={() => { if (isTracking) void handleStop(); else router.back(); }}
            activeOpacity={0.8}
          >
            <X size={20} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
        </GlassPanel>
      </View>

      {/* Center pill — title in idle, REC in tracking */}
      <View style={[s.topCenter, { top: safeInsets.top + 14 }]} pointerEvents="none">
        {!isTracking ? (
          <GlassPanel style={s.titlePill} borderRadius={999} tint="dark">
            <Text style={[s.titleText, TEXT_SHADOW]}>Track Shots</Text>
          </GlassPanel>
        ) : (
          <GlassPanel style={s.recPill} borderRadius={999} tint="dark">
            <Animated.View style={[s.recDot, { opacity: recPulse }]} />
            <Text style={[s.recText, TEXT_SHADOW]}>REC</Text>
          </GlassPanel>
        )}
      </View>

      {/* Stat pill — top right, tracking only */}
      {isTracking && (
        <View style={[s.topRight, { top: safeInsets.top + 12 }]}>
          <GlassPanel style={s.statPill} borderRadius={999} tint="dark">
            <Text style={[s.statText, TEXT_SHADOW]}>{statText}</Text>
          </GlassPanel>
        </View>
      )}

      {/* ────────────────────────────────────────
          CENTER — hint card (idle only)
      ──────────────────────────────────────── */}
      {showHint && !isTracking && (
        <Animated.View style={[s.hintWrap, { opacity: hintFade }]} pointerEvents="box-none">
          <GlassPanel style={s.hintCard} borderRadius={22} tint="light">
            <TouchableOpacity
              style={s.hintDismissBtn}
              onPress={dismissHint}
              activeOpacity={0.7}
              hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
            >
              <X size={14} color="rgba(255,255,255,0.7)" strokeWidth={2} />
            </TouchableOpacity>
            <Text style={[s.hintTitle, TEXT_SHADOW]}>Point at the hoop</Text>
            <Text style={[s.hintSub, TEXT_SHADOW]}>Hold horizontally for best tracking</Text>
          </GlassPanel>
        </Animated.View>
      )}

      {/* ────────────────────────────────────────
          LAST SHOT INDICATOR — bottom left
      ──────────────────────────────────────── */}
      {lastShot !== null && (
        <Animated.View
          style={[s.shotWrap, { opacity: shotFade, bottom: safeInsets.bottom + BTN_HEIGHT + 60 }]}
          pointerEvents="none"
        >
          <GlassPanel style={s.shotPill} borderRadius={999} tint="dark">
            {lastShot.type === 'make'
              ? <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
              : <X size={14} color="#FFFFFF" strokeWidth={2.5} />
            }
            <Text style={[s.shotText, TEXT_SHADOW]}>{lastShotText}</Text>
          </GlassPanel>
        </Animated.View>
      )}

      {/* ────────────────────────────────────────
          BOTTOM — cross-fading Start / Stop
      ──────────────────────────────────────── */}
      <View style={[s.bottomWrap, { bottom: safeInsets.bottom + BTN_BOTTOM }]}>
        {/* Start button */}
        <Animated.View
          style={[s.btnSlot, { opacity: startOpacity }]}
          pointerEvents={isTracking ? 'none' : 'auto'}
        >
          <GlassPanel style={s.bigBtn} borderRadius={32} tint="light" tintColor="rgba(201,162,74,0.38)">
            <TouchableOpacity style={s.bigBtnInner} onPress={handleStart} activeOpacity={0.85}>
              <Play size={22} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.8} />
              <Text style={[s.bigBtnText, TEXT_SHADOW]}>Start Tracking</Text>
            </TouchableOpacity>
          </GlassPanel>
        </Animated.View>

        {/* Stop button */}
        <Animated.View
          style={[s.btnSlot, { opacity: stopOpacity }]}
          pointerEvents={isTracking ? 'auto' : 'none'}
        >
          <GlassPanel style={s.bigBtn} borderRadius={32} tint="dark">
            <TouchableOpacity style={s.bigBtnInner} onPress={handleStop} activeOpacity={0.85}>
              <Square size={20} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.8} />
              <Text style={[s.bigBtnText, TEXT_SHADOW]}>Stop</Text>
            </TouchableOpacity>
          </GlassPanel>
        </Animated.View>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  full: { flex: 1, backgroundColor: '#000' },

  // ── Top bar elements ──
  topLeft: {
    position: 'absolute', left: 16, zIndex: 30,
  },
  topCenter: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', zIndex: 20,
  },
  topRight: {
    position: 'absolute', right: 16, zIndex: 30,
  },

  iconBtn: {
    width: 44, height: 44,
    overflow: 'hidden',
  },
  iconBtnInner: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },

  titlePill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, height: 36, overflow: 'hidden',
  },
  titleText: {
    color: '#FFFFFF', fontSize: 14, fontWeight: '600', letterSpacing: -0.2,
  },

  recPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 30, overflow: 'hidden',
  },
  recDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  recText: {
    color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
  },

  statPill: {
    paddingHorizontal: 14, height: 36,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  statText: {
    color: '#FFFFFF', fontSize: 13, fontWeight: '600',
    letterSpacing: -0.2, fontVariant: ['tabular-nums'],
  },

  // ── Center hint card ──
  hintWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 20,
  },
  hintCard: {
    maxWidth: 280, padding: 20, overflow: 'hidden',
  },
  hintDismissBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  hintTitle: {
    color: '#FFFFFF', fontSize: 16, fontWeight: '600',
    letterSpacing: -0.3, marginBottom: 6, marginRight: 20,
  },
  hintSub: {
    color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 18,
  },

  // ── Last shot indicator ──
  shotWrap: {
    position: 'absolute', left: 20, zIndex: 30,
  },
  shotPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, height: 34, overflow: 'hidden',
  },
  shotText: {
    color: '#FFFFFF', fontSize: 12, fontWeight: '600', letterSpacing: 0.3,
  },

  // ── Bottom cross-fade buttons ──
  bottomWrap: {
    position: 'absolute', left: 20, right: 20,
    height: BTN_HEIGHT,
    zIndex: 30,
  },
  btnSlot: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
  },
  bigBtn: {
    flex: 1, height: BTN_HEIGHT, overflow: 'hidden',
  },
  bigBtnInner: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  bigBtnText: {
    color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: -0.3,
  },
});
