// expo/app/session.tsx
// Main session screen — runs through all drills for the current day.
//
// Setup overlay strategy:
//   - On mount, check current orientation
//   - If landscape: skip setup, go straight to countdown
//   - If portrait: show rotate-phone overlay until user rotates
//   - Mid-session: if user flips to portrait, overlay reappears, timer pauses
//   - When they flip back to landscape, overlay dismisses, timer resumes
//
// Exit button is always available — in HUD during drill, floating during
// countdowns/demo, top-right of the setup overlay.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';
import SessionSetupOverlay from '@/components/SessionSetupOverlay';
import CountdownOverlay from '@/components/CountdownOverlay';
import DemoVideoPip from '@/components/DemoVideoPip';
import SessionHUD from '@/components/SessionHUD';

// ===== Demo video pool =====
const DEMO_VIDEO_MAP: Record<string, string> = {
  'pound dribble':   'https://www.youtube.com/watch?v=h6QSiJqQwGM',
  'crossover':       'https://www.youtube.com/watch?v=L_QrSxKpWko',
  'form shooting':   'https://www.youtube.com/watch?v=lGTtSILQGnE',
  'mikan':           'https://www.youtube.com/watch?v=AGtZsv0LJEU',
  'defensive slide': 'https://www.youtube.com/watch?v=oyJ3-7PqAg0',
  'finishing':       'https://www.youtube.com/watch?v=lGTtSILQGnE',
  'pull-up':         'https://www.youtube.com/watch?v=4Cd7B5MoxYI',
  'catch and shoot': 'https://www.youtube.com/watch?v=lGTtSILQGnE',
  'free throw':      'https://www.youtube.com/watch?v=lGTtSILQGnE',
  'tennis ball':     'https://www.youtube.com/watch?v=PqDIANpQ_VY',
  'two-ball':        'https://www.youtube.com/watch?v=PqDIANpQ_VY',
  'suicide':         'https://www.youtube.com/watch?v=BSjBkLNHrTk',
  'conditioning':    'https://www.youtube.com/watch?v=BSjBkLNHrTk',
  'warm-up':         'https://www.youtube.com/watch?v=jpqYBQDH_C8',
  'dynamic warm':    'https://www.youtube.com/watch?v=jpqYBQDH_C8',
};
const DEFAULT_DEMO = 'https://www.youtube.com/watch?v=lGTtSILQGnE';

type Phase =
  | 'waiting-landscape' // initial check or portrait detected — show setup overlay
  | 'countdown-watch'
  | 'demo-fullscreen'
  | 'countdown-go'
  | 'active'
  | 'complete';

function isLandscapeOrientation(o: ScreenOrientation.Orientation): boolean {
  return (
    o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
    o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
  );
}

