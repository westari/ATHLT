/**
 * Open Run — Track Shots screen.
 * Landscape-locked. Minimal frosted-glass HUD, camera dominant.
 *
 * Route: /open-run
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Animated,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
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

// Subtle text shadow so white text reads over any camera background
const TS = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

type SessionPhase = 'idle' | 'tracking' | 'finishing' | 'recap';

export default function OpenRunScreen() {
  const safeInsets = useSafeAreaInsets();
  const router     = useRouter();

  const [phase, setPhase]         = useState<SessionPhase>('idle');
  const [recap, setRecap]         = useState<SessionRecap | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [liveMakes, setLiveMakes] = useState(0);
  const [liveTotal, setLiveTotal] = useState(0);
  const [showHint, setShowHint]   = useState(true);
  const [lastShot, setLastShot]   = useState<{ type: 'make' | 'miss'; zone: string | null } | null>(null);

  const tracker = useMemo(() => new ShotTracker(), []);
  const sync    = useMemo(() => new CVSessionSync(), []);

  // Landscape lock — requires EAS build with expo-screen-orientation
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  // ---- Animations ----
  const hintFade  = useRef(new Animated.Value(1)).current;
  const btnPhase  = useRef(new Animated.Value(0)).current; // 0=start, 1=stop
  const recPulse  = useRef(new Animated.Value(0.3)).current;
  const shotFade  = useRef(new Animated.Value(0)).current;
  const shotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => () => { if (shotTimer.current) clearTimeout(shotTimer.current); }, []);

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

  // ---- Session control ----
  const handleShotDetected = useCallback((event: ShotEvent) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sync.recordShot(event);
    setLiveMakes(tracker.getMakes());
    setLiveTotal(tracker.getTotalShots());
    flashLastShot(event);
  }, [sync, tracker]);

  const handleStart = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dismissHint();
    Animated.timing(btnPhase, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    setPhase('tracking');
    setLiveMakes(0);
    setLiveTotal(0);
    try {
      tracker.reset();
      await sync.start({ sessionType: 'open_run' });
    } catch (e) {
      console.error('[open-run] start error:', e);
    }
  };

  const handleStop = async () => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.timing(btnPhase, { toValue: 0, duration: 180, useNativeDriver: true }).start();
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
      console.error('[open-run] stop error:', e);
      setRecap(null);
    } finally {
      setRecapLoading(false);
      setPhase('recap');
    }
  };

  // ---- Derived ----
  const isTracking = phase === 'tracking';
  const fgPctNum   = liveTotal > 0 ? Math.round((liveMakes / liveTotal) * 100) : null;
  const statText   = liveTotal > 0 ? `${liveMakes}/${liveTotal} · ${fgPctNum}%` : 'Tracking…';
  const shotText   = lastShot
    ? `${lastShot.type === 'make' ? 'MAKE' : 'MISS'}${lastShot.zone ? ' · ' + lastShot.zone : ''}`
    : '';

  const startOpacity = btnPhase.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const stopOpacity  = btnPhase.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  // In landscape the safe-area shifts (left/right become the inset sides on notched devices)
  const topInset    = Math.max(safeInsets.top, safeInsets.left, 0) + 8;
  const bottomInset = Math.max(safeInsets.bottom, safeInsets.right, 0) + 16;

  // ---- Recap ----
  if (phase === 'recap' || phase === 'finishing') {
    return (
      <View style={[s.full, { paddingTop: safeInsets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <PostSessionRecap
          recap={recap}
          summary={tracker.getSummary()}
          loading={recapLoading}
          onDone={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={s.full}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Camera fills screen */}
      <CVCameraView
        tracker={tracker}
        active={isTracking}
        onShotDetected={handleShotDetected}
      />

      {/* ── X close ── */}
      <View style={[s.topLeft, { top: topInset }]}>
        <GlassPanel style={s.xBtn} borderRadius={18} tint="dark" intensity={55}>
          <TouchableOpacity
            style={s.xBtnInner}
            onPress={() => { if (isTracking) void handleStop(); else router.back(); }}
            activeOpacity={0.8}
          >
            <X size={16} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
        </GlassPanel>
      </View>

      {/* ── Center pill: title (idle) or REC (tracking) ── */}
      <View style={[s.topCenter, { top: topInset }]} pointerEvents="none">
        {!isTracking ? (
          <GlassPanel style={s.titlePill} borderRadius={999} tint="dark" intensity={55}>
            <Text style={[s.titleText, TS]}>Track Shots</Text>
          </GlassPanel>
        ) : (
          <GlassPanel style={s.recPill} borderRadius={999} tint="dark" intensity={55}>
            <Animated.View style={[s.recDot, { opacity: recPulse }]} />
            <Text style={[s.recText, TS]}>REC</Text>
          </GlassPanel>
        )}
      </View>

      {/* ── Stat pill — tracking only, top right ── */}
      {isTracking && (
        <View style={[s.topRight, { top: topInset }]}>
          <GlassPanel style={s.statPill} borderRadius={999} tint="dark" intensity={55}>
            <Text style={[s.statText, TS]}>{statText}</Text>
          </GlassPanel>
        </View>
      )}

      {/* ── Hint card — center, idle only ── */}
      {showHint && !isTracking && (
        <Animated.View style={[s.hintWrap, { opacity: hintFade }]} pointerEvents="box-none">
          <GlassPanel style={s.hintCard} borderRadius={18} tint="light" intensity={55}>
            <TouchableOpacity
              style={s.hintX}
              onPress={dismissHint}
              activeOpacity={0.7}
              hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
            >
              <X size={12} color="rgba(255,255,255,0.6)" strokeWidth={2} />
            </TouchableOpacity>
            <Text style={[s.hintTitle, TS]}>Point at the hoop</Text>
            <Text style={[s.hintSub, TS]}>Hold horizontally for best tracking</Text>
          </GlassPanel>
        </Animated.View>
      )}

      {/* ── Last shot flash — bottom left ── */}
      {lastShot !== null && (
        <Animated.View
          style={[s.shotWrap, { opacity: shotFade, bottom: bottomInset + 64 }]}
          pointerEvents="none"
        >
          <GlassPanel style={s.shotPill} borderRadius={999} tint="dark" intensity={55}>
            {lastShot.type === 'make'
              ? <Check size={12} color="#FFFFFF" strokeWidth={2.5} />
              : <X size={12} color="#FFFFFF" strokeWidth={2.5} />
            }
            <Text style={[s.shotText, TS]}>{shotText}</Text>
          </GlassPanel>
        </Animated.View>
      )}

      {/* ── Bottom: cross-fading Start / Stop (compact, centered) ── */}
      <View style={[s.bottomWrap, { bottom: bottomInset }]}>
        <Animated.View
          style={[s.btnSlot, { opacity: startOpacity }]}
          pointerEvents={isTracking ? 'none' : 'auto'}
        >
          <GlassPanel style={s.btn} borderRadius={26} tint="light" tintColor="rgba(201,162,74,0.35)" intensity={60}>
            <TouchableOpacity style={s.btnInner} onPress={handleStart} activeOpacity={0.85}>
              <Play size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.8} />
              <Text style={[s.btnText, TS]}>Start Tracking</Text>
            </TouchableOpacity>
          </GlassPanel>
        </Animated.View>

        <Animated.View
          style={[s.btnSlot, { opacity: stopOpacity }]}
          pointerEvents={isTracking ? 'auto' : 'none'}
        >
          <GlassPanel style={s.btn} borderRadius={26} tint="dark" intensity={60}>
            <TouchableOpacity style={s.btnInner} onPress={handleStop} activeOpacity={0.85}>
              <Square size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.8} />
              <Text style={[s.btnText, TS]}>Stop</Text>
            </TouchableOpacity>
          </GlassPanel>
        </Animated.View>
      </View>

    </View>
  );
}

