import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Play, Edit3, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';
import CoachXBubble from '@/components/CoachXBubble';

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const RING_SIZE = 220;
const RING_R = 97;
const RING_CIRC = 2 * Math.PI * RING_R;

function ProgressRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = (clamped / 100) * RING_CIRC;
  return (
    <Svg width={RING_SIZE} height={RING_SIZE}>
      <Defs>
        <SvgLinearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#E7C76D" />
          <Stop offset="55%" stopColor="#C9A24A" />
          <Stop offset="100%" stopColor="#8A6A28" />
        </SvgLinearGradient>
      </Defs>
      <Circle
        cx={110} cy={110} r={RING_R}
        stroke="rgba(11,14,18,0.05)" strokeWidth={12} fill="none"
      />
      <Circle
        cx={110} cy={110} r={RING_R}
        stroke="url(#goldGrad)" strokeWidth={12}
        strokeLinecap="round" fill="none"
        strokeDasharray={`${filled} ${RING_CIRC}`}
        transform="rotate(-90 110 110)"
      />
    </Svg>
  );
}

const MINI_R = 10;
const MINI_CIRC = 2 * Math.PI * MINI_R;

function MiniRing({ pct }: { pct: number }) {
  const filled = (Math.max(0, Math.min(100, pct)) / 100) * MINI_CIRC;
  return (
    <Svg width={26} height={26}>
      <Circle cx={13} cy={13} r={MINI_R}
        stroke="rgba(11,14,18,0.08)" strokeWidth={3} fill="none" />
      <Circle cx={13} cy={13} r={MINI_R}
        stroke={Colors.primary} strokeWidth={3}
        strokeLinecap="round" fill="none"
        strokeDasharray={`${filled} ${MINI_CIRC}`}
        transform="rotate(-90 13 13)" />
    </Svg>
  );
}

