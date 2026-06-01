/**
 * Open Run — Track Shots screen.
 * Landscape-locked. Camera preview + shot tracking via ATHLTCamera native module.
 *
 * Route: /open-run
 *
 * Session lifecycle:
 *   CVCameraView handles startSession / loadModel / stopSession on its own.
 *   This screen only controls startTracking / stopTracking (via the `active` prop).
 *
 * Shot detection:
 *   100% native (Swift): AVCaptureSession → CoreML → state machine → JS event.
 *   ShotTracker (JS) is NOT used in the live detection pipeline.
 *   CVSessionSync is still used to persist shots to Supabase.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Animated,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { X, Play, Square, Check } from 'lucide-react-native';
import GlassPanel from '@/components/ui/GlassPanel';
import CVCameraView from '@/components/cv/CameraView';
import PostSessionRecap from '@/components/cv/PostSessionRecap';
import type { ShotEvent } from '@/lib/cv/ShotTracker';
import { CVSessionSync, type SessionRecap } from '@/lib/cv/ShotSync';
import { supabase } from '@/constants/supabase';
import Colors from '@/constants/colors';

// White text shadow for readability over any camera background
const TS = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

type SessionPhase = 'idle' | 'tracking' | 'finishing' | 'recap';
type ShotType = 'make' | 'miss';

// Build a TrackerSummary-compatible object from the native module's counters.
// Zone / trajectory data is not available from ATHLTCamera yet — all optional
// fields are given safe empty defaults so PostSessionRecap and ShotSync never crash.
function buildNativeSummary(makes: number, total: number) {
  const misses = total - makes;
  const fgPct  = total > 0 ? Math.round(makes / total * 100) : 0;
  return {
    makes,
    misses,
    totalShots:    total,
    fgPct,
    bestStreak:    makes,   // rough approximation (no streak tracking in native v1)
    currentStreak: 0,
    shotEvents:    [],
    durationMs:    0,
    sessionStats:  {
      byZone:               [],
      averageReleaseAngle:  undefined,
      averageArcHeight:     undefined,
    },
  };
}

export default function OpenRunScreen() {
  const safeInsets = useSafeAreaInsets();
  const router     = useRouter();

  const [phase, setPhase]               = useState<SessionPhase>('idle');
  const [recap, setRecap]               = useState<SessionRecap | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [liveMakes, setLiveMakes]       = useState(0);
  const [liveTotal, setLiveTotal]       = useState(0);
  const [showHint, setShowHint]         = useState(true);
  const [lastShot, setLastShot]         = useState<{ type: ShotType; zone: string | null } | null>(null);
  const [recentShots, setRecentShots]   = useState<ShotType[]>([]);
  const [glowType, setGlowType]         = useState<ShotType>('make');

  // CVSessionSync persists shots to Supabase — still needed, ShotTracker is not.
  const sync = useMemo(() => new CVSessionSync(), []);

  // Running totals — updated directly from native events (not from ShotTracker).
  const makesRef  = useRef(0);
  const totalRef  = useRef(0);

  // Landscape lock: fires before the screen becomes visible (useFocusEffect > useEffect)
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      // Cleanup/unlock is handled explicitly in handleStop before recap renders.
    }, [])
  );

  // ── Animations ─────────────────────────────────────────────────────────────
  const hintFade  = useRef(new Animated.Value(1)).current;
  const btnPhase  = useRef(new Animated.Value(0)).current;
  const recPulse  = useRef(new Animated.Value(0.3)).current;
  const shotFade  = useRef(new Animated.Value(0)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;
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

  useEffect(() => () => {
    if (shotTimer.current) clearTimeout(shotTimer.current);
  }, []);

  const dismissHint = () => {
    Animated.timing(hintFade, { toValue: 0, duration: 200, useNativeDriver: true })
      .start(() => setShowHint(false));
  };

  // ── Shot received from CVCameraView (originally from Swift native module) ──
  const handleShotDetected = useCallback((event: ShotEvent) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Persist to Supabase
    sync.recordShot(event);

    // Update running totals from refs (native module sends authoritative counts
    // via the ShotDetection.makes / .attempts fields, but ShotEvent doesn't carry
    // them — so we track locally here).
    if (event.type === 'make') {
      makesRef.current += 1;
    }
    totalRef.current += 1;

    setLiveMakes(makesRef.current);
    setLiveTotal(totalRef.current);
    setRecentShots(prev => [...prev.slice(-9), event.type]);

    // Last-shot pill (bottom left)
    setLastShot({ type: event.type, zone: event.zone });
    if (shotTimer.current) clearTimeout(shotTimer.current);
    shotFade.setValue(0);
    Animated.timing(shotFade, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    shotTimer.current = setTimeout(() => {
      Animated.timing(shotFade, { toValue: 0, duration: 350, useNativeDriver: true }).start();
    }, 3000);

    // Center screen glow
    setGlowType(event.type);
    glowAnim.stopAnimation();
    glowAnim.setValue(0);
    Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [sync, shotFade, glowAnim]);

  // ── Start tracking ──────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dismissHint();
    Animated.timing(btnPhase, { toValue: 1, duration: 180, useNativeDriver: true }).start();

    makesRef.current = 0;
    totalRef.current = 0;
    setLiveMakes(0);
    setLiveTotal(0);
    setRecentShots([]);
    setPhase('tracking');

    try {
      await sync.start({ sessionType: 'open_run' });
    } catch (e) {
      console.error('[open-run] sync.start error:', e);
    }
  };

  // ── Stop tracking ───────────────────────────────────────────────────────────
  const handleStop = async () => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.timing(btnPhase, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    setPhase('finishing');
    setRecapLoading(true);

    // Unlock BEFORE recap renders — prevents recap showing in landscape
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});

    try {
      let userId: string | undefined;
      try {
        const ar = await supabase.auth.getUser();
        userId = ar.data?.user?.id ?? undefined;
      } catch {}

      // Build a TrackerSummary-compatible object from native module counters.
      // Zone / trajectory fields are empty — ATHLTCamera doesn't surface them yet.
      const m = makesRef.current;
      const t = totalRef.current;
      const summary = buildNativeSummary(m, t);

      const sessionRecap = await sync.finish(summary as any, userId);
      setRecap(sessionRecap);
    } catch (e) {
      console.error('[open-run] stop error:', e);
      setRecap(null);
    } finally {
      setRecapLoading(false);
      setPhase('recap');
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const isTracking  = phase === 'tracking';
  const fgPct       = liveTotal > 0 ? Math.round((liveMakes / liveTotal) * 100) : 0;
  const shotText    = lastShot
    ? `${lastShot.type === 'make' ? 'MAKE' : 'MISS'}${lastShot.zone ? ' · ' + lastShot.zone : ''}`
    : '';

  const startOpacity = btnPhase.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const stopOpacity  = btnPhase.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  // Layout anchors for landscape safe areas (notched iPhones)
  const barY    = Math.max(safeInsets.top, 20) + 4;
  const leftX   = safeInsets.left + 8;
  const rightX  = safeInsets.right + 16;
  const bottomY = safeInsets.bottom + 16;

  // ── Recap ───────────────────────────────────────────────────────────────────
  if (phase === 'recap' || phase === 'finishing') {
    return (
      <View style={[s.full, { paddingTop: safeInsets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <PostSessionRecap
          recap={recap}
          summary={buildNativeSummary(makesRef.current, totalRef.current) as any}
          loading={recapLoading}
          onDone={() => router.back()}
        />
      </View>
    );
  }

  // ── Main screen ─────────────────────────────────────────────────────────────
  return (
    <View style={s.full}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Camera fills screen — ATHLTCameraView rendered inside CVCameraView */}
      <CVCameraView
        active={isTracking}
        onShotDetected={handleShotDetected}
      />

      {/* Center glow on shot detection */}
      <Animated.View
        style={[StyleSheet.absoluteFill, s.glowContainer, { opacity: glowAnim }]}
        pointerEvents="none"
      >
        <View
          style={[
            s.glowCircle,
            { backgroundColor: glowType === 'make' ? 'rgba(212,160,23,0.26)' : 'rgba(255,255,255,0.10)' },
          ]}
        />
        <View style={[StyleSheet.absoluteFill, s.glowIconWrap]}>
          {glowType === 'make'
            ? <Check size={48} color={Colors.primary} strokeWidth={2.5} />
            : <X size={48} color="rgba(255,255,255,0.70)" strokeWidth={2.5} />
          }
        </View>
      </Animated.View>

      {/* X / close */}
      <View style={[s.topLeft, { top: barY, left: leftX }]}>
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

      {/* Title (idle) or REC (tracking) */}
      <View style={[s.topCenter, { top: barY }]} pointerEvents="none">
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

      {/* Hint card (idle only) */}
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

      {/* Last shot pill — bottom left */}
      {lastShot !== null && (
        <Animated.View
          style={[s.shotWrap, { opacity: shotFade, bottom: bottomY + BTN_H + 12, left: leftX }]}
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

      {/* Stat dock — bottom right, tracking only */}
      {isTracking && (
        <View style={[s.dockWrap, { bottom: bottomY, right: rightX }]}>
          <GlassPanel style={s.dock} borderRadius={16} tint="dark" intensity={60}>
            {/* Makes / Total */}
            <View style={s.dockRow}>
              <Text style={[s.dockMakes, TS]}>{liveMakes}</Text>
              <Text style={[s.dockSlash, TS]}>/</Text>
              <Text style={[s.dockTotal, TS]}>{liveTotal}</Text>
            </View>
            {/* FG% bar */}
            <View style={s.progressRow}>
              <View style={s.progressTrack}>
                {fgPct > 0 && (
                  <View style={[s.progressFill, { width: `${fgPct}%` as any }]} />
                )}
              </View>
              <Text style={[s.progressPct, TS]}>
                {liveTotal > 0 ? `${fgPct}%` : '--'}
              </Text>
            </View>
            {/* Recent shots dots */}
            <View style={s.dotsRow}>
              {Array.from({ length: 10 }).map((_, i) => {
                const offset = 10 - recentShots.length;
                const shot   = i >= offset ? recentShots[i - offset] : null;
                return (
                  <View
                    key={i}
                    style={[
                      s.dot,
                      shot === 'make' ? s.dotMake :
                      shot === 'miss' ? s.dotMiss :
                      s.dotEmpty,
                    ]}
                  />
                );
              })}
            </View>
          </GlassPanel>
        </View>
      )}

      {/* Start / Stop button — centered, cross-fading */}
      <View style={[s.bottomWrap, { bottom: bottomY }]}>
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

  topLeft:   { position: 'absolute', zIndex: 30 },
  topCenter: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 20 },

  xBtn:      { width: 36, height: 36, overflow: 'hidden' },
  xBtnInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  titlePill: {
    paddingHorizontal: 14, height: 30, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center',
  },
  titleText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', letterSpacing: -0.1 },

  recPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, height: 26, overflow: 'hidden',
  },
  recDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30' },
  recText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

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

  shotWrap: { position: 'absolute', zIndex: 30 },
  shotPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, height: 28, overflow: 'hidden',
  },
  shotText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },

  glowContainer: { alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  glowCircle:    { width: 320, height: 320, borderRadius: 160 },
  glowIconWrap:  { alignItems: 'center', justifyContent: 'center' },

  dockWrap: { position: 'absolute', zIndex: 30 },
  dock: {
    width: 136, paddingHorizontal: 12, paddingVertical: 10,
    gap: 7, overflow: 'hidden',
  },
  dockRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  dockMakes: {
    color: '#FFFFFF', fontSize: 32, fontWeight: '800',
    letterSpacing: -1, lineHeight: 36, fontVariant: ['tabular-nums'],
  },
  dockSlash: {
    color: 'rgba(255,255,255,0.4)', fontSize: 18, fontWeight: '400', lineHeight: 22,
  },
  dockTotal: {
    color: 'rgba(255,255,255,0.75)', fontSize: 20, fontWeight: '600',
    letterSpacing: -0.5, lineHeight: 24, fontVariant: ['tabular-nums'],
  },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressTrack: {
    flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: 3, backgroundColor: Colors.primary, borderRadius: 2 },
  progressPct: {
    color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '600',
    fontVariant: ['tabular-nums'], minWidth: 26, textAlign: 'right',
  },

  dotsRow: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  dot:      { width: 6, height: 6, borderRadius: 3 },
  dotMake:  { backgroundColor: Colors.primary },
  dotMiss:  { backgroundColor: 'rgba(255,255,255,0.35)' },
  dotEmpty: { backgroundColor: 'rgba(255,255,255,0.09)' },

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
