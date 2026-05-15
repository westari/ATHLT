// expo/app/session.tsx
// Session screen — phone orientation drives the overlay.
//
// Rule: If phone is PORTRAIT → show "Rotate phone" overlay (auto-dismisses
// when rotated to landscape). If phone is LANDSCAPE → run the session.
// No "I'm ready" button, no setup instructions. The phone IS the trigger.
//
// Phases (only while in landscape):
//   1. countdown-watch (3-2-1 WATCH)
//   2. demo-fullscreen (YouTube demo plays)
//   3. countdown-go (demo shrinks to PIP, 3-2-1 GO)
//   4. active (drill timer with HUD)
//   5. complete (session done)
//
// If user rotates to portrait at any point, the rotate-phone overlay
// appears and the timer pauses. On rotate back to landscape, the overlay
// auto-dismisses and the previous state resumes.

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
  const [phase, setPhase] = useState<Phase>('countdown-watch');
  const [isLandscape, setIsLandscape] = useState(true);

  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeTotal, setTimeTotal] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasPausedByPortrait = useRef(false);

  const sessionStartRef = useRef<number>(Date.now());
  const currentDrill = resolvedDrills[drillIdx];

  // ===== Orientation =====

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        const current = await ScreenOrientation.getOrientationAsync();
        if (mounted) setIsLandscape(isLandscapeOrientation(current));
      } catch {
        // ignore
      }
    })();

    const sub = ScreenOrientation.addOrientationChangeListener((evt) => {
      if (!mounted) return;
      const landscape = isLandscapeOrientation(evt.orientationInfo.orientation);
      setIsLandscape(landscape);

      if (!landscape && phase === 'active' && timerRef.current) {
        pauseTimer();
        wasPausedByPortrait.current = true;
      } else if (landscape && wasPausedByPortrait.current && phase === 'active') {
        resumeTimer();
        wasPausedByPortrait.current = false;
      }
    });

    return () => {
      mounted = false;
      ScreenOrientation.removeOrientationChangeListener(sub);
      ScreenOrientation.unlockAsync().catch(() => {});
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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
      {isLandscape && (phase === 'countdown-watch' || phase === 'demo-fullscreen' || phase === 'countdown-go') && (
        <TouchableOpacity
          style={styles.floatingExitBtn}
          onPress={onExit}
          activeOpacity={0.7}
          hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
        >
          <X size={18} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Demo video — fullscreen, then PIP */}
      {isLandscape && (phase === 'demo-fullscreen' || phase === 'countdown-go' || phase === 'active') && (
        <DemoVideoPip
          videoUrl={demoUrl}
          isFullscreen={phase === 'demo-fullscreen'}
          onDemoComplete={onDemoComplete}
        />
      )}

      {/* HUD during active drill */}
      {isLandscape && phase === 'active' && (
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
      {isLandscape && phase === 'countdown-watch' && (
        <CountdownOverlay
          finalLabel="WATCH"
          contextLabel={`DRILL ${drillIdx + 1} OF ${resolvedDrills.length}`}
          onComplete={onWatchDone}
        />
      )}
      {isLandscape && phase === 'countdown-go' && (
        <CountdownOverlay
          finalLabel="GO"
          contextLabel={currentDrill?.name?.toUpperCase()}
          onComplete={onGoDone}
        />
      )}

      {/* Rotate-phone overlay — shown whenever phone is portrait */}
      {!isLandscape && (
        <SessionSetupOverlay onExit={onExit} />
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
