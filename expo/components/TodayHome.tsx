import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Play, Edit3, Flame, Settings, ChevronRight, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const COACH_X_IMAGE = require('@/assets/images/coach-x-small.png');

const COACH_X_DAILY_LINES = [
  "Here's today. Let's go.",
  "Lock in. We've got work.",
  "Show up. Show out.",
  "No days off mentally.",
  "This is where it's built.",
  "Stay sharp. Don't slip.",
  "Recover hard. Come back harder.",
];

const EXAMPLE_PAST_WORKOUT = {
  focus: 'Shooting',
  date: '2 days ago',
  drills: [
    { name: 'Form shooting', done: true },
    { name: 'Pull-up jumpers', done: true },
    { name: 'Catch & shoot', done: true },
    { name: 'Free throws', done: false },
  ],
};

// Header background - subtle off-white tint
const HEADER_BG = '#F8F5EF';
const HEADER_BORDER = '#EDE6D5';

export default function TodayHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, completedDrills, currentDayIndex } = usePlanStore();

  if (!plan) return null;

  const day = plan.days?.[currentDayIndex];
  const planDrills = day?.drills || [];

  const resolvedDrills = useMemo(
    () => planDrills.map(d => resolvePlanDrill(d)).filter((d): d is NonNullable<typeof d> => d !== null),
    [planDrills]
  );

  const donePct = resolvedDrills.length > 0
    ? Math.round((resolvedDrills.filter((_, i) => completedDrills[currentDayIndex + '-' + i]).length / resolvedDrills.length) * 100)
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

  const dailyLine = COACH_X_DAILY_LINES[currentDayIndex] || COACH_X_DAILY_LINES[0];

  const onStartSession = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/session');
  };

  const onEditWorkout = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/edit-workout');
  };

  const onMore = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/more');
  };

  const onViewPast = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HEADER ZONE — settings + days + Coach X all together ===== */}
        <View style={styles.headerZone}>
          {/* Top row — settings */}
          <View style={styles.topRow}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onMore} style={styles.settingsBtn} activeOpacity={0.7}>
              <Settings size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Day strip */}
          <View style={styles.dayStripWrap}>
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

          {/* Coach X */}
          <View style={styles.coachBlock}>
            <Image source={COACH_X_IMAGE} style={styles.coachImg} resizeMode="contain" />
            <View style={styles.coachTextWrap}>
              <Text style={styles.coachLabel}>COACH X</Text>
              <Text style={styles.coachMessage}>{dailyLine}</Text>
            </View>
          </View>
        </View>

        {/* ===== CONTENT ZONE ===== */}
        <View style={styles.contentZone}>
          {/* Today's workout */}
          <View style={styles.widget}>
            {day?.isRest ? (
              <>
                <Text style={styles.widgetLabel}>REST DAY</Text>
                <Text style={styles.widgetTitle}>Recovery</Text>
                <Text style={styles.restBody}>
                  Recovery is part of the work. But if you wanna get shots up, go ahead.
                </Text>
              </>
            ) : (
              <>
                <View style={styles.widgetHeader}>
                  <Text style={styles.widgetLabel}>TODAY'S WORKOUT</Text>
                  <Text style={styles.widgetMeta}>{day?.duration}</Text>
                </View>
                <Text style={styles.widgetTitle}>{day?.focus || 'Workout'}</Text>

                {resolvedDrills.length > 0 && (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: donePct + '%' }]} />
                  </View>
                )}

                <View style={styles.drillList}>
                  {resolvedDrills.length === 0 ? (
                    <Text style={styles.emptyDrillsText}>
                      No drills yet. Tap "Edit workout" to add some.
                    </Text>
                  ) : (
                    resolvedDrills.map((d, i) => {
                      const done = completedDrills[currentDayIndex + '-' + i];
                      return (
                        <TouchableOpacity
                          key={i}
                          style={styles.drillRow}
                          onPress={() => router.push('/drill/' + i)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.drillCheck, done && styles.drillCheckDone]}>
                            {done && <Text style={styles.drillCheckMark}>✓</Text>}
                          </View>
                          <Text
                            style={[styles.drillName, done && styles.drillNameDone]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {d.name}
                          </Text>
                          <Text style={styles.drillTime}>{d.time}</Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>

                {resolvedDrills.length > 0 && (
                  <TouchableOpacity style={styles.startBtn} onPress={onStartSession} activeOpacity={0.85}>
                    <Play size={18} color={Colors.white} fill={Colors.white} />
                    <Text style={styles.startBtnTxt}>Start session</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.editBtn} onPress={onEditWorkout} activeOpacity={0.7}>
                  <Edit3 size={14} color={Colors.textMuted} />
                  <Text style={styles.editBtnTxt}>Edit workout</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Two squares */}
          <View style={styles.squareRow}>
            <View style={styles.squareWidget}>
              <Text style={styles.squareLabel}>THIS WEEK</Text>

              <View style={styles.streakWrap}>
                <Flame
                  size={70}
                  color="rgba(212, 175, 55, 0.18)"
                  fill="rgba(212, 175, 55, 0.18)"
                  style={styles.flameBg}
                />
                <Text style={styles.streakNum}>{weekStats.streak}</Text>
              </View>
              <Text style={styles.streakLabel}>Day streak</Text>

              <View style={styles.divider} />

              <View style={styles.sessionsRow}>
                <Text style={styles.sessionsNum}>{weekStats.sessionsCompleted}</Text>
                <Text style={styles.sessionsLabel}>Sessions</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.squareWidget}
              onPress={onViewPast}
              activeOpacity={0.85}
            >
              <View style={styles.pastHeader}>
                <Text style={styles.squareLabel}>RECENT</Text>
                <ChevronRight size={14} color={Colors.textMuted} />
              </View>

              <Text style={styles.pastFocus}>{EXAMPLE_PAST_WORKOUT.focus}</Text>
              <Text style={styles.pastDate}>{EXAMPLE_PAST_WORKOUT.date}</Text>

              <View style={styles.pastDrillList}>
                {EXAMPLE_PAST_WORKOUT.drills.map((d, i) => (
                  <View key={i} style={styles.pastDrillRow}>
                    <View style={[styles.pastCheck, d.done && styles.pastCheckDone]}>
                      {d.done && <Check size={9} color={Colors.white} strokeWidth={3} />}
                    </View>
                    <Text
                      style={[styles.pastDrillName, d.done && styles.pastDrillDone]}
                      numberOfLines={1}
                    >
                      {d.name}
                    </Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ===== HEADER ZONE =====
  headerZone: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: HEADER_BORDER,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
  },
  settingsBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Day strip
  dayStripWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    marginBottom: 4,
  },
  dayCol: {
    alignItems: 'center',
    gap: 8,
  },
  dayLetter: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  dayLetterActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: 'transparent',
  },
  dayCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayCircleRest: {
    borderStyle: 'dashed',
  },

  // Coach X
  coachBlock: {
    flexDirection: 'row',
    paddingTop: 12,
    alignItems: 'center',
    gap: 14,
  },
  coachImg: {
    width: 64,
    height: 64,
  },
  coachTextWrap: { flex: 1 },
  coachLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  coachMessage: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 28,
  },

  // ===== CONTENT ZONE =====
  contentZone: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  widget: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  widgetLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  widgetMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  widgetTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.6,
    marginBottom: 14,
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
  },
  drillList: {
    marginBottom: 14,
  },
  drillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  drillCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  drillCheckDone: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  drillCheckMark: {
    fontSize: 10,
    color: Colors.white,
    fontWeight: '800',
  },
  drillName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  drillNameDone: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  drillTime: {
    fontSize: 12,
    color: Colors.textMuted,
    flexShrink: 0,
    fontWeight: '500',
  },
  startBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 100,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  startBtnTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
    letterSpacing: 0.2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  editBtnTxt: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  emptyDrillsText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  restBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  squareRow: {
    flexDirection: 'row',
    gap: 12,
  },
  squareWidget: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  squareLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.2,
  },

  streakWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    marginTop: 6,
    position: 'relative',
  },
  flameBg: {
    position: 'absolute',
  },
  streakNum: {
    fontSize: 44,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -1.5,
  },
  streakLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
    marginVertical: 10,
  },
  sessionsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
  },
  sessionsNum: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  sessionsLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
  },

  pastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  pastFocus: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  pastDate: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textMuted,
    marginBottom: 10,
  },
  pastDrillList: {
    gap: 6,
  },
  pastDrillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pastCheck: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pastCheckDone: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  pastDrillName: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  pastDrillDone: {
    color: Colors.textMuted,
  },
});
