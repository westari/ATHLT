/**
 * Open Run — Track Shots screen.
 * Landscape-locked. Camera preview + shot tracking via ATHLTCamera native module.
 * Route: /open-run
 *
 * Flow:
 *   mount → detection mode (hoop seeking) → user aligns hoop → Start enabled
 *   Start → tracking mode → shots counted → Stop → recap
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Animated,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { X, Play, Square, Check, RotateCw } from 'lucide-react-native';
import GlassPanel from '@/components/ui/GlassPanel';
import CVCameraView from '@/components/cv/CameraView';
import PostSessionRecap from '@/components/cv/PostSessionRecap';
import type { ShotEvent } from '@/lib/cv/ShotTracker';
import type { HoopDetectedEvent, DetectionDebugEvent } from '@/modules/athlt-camera/src/index';
import { flipCamera, setDiagnosticMode, addDetectionDebugListener } from '@/modules/athlt-camera/src/index';
import { CVSessionSync, type SessionRecap } from '@/lib/cv/ShotSync';
import { supabase } from '@/constants/supabase';
import Colors from '@/constants/colors';

const TS = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

type SessionPhase = 'idle' | 'tracking' | 'finishing' | 'recap';
type ShotType = 'make' | 'miss';

function buildNativeSummary(makes: number, total: number) {
  const misses = total - makes;
  const fgPct  = total > 0 ? Math.round(makes / total * 100) : 0;
  return {
    makes, misses, totalShots: total, fgPct,
    bestStreak: makes, currentStreak: 0, shotEvents: [], durationMs: 0,
    sessionStats: { byZone: [], averageReleaseAngle: undefined, averageArcHeight: undefined },
  };
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
  const [allShots, setAllShots]         = useState<ShotType[]>([]);  // full list for recap timeline
  const [glowType, setGlowType]         = useState<ShotType>('make');
  const [elapsed, setElapsed]           = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [hoopDetected, setHoopDetected] = useState(false);
  const [cameraReady, setCameraReady]   = useState(false);

  // ── Camera flip state ───────────────────────────────────────────────────────
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');
  const [isFlipping, setIsFlipping]         = useState(false);

  // ── Diagnostic mode ─────────────────────────────────────────────────────────
  const [diagOpen, setDiagOpen]         = useState(false);
  const [diagData, setDiagData]         = useState<DetectionDebugEvent>({
    class: 'none', confidence: 0, framesAnalyzed: 0, fps: 0,
  });

  const sync = useMemo(() => new CVSessionSync(), []);

  const makesRef        = useRef(0);
  const totalRef        = useRef(0);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number>(0);

  // Landscape lock
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    }, [])
  );

  // ── Animations ─────────────────────────────────────────────────────────────
  const hintFade    = useRef(new Animated.Value(1)).current;
  const btnPhase    = useRef(new Animated.Value(0)).current;
  const recPulse    = useRef(new Animated.Value(0.3)).current;
  const shotFade    = useRef(new Animated.Value(0)).current;
  const glowAnim    = useRef(new Animated.Value(0)).current;
  const hoopPulse   = useRef(new Animated.Value(1)).current;
  const overlayFade = useRef(new Animated.Value(1)).current;
  const shotTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (!hoopDetected) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hoopPulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(hoopPulse, { toValue: 0.45, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hoopDetected]);

  // ── Session timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'tracking') {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    sessionStartRef.current = Date.now();
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    }, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };
  }, [phase]);

  // ── Diagnostic event subscription ────────────────────────────────────────────
  useEffect(() => {
    if (!diagOpen) return;
    const sub = addDetectionDebugListener(event => setDiagData(event));
    return () => sub.remove();
  }, [diagOpen]);

  // Enable/disable diagnostic mode in native when overlay opens/closes
  useEffect(() => {
    setDiagnosticMode(diagOpen).catch(() => {});
  }, [diagOpen]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (shotTimer.current) clearTimeout(shotTimer.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const dismissHint = () => {
    Animated.timing(hintFade, { toValue: 0, duration: 200, useNativeDriver: true })
      .start(() => setShowHint(false));
  };

  // ── Camera flip ──────────────────────────────────────────────────────────────
  const handleFlip = async () => {
    if (isFlipping) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFlipping(true);
    try {
      const result = await flipCamera();
      setCameraPosition(result.position);
    } catch (e) {
      console.warn('[open-run] flipCamera error:', e);
    } finally {
      setIsFlipping(false);
    }
  };

  // ── Diagnostic toggle ────────────────────────────────────────────────────────
  const handleToggleDiag = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDiagOpen(v => !v);
  };

  // ── Hoop detected ────────────────────────────────────────────────────────────
  const handleHoopDetected = useCallback((event: HoopDetectedEvent) => {
    if (event.detected) setHoopDetected(true);
  }, []);

  // ── Shot received ────────────────────────────────────────────────────────────
  const handleShotDetected = useCallback((event: ShotEvent) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sync.recordShot(event);

    if (event.type === 'make') makesRef.current += 1;
    totalRef.current += 1;

    setLiveMakes(makesRef.current);
    setLiveTotal(totalRef.current);
    setRecentShots(prev => [...prev.slice(-14), event.type]);
    setAllShots(prev => [...prev, event.type]);
    setCurrentStreak(prev => event.type === 'make' ? prev + 1 : 0);

    setLastShot({ type: event.type, zone: event.zone });
    if (shotTimer.current) clearTimeout(shotTimer.current);
    shotFade.setValue(0);
    Animated.timing(shotFade, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    shotTimer.current = setTimeout(() => {
      Animated.timing(shotFade, { toValue: 0, duration: 350, useNativeDriver: true }).start();
    }, 3000);

    setGlowType(event.type);
    glowAnim.stopAnimation();
    glowAnim.setValue(0);
    Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [sync, shotFade, glowAnim]);

  // ── Start ────────────────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!hoopDetected) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dismissHint();
    setDiagOpen(false);

    Animated.timing(overlayFade, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(btnPhase, { toValue: 1, duration: 180, useNativeDriver: true }).start();

    makesRef.current = 0;
    totalRef.current = 0;
    setLiveMakes(0); setLiveTotal(0); setRecentShots([]); setAllShots([]);
    setCurrentStreak(0); setElapsed(0);
    setPhase('tracking');

    try { await sync.start({ sessionType: 'open_run' }); }
    catch (e) { console.error('[open-run] sync.start error:', e); }
  };

  // ── Stop ─────────────────────────────────────────────────────────────────────
  const handleStop = async () => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.timing(btnPhase, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    setPhase('finishing');
    setRecapLoading(true);

    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});

    try {
      let userId: string | undefined;
      try { userId = (await supabase.auth.getUser()).data?.user?.id ?? undefined; } catch {}

      const summary = buildNativeSummary(makesRef.current, totalRef.current);
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

  // ── Derived ──────────────────────────────────────────────────────────────────
  const isTracking   = phase === 'tracking';
  const fgPct        = liveTotal > 0 ? Math.round((liveMakes / liveTotal) * 100) : 0;
  const shotText     = lastShot
    ? `${lastShot.type === 'make' ? 'MAKE' : 'MISS'}${lastShot.zone ? ' · ' + lastShot.zone : ''}`
    : '';

  const startOpacity = btnPhase.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const stopOpacity  = btnPhase.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const barY    = Math.max(safeInsets.top, 20) + 4;
  const leftX   = safeInsets.left + 8;
  const rightX  = safeInsets.right + 16;
  const bottomY = safeInsets.bottom + 16;

  // ── Recap ────────────────────────────────────────────────────────────────────
  if (phase === 'recap' || phase === 'finishing') {
    return (
      <View style={[s.full, { paddingTop: safeInsets.top, backgroundColor: Colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <PostSessionRecap
          recap={recap}
          summary={buildNativeSummary(makesRef.current, totalRef.current) as any}
          loading={recapLoading}
          onDone={() => router.back()}
          recentShots={allShots}
        />
      </View>
    );
  }

  // ── Main screen ──────────────────────────────────────────────────────────────
  return (
    <View style={s.full}>
      <Stack.Screen options={{ headerShown: false }} />

      <CVCameraView
        active={isTracking}
        onShotDetected={handleShotDetected}
        onHoopDetected={handleHoopDetected}
        onCameraReady={() => setCameraReady(true)}
      />

      {/* Center glow */}
      <Animated.View
        style={[StyleSheet.absoluteFill, s.glowContainer, { opacity: glowAnim }]}
        pointerEvents="none"
      >
        <View style={[s.glowCircle, { backgroundColor: glowType === 'make' ? 'rgba(212,160,23,0.26)' : 'rgba(255,255,255,0.10)' }]} />
        <View style={[StyleSheet.absoluteFill, s.glowIconWrap]}>
          {glowType === 'make'
            ? <Check size={48} color={Colors.primary} strokeWidth={2.5} />
            : <X size={48} color="rgba(255,255,255,0.70)" strokeWidth={2.5} />
          }
        </View>
      </Animated.View>

      {/* ── Hoop detection overlay ──────────────────────────────────────────── */}
      <Animated.View
        style={[s.hoopOverlayWrap, { opacity: overlayFade }]}
        pointerEvents="none"
      >
        <Animated.View style={[
          s.hoopBox,
          { borderColor: hoopDetected ? Colors.primary : 'rgba(255,255,255,0.55)', opacity: hoopPulse },
        ]} />
        <Text style={[s.hoopLabel, hoopDetected && s.hoopLabelDetected, TS]}>
          {hoopDetected ? 'Hoop detected ✓' : 'Position the hoop inside the box'}
        </Text>
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

      {/* Streak pill — below X, tracking only */}
      {isTracking && (
        <View style={[s.streakWrap, { top: barY + 36 + 6, left: leftX }]}>
          <GlassPanel style={s.streakPill} borderRadius={999} tint="dark" intensity={55}>
            <View style={s.streakDot} />
            <Text style={[s.streakText, TS]}>{currentStreak}</Text>
          </GlassPanel>
        </View>
      )}

      {/* Camera flip — top-right */}
      <View style={[s.topRight, { top: barY, right: rightX }]}>
        <GlassPanel style={[s.flipBtn, isFlipping && { opacity: 0.5 }]} borderRadius={16} tint="dark" intensity={55}>
          <TouchableOpacity
            style={s.flipBtnInner}
            onPress={handleFlip}
            activeOpacity={0.8}
            disabled={isFlipping}
          >
            <RotateCw size={15} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
        </GlassPanel>
      </View>

      {/* Title / REC+timer */}
      <View style={[s.topCenter, { top: barY }]} pointerEvents="none">
        {!isTracking ? (
          <GlassPanel style={s.titlePill} borderRadius={999} tint="dark" intensity={55}>
            <Text style={[s.titleText, TS]}>Track Shots</Text>
          </GlassPanel>
        ) : (
          <GlassPanel style={s.timerPill} borderRadius={999} tint="dark" intensity={55}>
            <Animated.View style={[s.recDot, { opacity: recPulse }]} />
            <Text style={[s.recText, TS]}>REC</Text>
            <View style={s.timerSep} />
            <Text style={[s.timerText, TS]}>{formatTime(elapsed)}</Text>
          </GlassPanel>
        )}
      </View>

      {/* Hint card — bottom-center so it doesn't block hoop box */}
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
            <Text style={[s.hintTitle, TS]}>Hold horizontally</Text>
            <Text style={[s.hintSub, TS]}>Best tracking in landscape</Text>
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

      {/* ── Diagnostic overlay ───────────────────────────────────────────────── */}
      {diagOpen && !isTracking && (
        <View style={[s.diagPanel, { bottom: bottomY + BTN_H + 16, left: leftX }]}>
          <GlassPanel style={s.diagInner} borderRadius={14} tint="dark" intensity={65}>
            <TouchableOpacity style={s.diagClose} onPress={handleToggleDiag} hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}>
              <X size={11} color="rgba(255,255,255,0.5)" strokeWidth={2} />
            </TouchableOpacity>
            <Text style={s.diagTitle}>DETECTION DIAGNOSTIC</Text>
            <View style={s.diagRow}>
              <Text style={s.diagKey}>Model</Text>
              <Text style={[s.diagVal, { color: cameraReady ? Colors.primary : 'rgba(255,255,255,0.5)' }]}>
                {cameraReady ? '✓ ready' : 'loading…'}
              </Text>
            </View>
            <View style={s.diagRow}>
              <Text style={s.diagKey}>FPS</Text>
              <Text style={s.diagVal}>{diagData.fps.toFixed(1)}</Text>
            </View>
            <View style={s.diagRow}>
              <Text style={s.diagKey}>Last class</Text>
              <Text style={[s.diagVal, { color: diagData.class !== 'none' ? Colors.primary : 'rgba(255,255,255,0.4)' }]}>
                {diagData.class !== 'none'
                  ? `${diagData.class} ${(diagData.confidence * 100).toFixed(0)}%`
                  : 'none'}
              </Text>
            </View>
            <View style={s.diagRow}>
              <Text style={s.diagKey}>Frames</Text>
              <Text style={s.diagVal}>{diagData.framesAnalyzed}</Text>
            </View>
            <Text style={s.diagNote}>
              {cameraPosition === 'front' ? '⚠ Front cam: lower accuracy' : 'Back cam: best accuracy'}
            </Text>
          </GlassPanel>
        </View>
      )}

      {/* "Test detection" text button — bottom-left, idle only */}
      {!isTracking && (
        <TouchableOpacity
          style={[s.diagToggleBtn, { bottom: bottomY, left: leftX }]}
          onPress={handleToggleDiag}
          activeOpacity={0.7}
        >
          <Text style={[s.diagToggleText, diagOpen && s.diagToggleTextActive]}>
            {diagOpen ? 'Close diagnostic' : 'Test detection'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Stat dock — bottom right, tracking only */}
      {isTracking && (
        <View style={[s.dockWrap, { bottom: bottomY, right: rightX }]}>
          <GlassPanel style={s.dock} borderRadius={16} tint="dark" intensity={60}>
            <View style={s.dockRow}>
              <Text style={[s.dockMakes, TS]}>{liveMakes}</Text>
              <Text style={[s.dockSlash, TS]}>/</Text>
              <Text style={[s.dockTotal, TS]}>{liveTotal}</Text>
            </View>
            <View style={s.progressRow}>
              <View style={s.progressTrack}>
                {fgPct > 0 && <View style={[s.progressFill, { width: `${fgPct}%` as any }]} />}
              </View>
              <Text style={[s.progressPct, TS]}>{liveTotal > 0 ? `${fgPct}%` : '--'}</Text>
            </View>
            <View style={s.dotsRow}>
              {Array.from({ length: 10 }).map((_, i) => {
                const offset = 10 - recentShots.length;
                const shot   = i >= offset ? recentShots[i - offset] : null;
                return (
                  <View key={i} style={[s.dot, shot === 'make' ? s.dotMake : shot === 'miss' ? s.dotMiss : s.dotEmpty]} />
                );
              })}
            </View>
          </GlassPanel>
        </View>
      )}

      {/* Bottom 15-dot strip — tracking only */}
      {isTracking && (
        <View style={[s.bottomDotsWrap, { bottom: Math.max(safeInsets.bottom, 4) + 2 }]} pointerEvents="none">
          {Array.from({ length: 15 }).map((_, i) => {
            const offset = 15 - recentShots.length;
            const shot   = i >= offset ? recentShots[i - offset] : null;
            return (
              <View key={i} style={[s.bottomDot, shot === 'make' ? s.bottomDotMake : shot === 'miss' ? s.bottomDotMiss : s.bottomDotEmpty]} />
            );
          })}
        </View>
      )}

      {/* Start / Stop button */}
      <View style={[s.bottomWrap, { bottom: bottomY }]}>
        <Animated.View style={[s.btnSlot, { opacity: startOpacity }]} pointerEvents={isTracking ? 'none' : 'auto'}>
          <View style={{ opacity: hoopDetected ? 1 : 0.38 }}>
            <GlassPanel style={s.btn} borderRadius={26} tint="light" tintColor="rgba(201,162,74,0.35)" intensity={60}>
              <TouchableOpacity style={s.btnInner} onPress={handleStart} activeOpacity={0.85} disabled={!hoopDetected}>
                <Play size={18} color="#FFFFFF" fill="#FFFFFF" strokeWidth={1.8} />
                <Text style={[s.btnText, TS]}>Start Tracking</Text>
              </TouchableOpacity>
            </GlassPanel>
          </View>
        </Animated.View>

        <Animated.View style={[s.btnSlot, { opacity: stopOpacity }]} pointerEvents={isTracking ? 'auto' : 'none'}>
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
  topRight:  { position: 'absolute', zIndex: 30 },

  xBtn:      { width: 36, height: 36, overflow: 'hidden' },
  xBtnInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  flipBtn:      { width: 32, height: 32, overflow: 'hidden' },
  flipBtnInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  titlePill: { paddingHorizontal: 14, height: 30, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
  titleText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', letterSpacing: -0.1 },

  timerPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 30, overflow: 'hidden' },
  recDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30' },
  recText:   { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  timerSep:  { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.25)', marginHorizontal: 2 },
  timerText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', letterSpacing: 0.5, fontVariant: ['tabular-nums'] },

  streakWrap: { position: 'absolute', zIndex: 30 },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 26, overflow: 'hidden' },
  streakDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  streakText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', letterSpacing: -0.1, fontVariant: ['tabular-nums'] },

  hoopOverlayWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 15 },
  hoopBox: { width: '60%', aspectRatio: 3 / 2, borderWidth: 3, borderRadius: 10, borderColor: 'rgba(255,255,255,0.55)' },
  hoopLabel: { marginTop: 14, color: '#FFFFFF', fontSize: 13, fontWeight: '600', letterSpacing: -0.1, textAlign: 'center' },
  hoopLabelDetected: { color: Colors.primary },

  hintWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 120, zIndex: 20,
  },
  hintCard:  { maxWidth: 200, padding: 14, overflow: 'hidden' },
  hintX:     { position: 'absolute', top: 8, right: 8, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  hintTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', letterSpacing: -0.2, marginBottom: 3, marginRight: 14 },
  hintSub:   { color: 'rgba(255,255,255,0.70)', fontSize: 11, lineHeight: 16 },

  shotWrap: { position: 'absolute', zIndex: 30 },
  shotPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 28, overflow: 'hidden' },
  shotText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },

  glowContainer: { alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  glowCircle:    { width: 320, height: 320, borderRadius: 160 },
  glowIconWrap:  { alignItems: 'center', justifyContent: 'center' },

  // ── Diagnostic panel ─────────────────────────────────────────────────────────
  diagPanel: { position: 'absolute', zIndex: 40, minWidth: 180 },
  diagInner: { padding: 12, overflow: 'hidden', gap: 6 },
  diagClose: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  diagTitle: {
    fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, marginRight: 14,
  },
  diagRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  diagKey:  { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  diagVal:  { fontSize: 12, color: '#FFFFFF', fontWeight: '600', fontVariant: ['tabular-nums'] },
  diagNote: { fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 4 },

  diagToggleBtn:     { position: 'absolute', zIndex: 30, paddingVertical: 8 },
  diagToggleText:    { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '500' },
  diagToggleTextActive: { color: Colors.primary },

  dockWrap: { position: 'absolute', zIndex: 30 },
  dock: { width: 136, paddingHorizontal: 12, paddingVertical: 10, gap: 7, overflow: 'hidden' },
  dockRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  dockMakes: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', letterSpacing: -1, lineHeight: 36, fontVariant: ['tabular-nums'] },
  dockSlash: { color: 'rgba(255,255,255,0.4)', fontSize: 18, fontWeight: '400', lineHeight: 22 },
  dockTotal: { color: 'rgba(255,255,255,0.75)', fontSize: 20, fontWeight: '600', letterSpacing: -0.5, lineHeight: 24, fontVariant: ['tabular-nums'] },

  progressRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressTrack: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: 3, backgroundColor: Colors.primary, borderRadius: 2 },
  progressPct:   { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 26, textAlign: 'right' },

  dotsRow:  { flexDirection: 'row', gap: 3, alignItems: 'center' },
  dot:      { width: 6, height: 6, borderRadius: 3 },
  dotMake:  { backgroundColor: Colors.primary },
  dotMiss:  { backgroundColor: 'rgba(255,255,255,0.35)' },
  dotEmpty: { backgroundColor: 'rgba(255,255,255,0.09)' },

  bottomDotsWrap:  { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, zIndex: 25 },
  bottomDot:       { width: 5, height: 5, borderRadius: 2.5 },
  bottomDotMake:   { backgroundColor: Colors.primary },
  bottomDotMiss:   { backgroundColor: 'rgba(255,255,255,0.35)' },
  bottomDotEmpty:  { backgroundColor: 'rgba(255,255,255,0.08)' },

  bottomWrap: { position: 'absolute', left: 0, right: 0, height: BTN_H, alignItems: 'center', zIndex: 30 },
  btnSlot:    { position: 'absolute', width: BTN_W, height: BTN_H, top: 0 },
  btn:        { width: BTN_W, height: BTN_H, overflow: 'hidden' },
  btnInner:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText:    { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
});
