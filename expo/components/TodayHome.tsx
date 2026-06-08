import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Play, Edit3, ChevronRight, TrendingUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';
import ProgressRing from '@/components/ui/ProgressRing';
import CourtHeatmap, { EMPTY_ZONES, hotZoneName } from '@/components/CourtHeatmap';
import type { CourtHeatmapZones } from '@/components/CourtHeatmap';
import { getUserShotZones } from '@/lib/cv/ShotSync';

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function getFirstName(profile: { name?: string; position?: string } | null): string {
  if (!profile) return '';
  if (profile.name) return profile.name.split(' ')[0];
  return '';
}

export default function TodayHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, profile, completedDrills, currentDayIndex } = usePlanStore();

  if (!plan) return null;

  const day = plan.days?.[currentDayIndex];
  const planDrills = day?.drills || [];

  const resolvedDrills = useMemo(
    () => planDrills.map(d => resolvePlanDrill(d)).filter((d): d is NonNullable<typeof d> => d !== null),
    [planDrills],
  );

  const doneCount = resolvedDrills.filter((_, i) => completedDrills[currentDayIndex + '-' + i]).length;
  const donePct = resolvedDrills.length > 0
    ? Math.round((doneCount / resolvedDrills.length) * 100)
    : 0;

  const weekStats = useMemo(() => {
    let sessionsCompleted = 0;
    let streak = 0;
    plan.days.forEach((d, i) => {
      const drills = (d.drills || []).map(x => resolvePlanDrill(x)).filter(Boolean) as NonNullable<ReturnType<typeof resolvePlanDrill>>[];
      const done = drills.filter((_, j) => completedDrills[i + '-' + j]).length;
      if (drills.length > 0 && done === drills.length) sessionsCompleted++;
    });
    for (let i = currentDayIndex; i >= 0; i--) {
      const drills = (plan.days[i]?.drills || []).map(x => resolvePlanDrill(x)).filter(Boolean) as NonNullable<ReturnType<typeof resolvePlanDrill>>[];
      const done = drills.filter((_, j) => completedDrills[i + '-' + j]).length;
      if ((drills.length > 0 && done === drills.length) || plan.days[i]?.isRest) streak++;
      else break;
    }
    return { sessionsCompleted, streak };
  }, [plan, completedDrills, currentDayIndex]);

  const [shotZones, setShotZones] = useState<CourtHeatmapZones>(EMPTY_ZONES);

  useEffect(() => {
    getUserShotZones().then(setShotZones).catch(() => {});
  }, []);

  const hotZone = useMemo(() => hotZoneName(shotZones), [shotZones]);

  const totalDrillsDone = Object.keys(completedDrills).length;
  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const firstName = getFirstName(profile);

  const onStartSession = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/session');
  };
  const onEditWorkout = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/edit-workout');
  };
  const onTapRing = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/workout-preview' as any);
  };

  const statCards = [
    { label: 'STREAK', value: String(weekStats.streak), unit: 'd', pct: Math.min(100, weekStats.streak * 14), sub: 'days in a row' },
    { label: 'SESSIONS', value: String(weekStats.sessionsCompleted), unit: '', pct: (weekStats.sessionsCompleted / 7) * 100, sub: 'this week' },
    { label: 'DRILLS', value: String(totalDrillsDone), unit: '', pct: donePct, sub: 'completed' },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(231,199,109,0.10)', 'transparent']}
        style={styles.gradientWash}
        pointerEvents="none"
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.greeting}>
            {firstName ? `Hi, ${firstName}` : 'Hi'}
          </Text>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
        </View>

        {/* Day strip */}
        <View style={styles.dayStrip}>
          {plan.days.map((d, i) => {
            const isCur = i === currentDayIndex;
            const dayDate = new Date(today);
            dayDate.setDate(today.getDate() - currentDayIndex + i);
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
                ]}>
                  <Text style={[styles.dayNum, isCur && styles.dayNumActive]}>
                    {dayDate.getDate()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Hero ring — tappable to start workout */}
        <TouchableOpacity style={styles.ringWrap} onPress={onTapRing} activeOpacity={0.88}>
          <ProgressRing percent={donePct} size={220} strokeWidth={12} />
          <View style={styles.ringInner} pointerEvents="none">
            <View style={styles.ringNumRow}>
              <Text style={styles.ringNum}>{donePct}</Text>
              <Text style={styles.ringPct}>%</Text>
            </View>
            <Text style={styles.ringLabel}>TODAY'S PROGRESS</Text>
            <Text style={styles.ringSubLabel}>
              {doneCount} / {resolvedDrills.length} drills
            </Text>
          </View>
        </TouchableOpacity>

        {/* Tap to start hint */}
        <View style={styles.ringCta}>
          <Play size={11} color={Colors.primary} fill={Colors.primary} />
          <Text style={styles.ringCtaText}>Tap ring to start workout</Text>
        </View>

        {/* Three stat cards */}
        <View style={styles.statRow}>
          {statCards.map((card, i) => (
            <View key={i} style={styles.statCard}>
              <View style={styles.statCardTop}>
                <Text style={styles.statCardLabel}>{card.label}</Text>
                <ProgressRing
                  percent={card.pct}
                  size={26}
                  strokeWidth={3}
                  useGradient={false}
                  color={Colors.primary}
                  trackColor="rgba(255,255,255,0.10)"
                />
              </View>
              <View style={styles.statCardValRow}>
                <Text style={styles.statCardVal}>{card.value}</Text>
                {card.unit ? <Text style={styles.statCardUnit}>{card.unit}</Text> : null}
              </View>
              <Text style={styles.statCardSub}>{card.sub}</Text>
            </View>
          ))}
        </View>

        {/* Shot Map */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>SHOT MAP</Text>
          <TouchableOpacity onPress={() => router.push('/progress' as any)} activeOpacity={0.7}>
            <Text style={styles.sectionAction}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heatmapCard}>
          <CourtHeatmap
            zones={shotZones}
            showLabels={true}
            onZoneTap={() => {}}
          />
          <Text style={styles.heatmapSummary}>
            {hotZone
              ? <>Hot zone: <Text style={{ color: Colors.primary }}>{hotZone}</Text></>
              : 'Track your shots to unlock'}
          </Text>
        </View>

        {/* Today's Plan */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>
            {day?.isRest ? 'REST DAY' : "TODAY'S PLAN"}
            {!day?.isRest && day?.duration ? ` · ${day.duration}` : ''}
          </Text>
          {!day?.isRest && (
            <TouchableOpacity onPress={onEditWorkout} activeOpacity={0.7}>
              <Text style={styles.sectionAction}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.planCard}
          onPress={day?.isRest ? undefined : onTapRing}
          activeOpacity={day?.isRest ? 1 : 0.87}
        >
          {day?.isRest ? (
            <>
              <Text style={styles.planFocus}>Recovery Day</Text>
              <Text style={styles.planMeta}>
                Recovery is part of the work. Rest, stretch, or get light shots up if you want.
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
                {resolvedDrills.length} drill{resolvedDrills.length !== 1 ? 's' : ''}
                {day?.duration ? ` · ${day.duration}` : ''}
              </Text>

              {resolvedDrills.length > 0 && (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: donePct + '%' }]} />
                </View>
              )}

              {resolvedDrills.length > 0 ? (
                <View style={styles.viewBtn}>
                  <Play size={14} color={Colors.surface} fill={Colors.surface} />
                  <Text style={styles.viewBtnText}>
                    {donePct > 0 ? 'Continue session' : 'Start session'}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.viewBtn} onPress={onEditWorkout} activeOpacity={0.85}>
                  <Edit3 size={14} color={Colors.surface} />
                  <Text style={styles.viewBtnText}>Add drills</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </TouchableOpacity>

        {/* Last Session */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>LAST SESSION</Text>
          <TouchableOpacity onPress={() => router.push('/progress')} activeOpacity={0.7}>
            <Text style={styles.sectionAction}>See all</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.lastSessionCard}
          onPress={() => router.push('/progress')}
          activeOpacity={0.7}
        >
          {weekStats.sessionsCompleted > 0 ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.lastSessionFocus}>
                {plan.days.find((d, i) => {
                  const drills = (d.drills || []).map(x => resolvePlanDrill(x)).filter(Boolean) as NonNullable<ReturnType<typeof resolvePlanDrill>>[];
                  return drills.length > 0 && drills.every((_, j) => completedDrills[i + '-' + j]);
                })?.focus || 'Training'}
              </Text>
              <Text style={styles.lastSessionMeta}>Completed this week</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <Text style={styles.lastSessionFocus}>No sessions yet</Text>
              <Text style={styles.lastSessionMeta}>Complete a drill to start tracking</Text>
            </View>
          )}
          <View style={styles.lastSessionRight}>
            {weekStats.sessionsCompleted > 0 && (
              <View style={styles.lastSessionBadge}>
                <TrendingUp size={11} color={Colors.success} />
                <Text style={styles.lastSessionBadgeText}>Active</Text>
              </View>
            )}
            <ChevronRight size={16} color={Colors.textMuted} />
          </View>
        </TouchableOpacity>

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
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '300',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  dateLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
    letterSpacing: -0.1,
  },

  dayStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  dayCol: { alignItems: 'center', gap: 4 },
  dayLetter: {
    fontSize: 11, fontWeight: '500', color: Colors.textMuted, letterSpacing: 0.4,
  },
  dayLetterActive: { color: Colors.primary, fontWeight: '600' },
  dayCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.surfaceBorder,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  dayCircleActive: { backgroundColor: Colors.textPrimary, borderColor: Colors.textPrimary },
  dayCircleRest: { borderStyle: 'dashed' },
  dayNum: { fontSize: 11, fontWeight: '400', color: Colors.textMuted, fontVariant: ['tabular-nums'] },
  dayNumActive: { color: Colors.white, fontWeight: '600' },

  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  ringInner: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringNumRow: { flexDirection: 'row', alignItems: 'flex-start' },
  ringNum: {
    fontSize: 64, fontWeight: '300', color: Colors.textPrimary,
    letterSpacing: -2.5, fontVariant: ['tabular-nums'], lineHeight: 72,
  },
  ringPct: {
    fontSize: 24, fontWeight: '300', color: Colors.textMuted,
    marginTop: 10, marginLeft: 2,
  },
  ringLabel: {
    fontSize: 11, fontWeight: '500', color: Colors.textMuted,
    letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 2,
  },
  ringSubLabel: {
    fontSize: 13, color: Colors.textMuted,
    marginTop: 4, letterSpacing: -0.1,
  },

  ringCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, marginBottom: 20, marginTop: -4,
  },
  ringCtaText: { fontSize: 12, color: Colors.primary, letterSpacing: -0.1 },

  statRow: {
    flexDirection: 'row', paddingHorizontal: 24, gap: 10, marginBottom: 24,
  },
  statCard: {
    flex: 1, backgroundColor: Colors.surface,
    borderRadius: 22, borderWidth: 1, borderColor: Colors.hairline,
    padding: 14,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6,
  },
  statCardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  statCardLabel: {
    fontSize: 10, fontWeight: '500', color: Colors.textMuted,
    letterSpacing: 0.96, textTransform: 'uppercase',
  },
  statCardValRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  statCardVal: {
    fontSize: 30, fontWeight: '300', color: Colors.textPrimary,
    letterSpacing: -0.9, fontVariant: ['tabular-nums'],
  },
  statCardUnit: { fontSize: 14, fontWeight: '300', color: Colors.textMuted },
  statCardSub: { fontSize: 10, color: Colors.textMuted, marginTop: 2, letterSpacing: -0.1 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '500', color: Colors.textMuted,
    letterSpacing: 0.96, textTransform: 'uppercase',
  },
  sectionAction: { fontSize: 13, fontWeight: '500', color: Colors.primary, letterSpacing: -0.1 },

  planCard: {
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.hairline,
    padding: 18, marginHorizontal: 24, marginBottom: 24,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6,
  },
  planCardTop: { marginBottom: 8 },
  assignedTag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1, borderColor: 'rgba(201,162,74,0.25)',
  },
  assignedTagText: {
    fontSize: 9, fontWeight: '600', color: Colors.primary,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  planFocus: {
    fontSize: 22, fontWeight: '300', color: Colors.textPrimary,
    letterSpacing: -0.5, marginBottom: 4,
  },
  planMeta: {
    fontSize: 13, color: Colors.textMuted,
    letterSpacing: -0.1, marginBottom: 10, lineHeight: 18,
  },
  progressTrack: {
    height: 3, backgroundColor: Colors.surfaceBorder,
    borderRadius: 2, overflow: 'hidden', marginBottom: 14,
  },
  progressFill: { height: 3, backgroundColor: Colors.primary, borderRadius: 2 },
  viewBtn: {
    backgroundColor: Colors.textPrimary, borderRadius: 12,
    paddingVertical: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  viewBtnText: {
    fontSize: 15, fontWeight: '500', color: Colors.surface, letterSpacing: -0.2,
  },

  lastSessionCard: {
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.hairline,
    padding: 18, marginHorizontal: 24,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6,
  },
  lastSessionFocus: {
    fontSize: 16, fontWeight: '300', color: Colors.textPrimary, letterSpacing: -0.3,
  },
  lastSessionMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  lastSessionRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lastSessionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(24,184,114,0.10)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100,
  },
  lastSessionBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.success },

  heatmapCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 24,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  heatmapSummary: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 10,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
});
