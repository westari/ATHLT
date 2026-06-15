/**
 * Open Run — Track Shots screen.
 * Landscape-locked. Camera preview + shot tracking via ATHLTCamera native module.
 * Route: /open-run
 *
 * Flow:
 *   mount → detection mode (hoop seeking) → user aligns hoop → Start enabled
 *   Start → tracking mode → shots counted → Stop → recap
 *
 * Orientation:
 *   Locks landscape on focus. Restores portrait on blur (useFocusEffect cleanup)
 *   so the rest of the app is never stuck in landscape.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Animated, Dimensions,
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
import type { HoopDetectedEvent, DetectionDebugEvent, DebugStatsEvent, ModelLoadStatusEvent } from '@/modules/athlt-camera/src/index';
import {
  flipCamera, setDiagnosticMode, addDetectionDebugListener,
  setManualHoopRegion, addDebugStatsListener, addModelLoadStatusListener,
} from '@/modules/athlt-camera/src/index';
import { CVSessionSync, type SessionRecap } from '@/lib/cv/ShotSync';
import { supabase } from '@/constants/supabase';
import Colors from '@/constants/colors';

const TS = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

// Normalized hoop bbox size used for manual tap-to-mark.
// 12% wide × 7% tall — reasonable for a hoop at shooting distance.
const MANUAL_HOOP_W = 0.12;
const MANUAL_HOOP_H = 0.07;

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
  const [allShots, setAllShots]         = useState<ShotType[]>([]);
  const [glowType, setGlowType]         = useState<ShotType>('make');
  const [elapsed, setElapsed]           = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [hoopDetected, setHoopDetected] = useState(false);
  const [cameraReady, setCameraReady]   = useState(false);

  // ── Camera flip ─────────────────────────────────────────────────────────────
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');
  const [isFlipping, setIsFlipping]         = useState(false);

  // ── Diagnostic mode ─────────────────────────────────────────────────────────
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagData, setDiagData] = useState<DetectionDebugEvent>({
    class: 'none', confidence: 0, framesAnalyzed: 0, fps: 0,
  });

  // ── Tap-to-mark hoop fallback ────────────────────────────────────────────────
  const [manualMark, setManualMark]         = useState<{ sx: number; sy: number } | null>(null);
  const [showManualHint, setShowManualHint] = useState(false);

  // ── Debug panel ──────────────────────────────────────────────────────────────
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugStats, setDebugStats]     = useState<DebugStatsEvent>({
    totalBallDetections: 0, totalHoopDetections: 0,
    peakBallConf: 0, peakHoopConf: 0,
    ballX: -1, ballY: -1,
    hoopLocked: false, hoopX: -1, hoopY: -1, hoopW: 0, hoopH: 0,
    inFlight: false, makes: 0, attempts: 0,
    totalFramesReceived: 0, totalFramesAnalyzed: 0, lastRawObsClass: 'none', lastRawObsConf: 0,
    scoringState: 'idle — no hoop', lastShotPath: 'none',
    netInterspersion: 0, netMotion: 0, makeConfidence: 0,
  });
  const [modelStatus, setModelStatus] = useState<ModelLoadStatusEvent | null>(null);

  const sync = useMemo(() => new CVSessionSync(), []);

  const makesRef        = useRef(0);
  const totalRef        = useRef(0);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number>(0);

  // ── BUG FIX 1: Orientation — lock landscape on focus, restore portrait on blur ──
  // Previously the cleanup was empty, leaving the whole app stuck in landscape
  // after the user left the screen without starting a session.
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      return () => {
        // Runs when screen loses focus for ANY reason: back, tab switch, background.
        // handleStop also calls this before navigating to recap — double-call is a no-op.
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      };
    }, [])
  );

  // ── BUG FIX 2 (part): Show manual-mark hint after 5s if hoop not auto-detected ──
  useEffect(() => {
    if (hoopDetected || phase !== 'idle' || !cameraReady) return;
    const t = setTimeout(() => setShowManualHint(true), 5000);
    return () => clearTimeout(t);
  }, [hoopDetected, phase, cameraReady]);

  // Hide manual hint once hoop is confirmed (auto or manual)
  useEffect(() => {
    if (hoopDetected) setShowManualHint(false);
  }, [hoopDetected]);

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

  // ── Diagnostic ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!diagOpen) return;
    const sub = addDetectionDebugListener(event => setDiagData(event));
    return () => sub.remove();
  }, [diagOpen]);

  useEffect(() => {
    setDiagnosticMode(diagOpen).catch(() => {});
  }, [diagOpen]);

  // ── Debug stats subscription — always active (emitted in detection + tracking)
  useEffect(() => {
    const sub = addDebugStatsListener(e => setDebugStats(e));
    return () => sub.remove();
  }, []);

  // ── Model load status — fires once when loadModel() completes ────────────────
  useEffect(() => {
    const sub = addModelLoadStatusListener(e => setModelStatus(e));
    return () => sub.remove();
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
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

  // ── BUG FIX 2: Tap-to-mark hoop ─────────────────────────────────────────────
  // The tap catcher sits below the UI overlays (zIndex 8). When the user taps
  // anywhere on the camera view, we normalize the tap coordinates, create a
  // hoop bbox centered on the tap, and pass it to the native pipeline.
  const handleCameraAreaTap = useCallback((e: any) => {
    if (hoopDetected || isTracking) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const { locationX, locationY } = e.nativeEvent;
    const { width: sw, height: sh } = Dimensions.get('window');

    // Normalize to 0-1, top-left origin (matches pipeline convention)
    const normX = locationX / sw;
    const normY = locationY / sh;

    // Center the hoop bbox on the tap point, clamped to valid range
    const bx = Math.max(0, Math.min(1 - MANUAL_HOOP_W, normX - MANUAL_HOOP_W / 2));
    const by = Math.max(0, Math.min(1 - MANUAL_HOOP_H, normY - MANUAL_HOOP_H / 2));

    // Record screen coords for the visual marker (before normalization)
    setManualMark({ sx: locationX, sy: locationY });

    // Send to native pipeline — overrides any existing auto-detected hoop
    setManualHoopRegion(bx, by, MANUAL_HOOP_W, MANUAL_HOOP_H).catch(err =>
      console.warn('[open-run] setManualHoopRegion error:', err)
    );

    // Enable Start Tracking
    setHoopDetected(true);
  }, [hoopDetected, isTracking]);  // eslint-disable-line react-hooks/exhaustive-deps
  // isTracking is derived from phase — included explicitly

  // ── Hoop auto-detected ───────────────────────────────────────────────────────
  const handleHoopDetected = useCallback((event: HoopDetectedEvent) => {
    if (event.detected) setHoopDetected(true);
  }, []);

  // ── Reset hoop lock — clears JS state; native pipeline re-accumulates on its own ─
  const handleResetHoop = useCallback(() => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHoopDetected(false);
    setManualMark(null);
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
    catch (e) { console.warn('[open-run] sync.start error:', e); }
  };

  // ── Stop ─────────────────────────────────────────────────────────────────────
  const handleStop = async () => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.timing(btnPhase, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    setPhase('finishing');
    setRecapLoading(true);

    // Portrait lock here and in useFocusEffect cleanup — both are safe to call.
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});

    try {
      let userId: string | undefined;
      try { userId = (await supabase.auth.getUser()).data?.user?.id ?? undefined; } catch {}

      const summary = buildNativeSummary(makesRef.current, totalRef.current);
      const sessionRecap = await sync.finish(summary as any, userId);
      setRecap(sessionRecap);
    } catch (e) {
      console.warn('[open-run] stop error:', e);
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

  // Convert normalized hoop bbox → screen pixel rect for the visual overlay.
  // Direct mapping (normX * screenW) is a reasonable approximation when the
  // camera preview fills the screen in landscape mode.
  const { width: screenW, height: screenH } = Dimensions.get('window');
  const hoopScreenPos = debugStats.hoopLocked && debugStats.hoopX >= 0 ? {
    left:   debugStats.hoopX * screenW,
    top:    debugStats.hoopY * screenH,
    width:  debugStats.hoopW * screenW,
    height: debugStats.hoopH * screenH,
  } : null;

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

      {/* ── BUG FIX 2: Tap catcher for manual hoop marking ─────────────────────
          Sits below overlays (zIndex 8). The hoop overlay above has
          pointerEvents="none" so taps pass through to this element.
          Only active in idle mode before hoop is confirmed. */}
      {!isTracking && !hoopDetected && (
        <TouchableOpacity
          style={s.tapCatcher}
          onPress={handleCameraAreaTap}
          activeOpacity={1}
        />
      )}

      {/* Manual hoop marker — gold ring at the tap point */}
      {manualMark && !isTracking && (
        <View
          style={[s.manualMark, { left: manualMark.sx - 14, top: manualMark.sy - 14 }]}
          pointerEvents="none"
        />
      )}

      {/* Locked hoop position — gold border at actual hoop coordinates.
          Visible in both idle and tracking modes so user can trust what's locked. */}
      {hoopScreenPos && (
        <View
          style={[s.hoopLockOverlay, {
            left:        hoopScreenPos.left,
            top:         hoopScreenPos.top,
            width:       hoopScreenPos.width,
            height:      hoopScreenPos.height,
            borderColor: manualMark ? '#B8A060' : Colors.primary,
          }]}
          pointerEvents="none"
        >
          <Text style={[s.hoopLockLabel, { color: manualMark ? '#B8A060' : Colors.primary }]}>
            HOOP
          </Text>
        </View>
      )}

      {/* Center glow on shot */}
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
        <View style={[s.hoopLabelPill, hoopDetected && s.hoopLabelPillDetected]}>
          <Text style={[s.hoopLabel, hoopDetected && s.hoopLabelDetected, TS]}>
            {hoopDetected
              ? (manualMark ? 'Hoop marked ✓' : 'Hoop detected ✓')
              : 'Point at the hoop or tap to set it'}
          </Text>
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

      {/* Reset hoop — below X, idle mode only, when hoop is locked */}
      {hoopDetected && !isTracking && (
        <View style={[s.resetHoopWrap, { top: barY + 36 + 6, left: leftX }]}>
          <TouchableOpacity style={s.resetHoopBtn} onPress={handleResetHoop} activeOpacity={0.8}>
            <Text style={s.resetHoopText}>Reset hoop</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Streak pill — below X, tracking only */}
      {isTracking && (
        <View style={[s.streakWrap, { top: barY + 36 + 6, left: leftX }]}>
          <GlassPanel style={s.streakPill} borderRadius={999} tint="dark" intensity={55}>
            <View style={s.streakDot} />
            <Text style={[s.streakText, TS]}>{currentStreak}</Text>
          </GlassPanel>
        </View>
      )}

      {/* Debug panel — visible in detection + tracking when DBG toggled */}
      {(isTracking || phase === 'idle') && debugVisible && (
        <View style={[s.dbgPanel, { top: barY + 36 + 6 + 26 + 8, left: leftX }]}>
          <GlassPanel style={s.dbgInner} borderRadius={10} tint="dark" intensity={70}>
            <Text style={s.dbgLine}>
              <Text style={s.dbgKey}>Balls </Text>
              <Text style={s.dbgVal}>{debugStats.totalBallDetections}</Text>
              <Text style={s.dbgKey}>  Pk </Text>
              <Text style={s.dbgVal}>{debugStats.peakBallConf.toFixed(2)}</Text>
            </Text>
            <Text style={s.dbgLine}>
              <Text style={s.dbgKey}>Hoops </Text>
              <Text style={s.dbgVal}>{debugStats.totalHoopDetections}</Text>
              <Text style={s.dbgKey}>  Pk </Text>
              <Text style={s.dbgVal}>{debugStats.peakHoopConf.toFixed(2)}</Text>
            </Text>
            <Text style={s.dbgLine}>
              <Text style={s.dbgKey}>Ball  </Text>
              <Text style={s.dbgVal}>
                {debugStats.ballX >= 0
                  ? `${debugStats.ballX.toFixed(2)}, ${debugStats.ballY.toFixed(2)}`
                  : 'none'}
              </Text>
            </Text>
            <Text style={s.dbgLine}>
              <Text style={s.dbgKey}>Hoop  </Text>
              <Text style={[s.dbgVal, { color: debugStats.hoopLocked ? Colors.primary : 'rgba(255,255,255,0.45)' }]}>
                {debugStats.hoopLocked
                  ? `${debugStats.hoopX.toFixed(2)}, ${debugStats.hoopY.toFixed(2)}`
                  : 'unlocked'}
              </Text>
            </Text>
            <Text style={s.dbgLine}>
              <Text style={s.dbgKey}>Shot  </Text>
              <Text style={[s.dbgVal, { color: debugStats.inFlight ? Colors.primary : 'rgba(255,255,255,0.6)' }]}>
                {debugStats.inFlight ? 'IN FLIGHT' : 'idle'}
              </Text>
              <Text style={s.dbgKey}>  </Text>
              <Text style={s.dbgVal}>{debugStats.makes}/{debugStats.attempts}</Text>
            </Text>
            <Text style={s.dbgLine}>
              <Text style={s.dbgKey}>Recv  </Text>
              <Text style={[s.dbgVal, { color: debugStats.totalFramesReceived > 0 ? '#FFFFFF' : '#FF3B30' }]}>
                {debugStats.totalFramesReceived}
              </Text>
              <Text style={s.dbgKey}>{'  '}Infrd </Text>
              <Text style={[s.dbgVal, { color: debugStats.totalFramesAnalyzed > 0 ? '#FFFFFF' : '#FF3B30' }]}>
                {debugStats.totalFramesAnalyzed}
              </Text>
            </Text>
            <Text style={s.dbgLine}>
              <Text style={s.dbgKey}>Raw   </Text>
              <Text style={[s.dbgVal, { color: debugStats.lastRawObsClass !== 'none' ? Colors.primary : 'rgba(255,255,255,0.35)' }]}>
                {debugStats.lastRawObsClass !== 'none'
                  ? `${debugStats.lastRawObsClass} ${(debugStats.lastRawObsConf * 100).toFixed(0)}%`
                  : 'none'}
              </Text>
            </Text>
            <Text style={s.dbgLine}>
              <Text style={s.dbgKey}>State </Text>
              <Text style={[s.dbgVal, { color: Colors.primary }]}>{debugStats.scoringState}</Text>
            </Text>
            <Text style={s.dbgLine}>
              <Text style={s.dbgKey}>Path  </Text>
              <Text style={[s.dbgVal, { color: Colors.primary }]}>{debugStats.lastShotPath}</Text>
            </Text>
            <Text style={s.dbgLine}>
              <Text style={s.dbgKey}>Net   </Text>
              <Text style={[s.dbgVal, { color: debugStats.netInterspersion > 0.10 ? Colors.primary : 'rgba(255,255,255,0.45)' }]}>
                {`I=${debugStats.netInterspersion.toFixed(2)} M=${debugStats.netMotion.toFixed(2)} conf=${debugStats.makeConfidence.toFixed(2)}`}
              </Text>
            </Text>
          </GlassPanel>
        </View>
      )}

      {/* Camera flip — top-right */}
      <View style={[s.topRight, { top: barY, right: rightX }]}>
        <GlassPanel style={[s.flipBtn, isFlipping && { opacity: 0.5 }]} borderRadius={16} tint="dark" intensity={55}>
          <TouchableOpacity style={s.flipBtnInner} onPress={handleFlip} activeOpacity={0.8} disabled={isFlipping}>
            <RotateCw size={15} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
        </GlassPanel>
      </View>

      {/* DBG toggle — below flip button, visible in detection + tracking modes */}
      {(isTracking || phase === 'idle') && (
        <TouchableOpacity
          style={[s.dbgToggle, { top: barY + 32 + 6, right: rightX + 2 }]}
          onPress={() => setDebugVisible(v => !v)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, left: 10, right: 8, bottom: 8 }}
        >
          <Text style={[s.dbgToggleText, debugVisible && s.dbgToggleTextActive]}>DBG</Text>
        </TouchableOpacity>
      )}

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

      {/* Hint card */}
      {showHint && !isTracking && (
        <Animated.View style={[s.hintWrap, { opacity: hintFade }]} pointerEvents="box-none">
          <GlassPanel style={s.hintCard} borderRadius={18} tint="dark" intensity={55}>
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

      {/* Last shot pill */}
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

      {/* Diagnostic overlay */}
      {diagOpen && !isTracking && (
        <View style={[s.diagPanel, { bottom: bottomY + BTN_H + 16, left: leftX }]}>
          <GlassPanel style={s.diagInner} borderRadius={14} tint="dark" intensity={65}>
            <TouchableOpacity style={s.diagClose} onPress={handleToggleDiag} hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}>
              <X size={11} color="rgba(255,255,255,0.5)" strokeWidth={2} />
            </TouchableOpacity>
            <Text style={s.diagTitle}>DETECTION DIAGNOSTIC</Text>
            <View style={s.diagRow}>
              <Text style={s.diagKey}>Model</Text>
              <Text style={[s.diagVal, {
                color: modelStatus
                  ? (modelStatus.loaded ? Colors.primary : '#FF3B30')
                  : (cameraReady ? Colors.primary : 'rgba(255,255,255,0.5)'),
              }]}>
                {modelStatus
                  ? (modelStatus.loaded ? `✓ ${modelStatus.modelPath}` : `✗ ${modelStatus.error ?? 'failed'}`)
                  : (cameraReady ? '✓ ready' : 'loading…')}
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

      {/* "Test detection" text button — idle only */}
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
            <GlassPanel style={s.btn} borderRadius={26} tint="dark" tintColor="rgba(201,162,74,0.40)" intensity={60}>
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

  // ── Tap-to-mark hoop ─────────────────────────────────────────────────────────
  // zIndex 8 — sits below UI overlays (zIndex 15+) but above camera (zIndex 0).
  // Hoop overlay has pointerEvents="none" so taps pass through to this element.
  tapCatcher: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
  },
  // Gold ring drawn at the user's tap point
  manualMark: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 3, borderColor: Colors.primary,
    backgroundColor: 'rgba(201,162,74,0.22)',
    zIndex: 40,
  },

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
  hoopBox:          { width: '60%', aspectRatio: 3 / 2, borderWidth: 3, borderRadius: 10, borderColor: 'rgba(255,255,255,0.55)' },
  hoopLabelPill:    { marginTop: 14, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 10 },
  hoopLabelPillDetected: { backgroundColor: 'rgba(0,0,0,0.30)' },
  hoopLabel:        { color: '#FFFFFF', fontSize: 15, fontWeight: '600', letterSpacing: -0.1, textAlign: 'center' },
  hoopLabelDetected:{ color: Colors.primary },
  manualHintText:   { marginTop: 6, color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '400', letterSpacing: -0.1, textAlign: 'center' },

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

  diagToggleBtn:        { position: 'absolute', zIndex: 30, paddingVertical: 8 },
  diagToggleText:       { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '500' },
  diagToggleTextActive: { color: Colors.primary },

  // ── Model status banner ───────────────────────────────────────────────────────
  modelBanner: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', zIndex: 50,
  },
  modelBannerText: {
    fontSize: 9, fontWeight: '600', letterSpacing: 0.3, opacity: 0.75,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  // ── Debug stats panel ─────────────────────────────────────────────────────────
  dbgToggle:          { position: 'absolute', zIndex: 30 },
  dbgToggleText:      { color: 'rgba(255,255,255,0.28)', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  dbgToggleTextActive:{ color: Colors.primary },

  dbgPanel: { position: 'absolute', zIndex: 35 },
  dbgInner: { paddingHorizontal: 10, paddingVertical: 8, overflow: 'hidden', gap: 2, minWidth: 160 },
  dbgLine:  { fontSize: 10, lineHeight: 16 },
  dbgKey:   { color: 'rgba(255,255,255,0.40)', fontWeight: '500' },
  dbgVal:   { color: '#FFFFFF', fontWeight: '600', fontVariant: ['tabular-nums'] },

  dockWrap: { position: 'absolute', zIndex: 30 },
  dock: { width: 136, paddingHorizontal: 12, paddingVertical: 10, gap: 7, overflow: 'hidden' },
  dockRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  dockMakes: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', letterSpacing: -1, lineHeight: 36, fontVariant: ['tabular-nums'] },
  dockSlash: { color: 'rgba(255,255,255,0.4)', fontSize: 18, fontWeight: '400', lineHeight: 22 },
  dockTotal: { color: 'rgba(255,255,255,0.75)', fontSize: 20, fontWeight: '600', letterSpacing: -0.5, lineHeight: 24, fontVariant: ['tabular-nums'] },

  progressRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressTrack: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: 3, backgroundColor: Colors.primary, borderRadius: 2 },
  progressPct:   { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 26, textAlign: 'right' },

  dotsRow:  { flexDirection: 'row', gap: 3, alignItems: 'center' },
  dot:      { width: 6, height: 6, borderRadius: 3 },
  dotMake:  { backgroundColor: Colors.primary },
  dotMiss:  { backgroundColor: 'rgba(255,255,255,0.35)' },
  dotEmpty: { backgroundColor: 'rgba(255,255,255,0.09)' },

  bottomDotsWrap: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, zIndex: 25 },
  bottomDot:      { width: 5, height: 5, borderRadius: 2.5 },
  bottomDotMake:  { backgroundColor: Colors.primary },
  bottomDotMiss:  { backgroundColor: 'rgba(255,255,255,0.35)' },
  bottomDotEmpty: { backgroundColor: 'rgba(255,255,255,0.08)' },

  // ── Locked hoop position overlay ─────────────────────────────────────────────
  hoopLockOverlay: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 6,
    zIndex: 16,
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 2,
  },
  hoopLockLabel: {
    fontSize: 8,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
  },

  // ── Reset hoop button ─────────────────────────────────────────────────────────
  resetHoopWrap: { position: 'absolute', zIndex: 30 },
  resetHoopBtn: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetHoopText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' as const, letterSpacing: -0.1 },

  bottomWrap: { position: 'absolute', left: 0, right: 0, height: BTN_H, alignItems: 'center', zIndex: 30 },
  btnSlot:    { position: 'absolute', width: BTN_W, height: BTN_H, top: 0 },
  btn:        { width: BTN_W, height: BTN_H, overflow: 'hidden' },
  btnInner:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText:    { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
});