const BTN_W = 220;
const BTN_H = 52;

const s = StyleSheet.create({
  full: { flex: 1, backgroundColor: '#000' },

  // Top anchors
  topLeft:   { position: 'absolute', left: 16, zIndex: 30 },
  topCenter: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 20 },
  topRight:  { position: 'absolute', right: 16, zIndex: 30 },

  // X button — 36×36
  xBtn:      { width: 36, height: 36, overflow: 'hidden' },
  xBtnInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Title pill — height 28
  titlePill: {
    paddingHorizontal: 12, height: 28, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center',
  },
  titleText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', letterSpacing: -0.1 },

  // REC pill — height 24
  recPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, height: 24, overflow: 'hidden',
  },
  recDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30' },
  recText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  // Stat pill — height 28
  statPill: {
    paddingHorizontal: 12, height: 28,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  statText: {
    color: '#FFFFFF', fontSize: 12, fontWeight: '600',
    letterSpacing: -0.1, fontVariant: ['tabular-nums'],
  },

  // Hint card — compact
  hintWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', zIndex: 20,
  },
  hintCard:  { maxWidth: 220, padding: 14, overflow: 'hidden' },
  hintX: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },
  hintTitle: {
    color: '#FFFFFF', fontSize: 14, fontWeight: '600',
    letterSpacing: -0.2, marginBottom: 4, marginRight: 14,
  },
  hintSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 17 },

  // Last shot
  shotWrap: { position: 'absolute', left: 16, zIndex: 30 },
  shotPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, height: 26, overflow: 'hidden',
  },
  shotText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },

  // Bottom buttons — 220×52, centered
  bottomWrap: {
    position: 'absolute', left: 0, right: 0,
    height: BTN_H, alignItems: 'center', zIndex: 30,
  },
  btnSlot: { position: 'absolute', width: BTN_W, height: BTN_H, top: 0 },
  btn:     { width: BTN_W, height: BTN_H, overflow: 'hidden' },
  btnInner: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
});
