// expo/app/session.tsx
//
// SESSION SCREEN — Portrait + CV Integration (2026-05-25)
//
// CV additions (v2):
//   - Shooting and Finishing drills now show live camera feed (top ~40% of screen)
//   - ShotTracker runs in background during those drills
//   - At session end, PostSessionRecap replaces the static complete screen
//     if any shots were tracked
//   - Non-shooting drills (ball handling, conditioning, defense) keep the
//     existing UI with no camera
//
// Original design decisions still apply (see commit history for rationale):
//   - Portrait, SVG circular timer, color-coded type tags, post-drill feedback modal

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Platform,
} from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { X, ChevronLeft, ChevronRight, Check, Play, List } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';
import CountdownOverlay from '@/components/CountdownOverlay';
import CVCameraView from '@/components/cv/CameraView';
import PostSessionRecap from '@/components/cv/PostSessionRecap';
import { ShotTracker, type ShotEvent } from '@/lib/cv/ShotTracker';
import { CVSessionSync, type SessionRecap } from '@/lib/cv/ShotSync';
import { supabase } from '@/constants/supabase';

// ===== Constants =====

const TIMER_R    = 54;
const TIMER_CIRC = 2 * Math.PI * TIMER_R;

const TYPE_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  warmup:       { bg: '#FFF3E0', text: '#BF5700', label: 'WARMUP' },
  skill:        { bg: '#EBF4FF', text: '#1A56DB', label: 'SKILL WORK' },
  shooting:     { bg: '#FFFBEB', text: '#926000', label: 'SHOOTING' },
  conditioning: { bg: '#FEF2F2', text: '#B91C1C', label: 'CONDITIONING' },
};

const FEEDBACK_OPTIONS: Array<{ rating: FeedbackRating; label: string; emoji: string }> = [
  { rating: 'too_easy',   label: 'Too Easy',   emoji: 'E' },
  { rating: 'just_right', label: 'Just Right', emoji: '✓' },
  { rating: 'too_hard',   label: 'Too Hard',   emoji: 'H' },
];

// Drills with these types or categories get live CV tracking
const CV_DRILL_TYPES = new Set<string>(['shooting']);
const CV_DRILL_CATEGORIES = new Set<string>(['Shooting', 'Finishing']);

type Phase = 'countdown' | 'active' | 'feedback' | 'complete';
type FeedbackRating = 'too_easy' | 'just_right' | 'too_hard';

// ===== CV helpers =====

function drillNeedsCV(drill: NonNullable<ReturnType<typeof resolvePlanDrill>>): boolean {
  return (
    CV_DRILL_TYPES.has(drill.type) ||
    CV_DRILL_CATEGORIES.has((drill as any).category ?? '')
  );
}

// ===== Component =====