export default function SessionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, currentDayIndex, toggleDrillComplete } = usePlanStore();

  const day = plan?.days?.[currentDayIndex];
  const resolvedDrills = useMemo(
    () => (day?.drills || [])
      .map(d => resolvePlanDrill(d))
      .filter(Boolean) as NonNullable<ReturnType<typeof resolvePlanDrill>>[],
    [day]
  );

  const [drillIdx, setDrillIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('waiting-landscape');
  // Was the user shown setup at least once?  Used to know if it's "initial"
  // setup vs mid-session portrait warning.
  const [hasShownInitialSetup, setHasShownInitialSetup] = useState(false);

  // Drill timer state
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeTotal, setTimeTotal] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasPausedByPortrait = useRef(false);

  // Track which phase we were in before portrait detection
  const phaseBeforePortrait = useRef<Phase | null>(null);

  const sessionStartRef = useRef<number>(Date.now());
  const currentDrill = resolvedDrills[drillIdx];

  // ===== Orientation: check on mount, listen for changes =====

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        const current = await ScreenOrientation.getOrientationAsync();
        if (!mounted) return;
        if (isLandscapeOrientation(current)) {
          // Already landscape — skip the rotate-phone overlay
          setPhase('countdown-watch');
          setHasShownInitialSetup(true);
        } else {
          // Portrait — show the rotate-phone screen
          setPhase('waiting-landscape');
        }
      } catch {
        // If locking fails, fall back to portrait detection at least
      }
    };
    init();

    const sub = ScreenOrientation.addOrientationChangeListener((evt) => {
      if (!mounted) return;
      const isLandscape = isLandscapeOrientation(evt.orientationInfo.orientation);

      if (!isLandscape) {
        // Rotated to portrait
        if (phase !== 'waiting-landscape' && phase !== 'complete') {
          phaseBeforePortrait.current = phase;
          if (phase === 'active' && timerRef.current) {
            pauseTimer();
            wasPausedByPortrait.current = true;
          }
          setPhase('waiting-landscape');
        }
      } else {
        // Rotated to landscape — auto-resume if we were paused by portrait
        if (phase === 'waiting-landscape' && hasShownInitialSetup && phaseBeforePortrait.current) {
          const prevPhase = phaseBeforePortrait.current;
          phaseBeforePortrait.current = null;
          setPhase(prevPhase);
          if (wasPausedByPortrait.current && prevPhase === 'active') {
            resumeTimer();
            wasPausedByPortrait.current = false;
          }
        }
      }
    });

    return () => {
      mounted = false;
      ScreenOrientation.removeOrientationChangeListener(sub);
      ScreenOrientation.unlockAsync().catch(() => {});
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hasShownInitialSetup]);

  // ===== Timer =====

  const startTimer = (seconds: number) => {
    setTimeTotal(seconds);
    setTimeRemaining(seconds);
    setIsPaused(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          onDrillTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const pauseTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPaused(true);
  };

  const resumeTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsPaused(false);
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          onDrillTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const togglePause = () => {
    if (isPaused) resumeTimer();
    else pauseTimer();
  };

  // ===== Phase transitions =====

  const onSetupReady = () => {
    setHasShownInitialSetup(true);
    setPhase('countdown-watch');
  };

  const onWatchDone    = () => setPhase('demo-fullscreen');
  const onDemoComplete = () => setPhase('countdown-go');
  const onGoDone = () => {
    const totalSec = drillDurationToSeconds(currentDrill?.time);
    startTimer(totalSec);
    setPhase('active');
  };

  const onDrillTimeUp = () => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toggleDrillComplete(currentDayIndex + '-' + drillIdx);
    if (drillIdx + 1 < resolvedDrills.length) {
      setDrillIdx(prev => prev + 1);
      setPhase('countdown-watch');
    } else {
      setPhase('complete');
    }
  };

  const onExit = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (timerRef.current) clearInterval(timerRef.current);
    ScreenOrientation.unlockAsync().catch(() => {});
    router.back();
  };

  // ===== Computed values =====

  const sessionPctComplete = useMemo(() => {
    if (resolvedDrills.length === 0) return 0;
    const completed = drillIdx + (phase === 'active' && timeTotal > 0
      ? (1 - timeRemaining / timeTotal)
      : 0);
    return Math.min(100, (completed / resolvedDrills.length) * 100);
  }, [drillIdx, timeRemaining, timeTotal, phase, resolvedDrills.length]);

  const sessionTimeLabel = useMemo(() => {
    const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [timeRemaining]);

  const demoUrl = useMemo(() => {
    if (!currentDrill?.name) return DEFAULT_DEMO;
    const lower = currentDrill.name.toLowerCase();
    for (const [key, url] of Object.entries(DEMO_VIDEO_MAP)) {
      if (lower.includes(key)) return url;
    }
    return DEFAULT_DEMO;
  }, [currentDrill]);

  // Determine if we should show the setup overlay
  const isPortraitWarning = phase === 'waiting-landscape' && hasShownInitialSetup;
  const isInitialSetup    = phase === 'waiting-landscape' && !hasShownInitialSetup;

  // ===== Render =====

  if (!plan || !day) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.emptyText}>No plan loaded.</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={onExit} activeOpacity={0.8}>
          <Text style={styles.emptyBtnText}>Back home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (resolvedDrills.length === 0) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.emptyText}>No drills in today's workout.</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={onExit} activeOpacity={0.8}>
          <Text style={styles.emptyBtnText}>Back home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'complete') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.completeWrap}>
          <Text style={styles.completeTag}>SESSION COMPLETE</Text>
          <Text style={styles.completeTitle}>Work in.</Text>
          <Text style={styles.completeSub}>
            {resolvedDrills.length} drills · Day {currentDayIndex + 1} of {plan.days.length}
          </Text>
          <TouchableOpacity style={styles.completeBtn} onPress={onExit} activeOpacity={0.85}>
            <Text style={styles.completeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Camera placeholder */}
      <LinearGradient
        colors={['#1a1a1a', '#0a0a0a']}
        style={StyleSheet.absoluteFill}
      />

      {/* Floating exit during countdowns + demo */}
      {(phase === 'countdown-watch' || phase === 'demo-fullscreen' || phase === 'countdown-go') && (
        <TouchableOpacity
          style={styles.floatingExitBtn}
          onPress={onExit}
          activeOpacity={0.7}
          hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
        >
          <X size={18} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Demo video */}
      {(phase === 'demo-fullscreen' || phase === 'countdown-go' || phase === 'active') && (
        <DemoVideoPip
          videoUrl={demoUrl}
          isFullscreen={phase === 'demo-fullscreen'}
          onDemoComplete={onDemoComplete}
        />
      )}

      {/* HUD during active drill */}
      {phase === 'active' && (
        <SessionHUD
          drillName={currentDrill?.name || 'Drill'}
          timeRemainingSec={timeRemaining}
          timeTotalSec={timeTotal}
          drillIndex={drillIdx}
          totalDrills={resolvedDrills.length}
          sessionPctComplete={sessionPctComplete}
          sessionTimeLabel={sessionTimeLabel}
          isPaused={isPaused}
          onTogglePause={togglePause}
          onExit={onExit}
        />
      )}

      {/* Countdowns */}
      {phase === 'countdown-watch' && (
        <CountdownOverlay
          finalLabel="WATCH"
          contextLabel={`DRILL ${drillIdx + 1} OF ${resolvedDrills.length}`}
          onComplete={onWatchDone}
        />
      )}
      {phase === 'countdown-go' && (
        <CountdownOverlay
          finalLabel="GO"
          contextLabel={currentDrill?.name?.toUpperCase()}
          onComplete={onGoDone}
        />
      )}

      {/* Setup overlay */}
      {(isInitialSetup || isPortraitWarning) && (
        <SessionSetupOverlay
          isInitialSetup={isInitialSetup}
          isPortraitWarning={isPortraitWarning}
          onReady={onSetupReady}
          onExit={onExit}
        />
      )}
    </View>
  );
}

// ===== Helpers =====

function drillDurationToSeconds(timeStr?: string): number {
  if (!timeStr) return 60;
  const m = timeStr.match(/(\d+)\s*min/i);
  if (m) return parseInt(m[1], 10) * 60;
  const s = timeStr.match(/(\d+)\s*sec/i);
  if (s) return parseInt(s[1], 10);
  const plain = parseInt(timeStr, 10);
  return isNaN(plain) ? 60 : plain * 60;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  emptyText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
    paddingHorizontal: 24,
  },
  emptyBtn: {
    alignSelf: 'center',
    marginTop: 20,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
  },
  emptyBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },

  floatingExitBtn: {
    position: 'absolute',
    top: 30,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 950,
  },

  completeWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  completeTag: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 2,
    marginBottom: 10,
  },
  completeTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    marginBottom: 6,
  },
  completeSub: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 32,
  },
  completeBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 100,
  },
  completeBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
});
