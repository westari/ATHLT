// expo/app/session.tsx
// Main session screen — runs through all drills for the current day.
//
// Flow per drill:
//   1. SETUP OVERLAY: "Lay phone sideways" (shown at drill 1, or any time user
//      rotates phone back to portrait mid-session)
//   2. Tap "I'm ready" → COUNTDOWN: 3-2-1 "WATCH"
//   3. DEMO video plays fullscreen
//   4. Demo auto-completes → video animates to top-right PIP
//   5. COUNTDOWN: 3-2-1 "GO"
//   6. DRILL TIMER runs with HUD (timer, reps, set, drill name)
//   7. Timer expires → auto-advance to next drill (back to step 2)
//
// Camera feed is a PLACEHOLDER for v1 (dark gradient) — replace with real
// camera + pose tracking when Apple Dev account is set up.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, AppState, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';
import SessionSetupOverlay from '@/components/SessionSetupOverlay';
import CountdownOverlay from '@/components/CountdownOverlay';
import DemoVideoPip from '@/components/DemoVideoPip';
import SessionHUD from '@/components/SessionHUD';

// ===== Demo video pool =====
// Map drill name (lowercase, partial match) → YouTube URL.
// You can expand this freely; the fallback is used when nothing matches.
const DEMO_VIDEO_MAP: Record<string, string> = {
  'pound dribble':       'https://www.youtube.com/watch?v=h6QSiJqQwGM',
  'crossover':           'https://www.youtube.com/watch?v=L_QrSxKpWko',
  'form shooting':       'https://www.youtube.com/watch?v=lGTtSILQGnE',
  'mikan':               'https://www.youtube.com/watch?v=AGtZsv0LJEU',
  'defensive slide':     'https://www.youtube.com/watch?v=oyJ3-7PqAg0',
  'finishing':           'https://www.youtube.com/watch?v=lGTtSILQGnE',
  'pull-up':             'https://www.youtube.com/watch?v=4Cd7B5MoxYI',
  'catch and shoot':     'https://www.youtube.com/watch?v=lGTtSILQGnE',
  'free throw':          'https://www.youtube.com/watch?v=lGTtSILQGnE',
  'tennis ball':         'https://www.youtube.com/watch?v=PqDIANpQ_VY',
  'two-ball':            'https://www.youtube.com/watch?v=PqDIANpQ_VY',
  'suicide':             'https://www.youtube.com/watch?v=BSjBkLNHrTk',
  'conditioning':        'https://www.youtube.com/watch?v=BSjBkLNHrTk',
  'warm-up':             'https://www.youtube.com/watch?v=jpqYBQDH_C8',
  'dynamic warm':        'https://www.youtube.com/watch?v=jpqYBQDH_C8',
};
const DEFAULT_DEMO = 'https://www.youtube.com/watch?v=lGTtSILQGnE';

// Phases per drill
type Phase =
  | 'setup'           // setup overlay shown
  | 'countdown-watch' // 3-2-1 → WATCH
  | 'demo-fullscreen' // demo plays fullscreen
  | 'countdown-go'    // demo shrinks to PIP, 3-2-1 → GO
  | 'active'          // drill timer running
  | 'complete';       // session done

type CoachReadState = 'idle' | 'loading' | 'done' | 'error';