export default function SessionScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const {
    plan, currentDayIndex, completedDrills,
    markDrillComplete, completeSession,
  } = usePlanStore();

  const day = plan?.days?.[currentDayIndex];
  const resolvedDrills = useMemo(
    () => (day?.drills || [])
      .map(d => resolvePlanDrill(d))
      .filter(Boolean) as NonNullable<ReturnType<typeof resolvePlanDrill>>[],
    [day]
  );

  const [drillIdx, setDrillIdx]           = useState(0);
  const [phase, setPhase]                 = useState<Phase>('countdown');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeTotal, setTimeTotal]         = useState(0);
  const [isPaused, setIsPaused]           = useState(false);
  const [showDrillList, setShowDrillList] = useState(false);
  const [feedbackRatings, setFeedbackRatings] = useState<Record<number, FeedbackRating>>({});

  // CV state
  const tracker         = useMemo(() => new ShotTracker(), []);
  const sync            = useMemo(() => new CVSessionSync(), []);
  const [recap, setRecap]     = useState<SessionRecap | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const cvStartedRef    = useRef(false);

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const drillIdxRef = useRef(0);
  const sessionStart = useRef(Date.now());

  drillIdxRef.current = drillIdx;

  const currentDrill = resolvedDrills[drillIdx];
  const nextDrill    = resolvedDrills[drillIdx + 1] ?? null;
  const cvEnabled    = !!currentDrill && drillNeedsCV(currentDrill);

  // Start/stop CV sync when drill changes
  useEffect(() => {
    if (cvEnabled && !cvStartedRef.current) {
      cvStartedRef.current = true;
      sync.start({
        drillId:     (currentDrill as any).id ?? currentDrill.name,
        drillName:   currentDrill.name,
        dayIndex:    currentDayIndex,
        drillIndex:  drillIdx,
        sessionType: 'guided',
      });
    }
  }, [cvEnabled, drillIdx]);

  const handleShotDetected = useCallback((event: ShotEvent) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sync.recordShot(event);
  }, [sync]);

  // ===== Timer =====

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const onTimerEnd = () => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    markDrillComplete(currentDayIndex, drillIdxRef.current);
    setPhase('feedback');
  };

  const startTimerInterval = () => {
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearTimer();
          onTimerEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startTimer = (seconds: number) => {
    clearTimer();
    setTimeTotal(seconds);
    setTimeRemaining(seconds);
    setIsPaused(false);
    startTimerInterval();
  };

  const pauseTimer  = () => { clearTimer(); setIsPaused(true); };
  const resumeTimer = () => { setIsPaused(false); startTimerInterval(); };
  const togglePause = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPaused) resumeTimer(); else pauseTimer();
  };

  useEffect(() => () => clearTimer(), []);

  // ===== Phase transitions =====

  const handleCountdownDone = () => {
    const secs = drillDurationToSeconds(currentDrill?.time);
    startTimer(secs);
    setPhase('active');
  };

  const advanceDrill = () => {
    const next = drillIdxRef.current + 1;
    if (next < resolvedDrills.length) {
      setDrillIdx(next);
      setPhase('countdown');
    } else {
      handleFinishSession();
    }
  };

  const handleFeedback = (rating: FeedbackRating) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFeedbackRatings(prev => ({ ...prev, [drillIdxRef.current]: rating }));
    advanceDrill();
  };

  const handleMarkComplete = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearTimer();
    markDrillComplete(currentDayIndex, drillIdxRef.current);
    setPhase('feedback');
  };

  const handleSkip = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearTimer();
    advanceDrill();
  };

  const handlePrev = () => {
    if (drillIdx === 0) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearTimer();
    setDrillIdx(prev => prev - 1);
    setPhase('countdown');
  };

  const handleFinishSession = async () => {
    const elapsed = Math.floor((Date.now() - sessionStart.current) / 1000);
    completeSession({
      date: new Date().toISOString(),
      focus: day?.focus || '',
      duration: `${Math.floor(elapsed / 60)} min`,
      drillsCompleted: resolvedDrills.length,
      drillsTotal: resolvedDrills.length,
    });

    // If any shots were tracked, show PostSessionRecap instead of static complete
    const summary = tracker.getSummary();
    if (summary.totalShots > 0) {
      setPhase('complete');
      setRecapLoading(true);
      setShowRecap(true);

      const { data: { user } } = await supabase.auth.getUser();
      const sessionRecap = await sync.finish(summary, user?.id);
      setRecap(sessionRecap);
      setRecapLoading(false);
    } else {
      setPhase('complete');
    }
  };

  const onExit = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearTimer();
    router.back();
  };

  // ===== Computed =====

  const timerProgress = timeTotal > 0 ? timeRemaining / timeTotal : 1;
  const dashOffset    = TIMER_CIRC * (1 - timerProgress);
  const typeConfig    = TYPE_CONFIG[currentDrill?.type ?? 'skill'] ?? TYPE_CONFIG.skill;
  const isLastDrill   = drillIdx + 1 === resolvedDrills.length;

  // ===== Empty guards =====

  if (!plan || !day || resolvedDrills.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.emptyText}>
          {!plan || !day ? 'No plan loaded.' : "No drills in today's workout."}
        </Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={onExit} activeOpacity={0.8}>
          <Text style={styles.emptyBtnText}>Back home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ===== CV Recap screen (replaces static complete when shots were tracked) =====

  if (phase === 'complete' && showRecap) {
    const summary = tracker.getSummary();
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <PostSessionRecap
          recap={recap}
          summary={summary}
          loading={recapLoading}
          onDone={onExit}
        />
      </View>
    );
  }

  // ===== Static complete screen (no shots tracked) =====

  if (phase === 'complete') {
    const elapsed = Math.floor((Date.now() - sessionStart.current) / 1000);
    const ratings = Object.values(feedbackRatings);
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView
          contentContainerStyle={[styles.completeScroll, { paddingBottom: 40 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.completeAccent} />
          <Text style={styles.completeTag}>SESSION COMPLETE</Text>
          <Text style={styles.completeTitle}>Work in.</Text>
          <Text style={styles.completeSub}>
            Day {currentDayIndex + 1} of {plan.days.length}
          </Text>

          <View style={styles.completeStats}>
            <View style={styles.completeStat}>
              <Text style={styles.completeStatVal}>{resolvedDrills.length}</Text>
              <Text style={styles.completeStatLbl}>DRILLS</Text>
            </View>
            <View style={styles.completeStatDiv} />
            <View style={styles.completeStat}>
              <Text style={styles.completeStatVal}>{Math.floor(elapsed / 60)}</Text>
              <Text style={styles.completeStatLbl}>MINUTES</Text>
            </View>
            {ratings.length > 0 && (
              <>
                <View style={styles.completeStatDiv} />
                <View style={styles.completeStat}>
                  <Text style={styles.completeStatVal}>
                    {ratings.filter(r => r === 'just_right').length}/{ratings.length}
                  </Text>
                  <Text style={styles.completeStatLbl}>ON POINT</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.completeDrillCard}>
            {resolvedDrills.map((drill, i) => {
              const tc = TYPE_CONFIG[drill.type] ?? TYPE_CONFIG.skill;
              return (
                <View
                  key={drill.id + i}
                  style={[
                    styles.completeDrillRow,
                    i === resolvedDrills.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.completeDrillCheck}>
                    <Check size={11} color={Colors.primary} strokeWidth={3} />
                  </View>
                  <Text style={styles.completeDrillName} numberOfLines={1}>{drill.name}</Text>
                  <View style={[styles.typeTag, { backgroundColor: tc.bg }]}>
                    <Text style={[styles.typeTagText, { color: tc.text }]}>{tc.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={styles.completeBtn} onPress={onExit} activeOpacity={0.85}>
            <Text style={styles.completeBtnText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ===== Main session UI =====

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={onExit}
          style={styles.iconBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
        >
          <X size={18} color={Colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.segments}>
          {resolvedDrills.map((_, i) => (
            <View
              key={i}
              style={[
                styles.seg,
                i < drillIdx  && styles.segDone,
                i === drillIdx && styles.segActive,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          onPress={() => setShowDrillList(true)}
          style={styles.listBtnWrap}
          activeOpacity={0.7}
          hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
        >
          <List size={16} color={Colors.textMuted} />
          <Text style={styles.drillCounterText}>{drillIdx + 1}/{resolvedDrills.length}</Text>
        </TouchableOpacity>
      </View>

      {/* CV camera for shooting/finishing drills */}
      {cvEnabled && (
        <View style={styles.cameraContainer}>
          <CVCameraView
            tracker={tracker}
            active={phase === 'active'}
            onShotDetected={handleShotDetected}
          />
        </View>
      )}

      {/* Scrollable drill body */}
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: 120 + insets.bottom },
          cvEnabled && styles.bodyCompact,
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Drill info card */}
        <View style={styles.drillCard}>
          <View style={[styles.typeTag, { backgroundColor: typeConfig.bg, marginBottom: 10 }]}>
            <Text style={[styles.typeTagText, { color: typeConfig.text }]}>{typeConfig.label}</Text>
          </View>
          <Text style={styles.drillName}>{currentDrill?.name ?? 'Drill'}</Text>
          <Text style={styles.drillTime}>{currentDrill?.time ?? ''}</Text>
        </View>

        {/* Circular timer — hidden on CV drills to save vertical space */}
        {!cvEnabled && (
          <TouchableOpacity
            style={styles.timerWrap}
            onPress={phase === 'active' ? togglePause : undefined}
            activeOpacity={phase === 'active' ? 0.85 : 1}
          >
            <Svg width={200} height={200} viewBox="0 0 120 120">
              <SvgCircle
                cx={60} cy={60} r={TIMER_R}
                fill="none" stroke={Colors.surfaceBorder} strokeWidth={7}
              />
              {phase === 'active' && (
                <SvgCircle
                  cx={60} cy={60} r={TIMER_R}
                  fill="none"
                  stroke={isPaused ? Colors.textMuted : Colors.primary}
                  strokeWidth={7}
                  strokeDasharray={String(TIMER_CIRC)}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
              )}
              {phase === 'countdown' && (
                <SvgCircle
                  cx={60} cy={60} r={TIMER_R}
                  fill="none" stroke={Colors.primary}
                  strokeWidth={7} opacity={0.25}
                />
              )}
            </Svg>

            <View style={styles.timerInner} pointerEvents="none">
              {phase === 'active' ? (
                isPaused ? (
                  <Play size={40} color={Colors.primary} fill={Colors.primary} />
                ) : (
                  <>
                    <Text style={styles.timerDigits}>{formatTime(timeRemaining)}</Text>
                    <Text style={styles.timerHint}>TAP TO PAUSE</Text>
                  </>
                )
              ) : (
                <Text style={styles.timerDigitsMuted}>
                  {formatTime(drillDurationToSeconds(currentDrill?.time))}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Compact timer for CV drills */}
        {cvEnabled && (
          <TouchableOpacity
            style={styles.timerCompact}
            onPress={phase === 'active' ? togglePause : undefined}
            activeOpacity={phase === 'active' ? 0.85 : 1}
          >
            <Text style={styles.timerCompactDigits}>
              {phase === 'active' ? formatTime(timeRemaining) : formatTime(drillDurationToSeconds(currentDrill?.time))}
            </Text>
            {phase === 'active' && (
              <Text style={styles.timerCompactHint}>{isPaused ? 'TAP TO RESUME' : 'TAP TO PAUSE'}</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Coaching points */}
        {(currentDrill?.coachingPoints?.length ?? 0) > 0 && (
          <View style={styles.coachSection}>
            <Text style={styles.coachSectionHeader}>COACHING POINTS</Text>
            {currentDrill!.coachingPoints.slice(0, cvEnabled ? 2 : 3).map((pt, i) => (
              <View key={i} style={styles.coachRow}>
                <View style={styles.coachDot} />
                <Text style={styles.coachText}>{pt}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Next drill preview */}
        {nextDrill && !cvEnabled && (
          <View style={styles.nextWrap}>
            <Text style={styles.nextLabel}>UP NEXT</Text>
            <Text style={styles.nextName} numberOfLines={1}>{nextDrill.name}</Text>
            <Text style={styles.nextTime}>{nextDrill.time}</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom controls */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.sideBtn, drillIdx === 0 && styles.sideBtnDisabled]}
          onPress={handlePrev}
          disabled={drillIdx === 0}
          activeOpacity={0.7}
        >
          <ChevronLeft size={18} color={drillIdx === 0 ? Colors.textMuted : Colors.textPrimary} />
          <Text style={[styles.sideBtnText, drillIdx === 0 && { color: Colors.textMuted }]}>Prev</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleMarkComplete}
          activeOpacity={0.85}
        >
          <Check size={17} color={Colors.white} strokeWidth={2.5} />
          <Text style={styles.primaryBtnText}>{isLastDrill ? 'Finish' : 'Complete'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sideBtn} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={styles.sideBtnText}>Skip</Text>
          <ChevronRight size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Countdown overlay */}
      {phase === 'countdown' && (
        <CountdownOverlay
          finalLabel="GO"
          contextLabel={`DRILL ${drillIdx + 1} OF ${resolvedDrills.length}`}
          onComplete={handleCountdownDone}
        />
      )}

      {/* Feedback modal */}
      <Modal visible={phase === 'feedback'} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>How was this drill?</Text>
            <Text style={styles.sheetSub}>{currentDrill?.name}</Text>

            {FEEDBACK_OPTIONS.map(({ rating, label, emoji }) => (
              <TouchableOpacity
                key={rating}
                style={styles.feedbackBtn}
                onPress={() => handleFeedback(rating)}
                activeOpacity={0.75}
              >
                <Text style={styles.feedbackEmoji}>{emoji}</Text>
                <Text style={styles.feedbackBtnText}>{label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity onPress={advanceDrill} style={styles.skipFeedback} activeOpacity={0.6}>
              <Text style={styles.skipFeedbackText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Drill list modal */}
      <Modal
        visible={showDrillList}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDrillList(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.listSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.listSheetHeader}>
              <Text style={styles.listSheetTitle}>Today's Drills</Text>
              <TouchableOpacity onPress={() => setShowDrillList(false)} hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}>
                <X size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {resolvedDrills.map((drill, i) => {
                const isDone    = !!completedDrills[`${currentDayIndex}-${i}`];
                const isCurrent = i === drillIdx;
                const tc        = TYPE_CONFIG[drill.type] ?? TYPE_CONFIG.skill;
                return (
                  <View key={drill.id + i} style={[styles.listRow, isCurrent && styles.listRowCurrent]}>
                    <View style={[styles.listNum, isDone && styles.listNumDone]}>
                      {isDone
                        ? <Check size={11} color={Colors.white} strokeWidth={3} />
                        : <Text style={[styles.listNumText, isCurrent && { color: Colors.primary }]}>{i + 1}</Text>
                      }
                    </View>
                    <View style={styles.listInfo}>
                      <Text style={[styles.listDrillName, isDone && { color: Colors.textMuted }]} numberOfLines={1}>
                        {drill.name}
                      </Text>
                      <Text style={styles.listDrillTime}>{drill.time}</Text>
                    </View>
                    <View style={[styles.typeTag, { backgroundColor: tc.bg }]}>
                      <Text style={[styles.typeTagText, { color: tc.text }]}>{tc.label}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ===== Helpers =====

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function drillDurationToSeconds(timeStr?: string): number {
  if (!timeStr) return 60;
  const m = timeStr.match(/(\d+)\s*min/i);
  if (m) return parseInt(m[1], 10) * 60;
  const s = timeStr.match(/(\d+)\s*sec/i);
  if (s) return parseInt(s[1], 10);
  const plain = parseInt(timeStr, 10);
  return isNaN(plain) ? 60 : plain * 60;
}

// ===== Styles =====

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  body:        { paddingHorizontal: 20, paddingTop: 4 },
  bodyCompact: { paddingTop: 2 },

  emptyText: {
    color: Colors.textSecondary, fontSize: 16, textAlign: 'center',
    marginTop: 120, paddingHorizontal: 24,
  },
  emptyBtn: {
    alignSelf: 'center', marginTop: 20,
    backgroundColor: Colors.buttonDark,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 100,
  },
  emptyBtnText: { color: Colors.buttonDarkText, fontWeight: '700', fontSize: 14 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  segments: { flex: 1, flexDirection: 'row', gap: 4, height: 4 },
  seg:       { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.surfaceBorder },
  segDone:   { backgroundColor: Colors.primary },
  segActive: { backgroundColor: Colors.primary, opacity: 0.45 },
  listBtnWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  drillCounterText: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.2,
  },

  // CV camera
  cameraContainer: {
    height: 240,
    marginHorizontal: 0,
    backgroundColor: '#000',
    overflow: 'hidden',
  },

  // Shared type tag
  typeTag: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 100, alignSelf: 'flex-start',
  },
  typeTagText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  drillCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 20, marginBottom: 16,
  },
  drillName: {
    fontSize: 26, fontWeight: '800', color: Colors.textPrimary,
    letterSpacing: -0.6, lineHeight: 32, marginBottom: 4,
  },
  drillTime: { fontSize: 14, color: Colors.textMuted, fontWeight: '500' },

  // Full timer (non-CV drills)
  timerWrap: {
    width: 200, height: 200,
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  timerInner:      { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  timerDigits:     { fontSize: 44, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -1.5 },
  timerDigitsMuted:{ fontSize: 44, fontWeight: '800', color: Colors.textMuted, letterSpacing: -1.5 },
  timerHint:       { fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.2, marginTop: 4 },

  // Compact timer (CV drills)
  timerCompact: {
    alignSelf: 'center', alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingVertical: 10, paddingHorizontal: 20, marginBottom: 12,
  },
  timerCompactDigits: {
    fontSize: 32, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -1,
  },
  timerCompactHint: {
    fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.2, marginTop: 2,
  },

  coachSection:       { marginBottom: 16 },
  coachSectionHeader: {
    fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 1.5, marginBottom: 10,
  },
  coachRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  coachDot:  {
    width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary,
    marginTop: 7, flexShrink: 0,
  },
  coachText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  nextWrap: {
    backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 14, marginTop: 4,
  },
  nextLabel: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 4 },
  nextName:  { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.2, marginBottom: 2 },
  nextTime:  { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: Colors.background,
    borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  sideBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 100, borderWidth: 1, borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface, minWidth: 76, justifyContent: 'center',
  },
  sideBtnDisabled: { opacity: 0.35 },
  sideBtnText:     { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  primaryBtn: {
    flex: 1, marginHorizontal: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.buttonDark, paddingVertical: 14, borderRadius: 100,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: Colors.buttonDarkText, letterSpacing: -0.2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.surfaceBorder,
    alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.3, marginBottom: 4 },
  sheetSub:   { fontSize: 13, color: Colors.textMuted, marginBottom: 20 },

  feedbackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.background,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingVertical: 14, paddingHorizontal: 18, marginBottom: 10,
  },
  feedbackEmoji:   { fontSize: 20 },
  feedbackBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  skipFeedback:    { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  skipFeedbackText:{ fontSize: 13, color: Colors.textMuted, fontWeight: '500' },

  listSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 12, maxHeight: '82%',
  },
  listSheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  listSheetTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.3 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  listRowCurrent: {
    backgroundColor: Colors.primary + '0D', borderRadius: 10, paddingHorizontal: 8, marginHorizontal: -8,
  },
  listNum: {
    width: 26, height: 26, borderRadius: 13, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  listNumDone:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  listNumText:  { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  listInfo:     { flex: 1 },
  listDrillName:{ fontSize: 14, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.2 },
  listDrillTime:{ fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  completeScroll:    { paddingHorizontal: 24, paddingTop: 28, alignItems: 'center' },
  completeAccent:    { width: 48, height: 4, borderRadius: 2, backgroundColor: Colors.primary, marginBottom: 28 },
  completeTag:       { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 2, marginBottom: 10 },
  completeTitle:     { fontSize: 42, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1.5, marginBottom: 6 },
  completeSub:       { fontSize: 14, fontWeight: '500', color: Colors.textMuted, marginBottom: 32 },
  completeStats: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingVertical: 20, paddingHorizontal: 28, width: '100%', marginBottom: 24, gap: 20,
  },
  completeStat:      { alignItems: 'center' },
  completeStatVal:   { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -1 },
  completeStatLbl:   { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.2, marginTop: 2 },
  completeStatDiv:   { width: 1, height: 40, backgroundColor: Colors.surfaceBorder },
  completeDrillCard: {
    width: '100%', marginBottom: 28,
    backgroundColor: Colors.surface,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.surfaceBorder, overflow: 'hidden',
  },
  completeDrillRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  completeDrillCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary + '1A', borderWidth: 1.5, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  completeDrillName: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.2 },
  completeBtn: {
    backgroundColor: Colors.buttonDark, paddingHorizontal: 56, paddingVertical: 16, borderRadius: 100, marginBottom: 8,
  },
  completeBtnText: { color: Colors.buttonDarkText, fontWeight: '700', fontSize: 15 },
});