export default function TodayHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, completedDrills, currentDayIndex } = usePlanStore();

  if (!plan) return null;

  const day = plan.days?.[currentDayIndex];
  const planDrills = day?.drills || [];

  const resolvedDrills = useMemo(
    () => planDrills.map(d => resolvePlanDrill(d)).filter((d): d is NonNullable<typeof d> => d !== null),
    [planDrills],
  );

  const donePct = resolvedDrills.length > 0
    ? Math.round(
        (resolvedDrills.filter((_, i) => completedDrills[currentDayIndex + '-' + i]).length
          / resolvedDrills.length) * 100,
      )
    : 0;

  const weekStats = useMemo(() => {
    let sessionsCompleted = 0;
    let streak = 0;
    plan.days.forEach((d, i) => {
      const drills = (d.drills || []).map(x => resolvePlanDrill(x)).filter(Boolean) as NonNullable<ReturnType<typeof resolvePlanDrill>>[];
      const doneCount = drills.filter((_, j) => completedDrills[i + '-' + j]).length;
      const allDone = drills.length > 0 && doneCount === drills.length;
      if (allDone) sessionsCompleted += 1;
    });
    for (let i = currentDayIndex; i >= 0; i--) {
      const drills = (plan.days[i]?.drills || []).map(x => resolvePlanDrill(x)).filter(Boolean) as NonNullable<ReturnType<typeof resolvePlanDrill>>[];
      const doneCount = drills.filter((_, j) => completedDrills[i + '-' + j]).length;
      const allDone = drills.length > 0 && doneCount === drills.length;
      const isRest = plan.days[i]?.isRest;
      if (allDone || isRest) streak += 1;
      else break;
    }
    return { sessionsCompleted, streak };
  }, [plan, completedDrills, currentDayIndex]);

  const totalDrillsDone = Object.keys(completedDrills).length;

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const onStartSession = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/session');
  };

  const onEditWorkout = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/edit-workout');
  };

  const onCoachXTap = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/coachx');
  };

  const statCards = [
    { label: 'STREAK', value: String(weekStats.streak), unit: 'd', pct: Math.min(100, weekStats.streak * 14) },
    { label: 'SESSIONS', value: String(weekStats.sessionsCompleted), unit: '', pct: (weekStats.sessionsCompleted / 7) * 100 },
    { label: 'DRILLS', value: String(totalDrillsDone), unit: '', pct: donePct },
  ];

  return (
    <View style={styles.container}>
      {/* Gold gradient wash */}
      <LinearGradient
        colors={['rgba(231,199,109,0.10)', 'transparent']}
        style={styles.gradientWash}
        pointerEvents="none"
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Hey</Text>
            <Text style={styles.dateLabel}>{dateLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => router.push('/more')}
            activeOpacity={0.7}
          >
            <Text style={styles.avatarText}>A</Text>
          </TouchableOpacity>
        </View>

        {/* Day strip */}
        <View style={styles.dayStrip}>
          {plan.days.map((d, i) => {
            const isCur = i === currentDayIndex;
            return (
              <TouchableOpacity
                key={i}
                style={styles.dayCol}
                onPress={() => {
                  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  usePlanStore.getState().setCurrentDayIndex(i);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayLetter, isCur && styles.dayLetterActive]}>
                  {DAYS_SHORT[i]}
                </Text>
                <View style={[
                  styles.dayCircle,
                  isCur && styles.dayCircleActive,
                  d.isRest && !isCur && styles.dayCircleRest,
                ]} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Hero ring */}
        <View style={styles.ringWrap}>
          <ProgressRing pct={donePct} />
          <View style={styles.ringInner} pointerEvents="none">
            <View style={styles.ringNumRow}>
              <Text style={styles.ringNum}>{donePct}</Text>
              <Text style={styles.ringPct}>%</Text>
            </View>
            <Text style={styles.ringLabel}>TODAY'S PROGRESS</Text>
            <Text style={styles.ringSubLabel}>
              {resolvedDrills.filter((_, i) => completedDrills[currentDayIndex + '-' + i]).length}
              {' / '}
              {resolvedDrills.length} drills
            </Text>
          </View>
        </View>

        {/* Three stat cards */}
        <View style={styles.statRow}>
          {statCards.map((card, i) => (
            <View key={i} style={styles.statCard}>
              <View style={styles.statCardTop}>
                <Text style={styles.statCardLabel}>{card.label}</Text>
                <MiniRing pct={card.pct} />
              </View>
              <View style={styles.statCardValRow}>
                <Text style={styles.statCardVal}>{card.value}</Text>
                {card.unit ? <Text style={styles.statCardUnit}>{card.unit}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        {/* Coach X bubble */}
        <View style={styles.bubbleWrap}>
          <CoachXBubble onPress={onCoachXTap} />
        </View>

        {/* Today's Plan */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>
            {day?.isRest ? "REST DAY" : "TODAY'S PLAN"}
            {!day?.isRest && day?.duration ? ` · ${day.duration}` : ''}
          </Text>
          {!day?.isRest && (
            <TouchableOpacity onPress={onEditWorkout} activeOpacity={0.7}>
              <Text style={styles.sectionAction}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.planCard}>
          {day?.isRest ? (
            <>
              <Text style={styles.planFocus}>Recovery</Text>
              <Text style={styles.planMeta}>
                Recovery is part of the work. But if you want to get shots up, go ahead.
              </Text>
            </>
          ) : (
            <>
              <View style={styles.planCardTop}>
                <View style={styles.assignedTag}>
                  <Text style={styles.assignedTagText}>ASSIGNED</Text>
                </View>
              </View>
              <Text style={styles.planFocus}>{day?.focus || 'Workout'}</Text>
              <Text style={styles.planMeta}>
                {resolvedDrills.length} drills
                {day?.duration ? ` · ${day.duration}` : ''}
              </Text>

              {resolvedDrills.length > 0 && (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: donePct + '%' }]} />
                </View>
              )}

              {resolvedDrills.length > 0 ? (
                <TouchableOpacity style={styles.viewBtn} onPress={onStartSession} activeOpacity={0.85}>
                  <Play size={15} color={Colors.surface} fill={Colors.surface} />
                  <Text style={styles.viewBtnText}>Start session</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.viewBtn} onPress={onEditWorkout} activeOpacity={0.85}>
                  <Edit3 size={15} color={Colors.surface} />
                  <Text style={styles.viewBtnText}>Add drills</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Last Session */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>LAST SESSION</Text>
          <TouchableOpacity
            onPress={() => router.push('/progress')}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionAction}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.lastSessionCard}>
          {weekStats.sessionsCompleted > 0 ? (
            <>
              <Text style={styles.lastSessionFocus}>
                {plan.days.find((d, i) => {
                  const drills = (d.drills || []).map(x => resolvePlanDrill(x)).filter(Boolean) as NonNullable<ReturnType<typeof resolvePlanDrill>>[];
                  return drills.length > 0 && drills.every((_, j) => completedDrills[i + '-' + j]);
                })?.focus || 'Training'}
              </Text>
              <Text style={styles.lastSessionMeta}>Completed this week</Text>
            </>
          ) : (
            <>
              <Text style={styles.lastSessionFocus}>No sessions yet</Text>
              <Text style={styles.lastSessionMeta}>Complete a drill to start tracking</Text>
            </>
          )}
          <ChevronRight size={16} color={Colors.textMuted} style={styles.lastSessionChevron} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  gradientWash: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 280,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerLeft: { flex: 1 },
  greeting: {
    fontSize: 26,
    fontWeight: '300',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textMuted,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },

  dayStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  dayCol: { alignItems: 'center', gap: 6 },
  dayLetter: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
    letterSpacing: 0.4,
  },
  dayLetterActive: { color: Colors.primary, fontWeight: '600' },
  dayCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    backgroundColor: 'transparent',
  },
  dayCircleActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  dayCircleRest: { borderStyle: 'dashed' },

  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  ringInner: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringNumRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ringNum: {
    fontSize: 64,
    fontWeight: '300',
    color: Colors.textPrimary,
    letterSpacing: -2.5,
    fontVariant: ['tabular-nums'],
    lineHeight: 72,
  },
  ringPct: {
    fontSize: 24,
    fontWeight: '300',
    color: Colors.textMuted,
    marginTop: 10,
    marginLeft: 2,
  },
  ringLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textMuted,
    letterSpacing: 0.08 * 14,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  ringSubLabel: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textMuted,
    marginTop: 4,
    letterSpacing: -0.1,
  },

  statRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  statCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textMuted,
    letterSpacing: 0.08 * 12,
    textTransform: 'uppercase',
  },
  statCardValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  statCardVal: {
    fontSize: 30,
    fontWeight: '300',
    color: Colors.textPrimary,
    letterSpacing: -0.03 * 30,
    fontVariant: ['tabular-nums'],
  },
  statCardUnit: {
    fontSize: 14,
    fontWeight: '300',
    color: Colors.textMuted,
  },

  bubbleWrap: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textMuted,
    letterSpacing: 0.08 * 12,
    textTransform: 'uppercase',
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.primary,
    letterSpacing: -0.1,
  },

  planCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: 18,
    marginHorizontal: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  planCardTop: { marginBottom: 8 },
  assignedTag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(201,162,74,0.25)',
  },
  assignedTagText: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  planFocus: {
    fontSize: 22,
    fontWeight: '300',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  planMeta: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textMuted,
    letterSpacing: -0.1,
    marginBottom: 14,
    lineHeight: 18,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  viewBtn: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  viewBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.surface,
    letterSpacing: -0.2,
  },

  lastSessionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: 18,
    marginHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  lastSessionFocus: {
    flex: 1,
    fontSize: 16,
    fontWeight: '300',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  lastSessionMeta: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.textMuted,
    marginLeft: 8,
  },
  lastSessionChevron: { marginLeft: 8 },
});