export default function SessionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, currentDayIndex, completedDrills, toggleDrillComplete } = usePlanStore();

  const day = plan?.days?.[currentDayIndex];
  const resolvedDrills = useMemo(
    () => (day?.drills || [])
      .map(d => resolvePlanDrill(d))
      .filter(Boolean) as NonNullable<ReturnType<typeof resolvePlanDrill>>[],
    [day]
  );

  const [drillIdx, setDrillIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('setup');
  const [isOrientationLandscape, setIsOrientationLandscape] = useState(true);
  const [showPortraitWarning, setShowPortraitWarning] = useState(false);

  // Drill timer
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeTotal, setTimeTotal] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [coachReadState, setCoachReadState] = useState<CoachReadState>('idle');
  const [coachReadText, setCoachReadText] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Session-level
  const sessionStartRef = useRef<number>(Date.now());

  const currentDrill = resolvedDrills[drillIdx];

  // ===== Orientation lock & detection =====

  useEffect(() => {
    let mounted = true;

    // Lock to landscape on mount
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});

    // Listen for orientation changes — if user rotates portrait, show warning
    const sub = ScreenOrientation.addOrientationChangeListener((evt) => {
      if (!mounted) return;
      const o = evt.orientationInfo.orientation;
      const isLandscape =
        o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      setIsOrientationLandscape(isLandscape);
      if (!isLandscape && phase !== 'setup') {
        // User flipped to portrait mid-session — show warning overlay
        setShowPortraitWarning(true);
        pauseTimer();
      } else if (isLandscape && showPortraitWarning) {
        // They flipped back — auto-dismiss the warning, resume
        setShowPortraitWarning(false);
        if (phase === 'active') resumeTimer();
      }
    });

    return () => {
      mounted = false;
      ScreenOrientation.removeOrientationChangeListener(sub);
      ScreenOrientation.unlockAsync().catch(() => {});
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Timer control =====

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
    setPhase('countdown-watch');
  };

  const onWatchCountdownDone = () => {
    setPhase('demo-fullscreen');
  };

  const onDemoComplete = () => {
    setPhase('countdown-go');
  };

  const onGoCountdownDone = () => {
    // Start the drill timer
    const totalSec = drillDurationToSeconds(currentDrill?.time);
    startTimer(totalSec);
    setPhase('active');
  };

  const onDrillTimeUp = () => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Mark this drill complete
    toggleDrillComplete(currentDayIndex + '-' + drillIdx);

    // Advance to next drill, or finish session
    if (drillIdx + 1 < resolvedDrills.length) {
      setDrillIdx(prev => prev + 1);
      // Skip setup overlay on subsequent drills (user is already set up).
      // Per spec: setup shown at drill 1 + if portrait detected.
      setPhase('countdown-watch');
    } else {
      setPhase('complete');
    }
  };

  const fetchCoachRead = async () => {
    setCoachReadState('loading');
    try {
      const drillPayload = resolvedDrills.map(d => ({
        name: d.name,
        time: d.time,
        category: d.category,
      }));
      const resp = await fetch('https://www.tryparlai.com/api/coach-postgame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drills: drillPayload,
          focus: day?.focus || '',
          dayNumber: currentDayIndex + 1,
          totalDays: plan?.days.length ?? 7,
        }),
      });
      if (!resp.ok) throw new Error('bad response');
      const data = await resp.json();
      if (data.message) {
        setCoachReadText(data.message);
        setCoachReadState('done');
      } else {
        setCoachReadState('error');
      }
    } catch {
      setCoachReadState('error');
    }
  };

  const onExit = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    ScreenOrientation.unlockAsync().catch(() => {});
    router.back();
  };

  // ===== Computed UI values =====

  const sessionPctComplete = useMemo(() => {
    if (resolvedDrills.length === 0) return 0;
    const completed = drillIdx + (phase === 'active' && timeTotal > 0
      ? (1 - timeRemaining / timeTotal)
      : 0);
    return Math.min(100, (completed / resolvedDrills.length) * 100);
  }, [drillIdx, timeRemaining, timeTotal, phase, resolvedDrills.length]);

  const sessionTimeLabel = useMemo(() => {
    const elapsedSec = Math.floor((Date.now() - sessionStartRef.current) / 1000);
    const m = Math.floor(elapsedSec / 60);
    const s = elapsedSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, [timeRemaining]); // re-render with the timer tick

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

  // Session complete screen
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

          {coachReadState === 'idle' && (
            <TouchableOpacity style={styles.coachReadBtn} onPress={fetchCoachRead} activeOpacity={0.85}>
              <Text style={styles.coachReadBtnText}>Get Coach X's read</Text>
            </TouchableOpacity>
          )}
          {coachReadState === 'loading' && (
            <View style={styles.coachReadLoading}>
              <ActivityIndicator color={Colors.primary} size="small" />
              <Text style={styles.coachReadLoadingText}>Coach X is watching the tape…</Text>
            </View>
          )}
          {coachReadState === 'done' && (
            <View style={styles.coachReadCard}>
              <Text style={styles.coachReadLabel}>COACH X</Text>
              <Text style={styles.coachReadText}>{coachReadText}</Text>
            </View>
          )}
          {coachReadState === 'error' && (
            <TouchableOpacity onPress={fetchCoachRead} activeOpacity={0.7}>
              <Text style={styles.coachReadError}>Couldn't reach Coach X. Tap to retry.</Text>
            </TouchableOpacity>
          )}

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

      {/* Camera feed PLACEHOLDER (replace with real camera + pose tracking later) */}
      <LinearGradient
        colors={['#1a1a1a', '#0a0a0a']}
        style={StyleSheet.absoluteFill}
      />

      {/* Demo video — fullscreen during demo phase, PIP afterward */}
      {(phase === 'demo-fullscreen' || phase === 'countdown-go' || phase === 'active') && (
        <DemoVideoPip
          videoUrl={demoUrl}
          isFullscreen={phase === 'demo-fullscreen'}
          onDemoComplete={onDemoComplete}
        />
      )}

      {/* HUD shown during active drill */}
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

      {/* Countdown overlays */}
      {phase === 'countdown-watch' && (
        <CountdownOverlay
          finalLabel="WATCH"
          contextLabel={`DRILL ${drillIdx + 1} OF ${resolvedDrills.length}`}
          onComplete={onWatchCountdownDone}
        />
      )}
      {phase === 'countdown-go' && (
        <CountdownOverlay
          finalLabel="GO"
          contextLabel={currentDrill?.name?.toUpperCase()}
          onComplete={onGoCountdownDone}
        />
      )}

      {/* Setup overlay — shown at drill 1 or when user rotates to portrait */}
      {(phase === 'setup' || showPortraitWarning) && (
        <SessionSetupOverlay
          drillName={currentDrill?.name || 'Drill'}
          drillIndex={drillIdx}
          totalDrills={resolvedDrills.length}
          isPortraitWarning={showPortraitWarning}
          onReady={() => {
            if (showPortraitWarning) {
              setShowPortraitWarning(false);
              if (phase === 'active') resumeTimer();
            } else {
              onSetupReady();
            }
          }}
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
  // Fallback: try plain integer as minutes
  const plain = parseInt(timeStr, 10);
  return isNaN(plain) ? 60 : plain * 60;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
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

  coachReadBtn: {
    marginBottom: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 100,
  },
  coachReadBtnText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  coachReadLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  coachReadLoadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontStyle: 'italic',
  },
  coachReadCard: {
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.3)',
    padding: 16,
    maxWidth: 320,
    alignSelf: 'stretch',
  },
  coachReadLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 2,
    marginBottom: 8,
  },
  coachReadText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
    lineHeight: 22,
  },
  coachReadError: {
    fontSize: 13,
    color: Colors.danger,
    marginBottom: 16,
    textDecorationLine: 'underline',
  },
});
