import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Play, Edit3, ChevronRight, Flame, Clock, CheckCircle2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const COACH_X_IMAGE = require('@/assets/images/coach-x-small.png');

// Daily Coach X lines — rotates by day index
const COACH_X_DAILY_LINES = [
  "Here's today. Let's go.",
  "Lock in. We've got work.",
  "Show up. Show out.",
  "No days off mentally.",
  "This is where it's built.",
  "Stay sharp. Don't slip.",
  "Recover hard. Come back harder.",
];

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

  // Yesterday's session recap
  const yesterdayIdx = currentDayIndex > 0 ? currentDayIndex - 1 : 6;
  const yesterdayDay = plan.days?.[yesterdayIdx];
  const yesterdayDrills = useMemo(
    () => (yesterdayDay?.drills || []).map(d => resolvePlanDrill(d)).filter((d): d is NonNullable<typeof d> => d !== null),
    [yesterdayDay]
  );
  const yesterdayDoneCount = yesterdayDrills.filter((_, i) => completedDrills[yesterdayIdx + '-' + i]).length;

  // This Week stats
  const weekStats = useMemo(() => {
    let sessionsCompleted = 0;
    let totalMinutes = 0;
    let streak = 0;

    plan.days.forEach((d, i) => {
      const drills = (d.drills || []).map(x => resolvePlanDrill(x)).filter(Boolean) as NonNullable<ReturnType<typeof resolvePlanDrill>>[];
      const doneCount = drills.filter((_, j) => completedDrills[i + '-' + j]).length;
      const allDone = drills.length > 0 && doneCount === drills.length;
      if (allDone) {
        sessionsCompleted += 1;
        const mins = drills.reduce((sum, dr) => {
          const t = parseInt(dr.time || '0');
          return sum + (isNaN(t) ? 0 : t);
        }, 0);
        totalMinutes += mins;
      }
    });

    // Simple streak: count consecutive completed days going back from today
    for (let i = currentDayIndex; i >= 0; i--) {
      const drills = (plan.days[i]?.drills || []).map(x => resolvePlanDrill(x)).filter(Boolean) as NonNullable<ReturnType<typeof resolvePlanDrill>>[];
      const doneCount = drills.filter((_, j) => completedDrills[i + '-' + j]).length;
      const allDone = drills.length > 0 && doneCount === drills.length;
      const isRest = plan.days[i]?.isRest;
      if (allDone || isRest) streak += 1;
      else break;
    }

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    return { sessionsCompleted, timeStr, streak };
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

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== Day strip — letter + date, Cal AI style ===== */}
        <View style={styles.dayStripWrap}>
          {plan.days.map((d, i) => {
            const isCur = i === currentDayIndex;
            const dayDate = new Date();
            dayDate.setDate(dayDate.getDate() + (i - currentDayIndex));
            const dateNum = dayDate.getDate();
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
                <View style={[
                  styles.dayCircle,
                  isCur && styles.dayCircleActive,
                ]}>
                  <Text style={[
                    styles.dayLetter,
                    isCur && styles.dayLetterActive,
                  ]}>
                    {DAYS_SHORT[i]}
                  </Text>
                </View>
                <Text style={[
                  styles.dayDate,
                  isCur && styles.dayDateActive,
                ]}>
                  {dateNum}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ===== Coach X widget ===== */}
        <View style={styles.widget}>
          <View style={styles.coachRow}>
            <Image source={COACH_X_IMAGE} style={styles.coachImg} resizeMode="contain" />
            <View style={styles.coachTextWrap}>
              <Text style={styles.coachLabel}>COACH X</Text>
              <Text style={styles.coachMessage}>{dailyLine}</Text>
            </View>
          </View>
        </View>

        {/* ===== Today's workout widget ===== */}
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

        {/* ===== Yesterday's session widget ===== */}
        {yesterdayDrills.length > 0 && (
          <View style={styles.widget}>
            <View style={styles.widgetHeader}>
              <Text style={styles.widgetLabel}>YESTERDAY</Text>
              <Text style={styles.widgetMeta}>
                {yesterdayDoneCount}/{yesterdayDrills.length} drills
              </Text>
            </View>
            <Text style={styles.widgetTitleSmall}>{yesterdayDay?.focus || 'Session'}</Text>

            <View style={styles.yesterdayList}>
              {yesterdayDrills.slice(0, 5).map((d, i) => {
                const done = completedDrills[yesterdayIdx + '-' + i];
                return (
                  <View key={i} style={styles.yesterdayRow}>
                    <CheckCircle2
                      size={16}
                      color={done ? Colors.primary : Colors.surfaceBorder}
                      fill={done ? Colors.primary : 'transparent'}
                    />
                    <Text
                      style={[
                        styles.yesterdayDrill,
                        done ? styles.yesterdayDone : styles.yesterdayMissed,
                      ]}
                      numberOfLines={1}
                    >
                      {d.name}
                    </Text>
                  </View>
                );
              })}
              {yesterdayDrills.length > 5 && (
                <Text style={styles.yesterdayMore}>
                  + {yesterdayDrills.length - 5} more
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ===== This Week widget ===== */}
        <View style={styles.widget}>
          <Text style={styles.widgetLabel}>THIS WEEK</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{weekStats.sessionsCompleted}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{weekStats.timeStr}</Text>
              <Text style={styles.statLabel}>Trained</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <View style={styles.streakNumWrap}>
                <Flame size={18} color={Colors.primary} fill={Colors.primary} />
                <Text style={styles.statNum}>{weekStats.streak}</Text>
              </View>
              <Text style={styles.statLabel}>Day streak</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ===== Day strip — Cal AI style =====
  dayStripWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 4,
  },
  dayCol: {
    alignItems: 'center',
    gap: 6,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayLetter: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  dayLetterActive: {
    color: Colors.white,
  },
  dayDate: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  dayDateActive: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },

  // ===== Widget base =====
  widget: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
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
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  widgetTitleSmall: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom: 12,
  },

  // ===== Coach X widget =====
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  coachImg: {
    width: 60,
    height: 60,
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
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
    lineHeight: 24,
  },

  // ===== Today's workout =====
  progressTrack: {
    height: 3,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
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
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  drillNameDone: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  drillTime: {
    fontSize: 11,
    color: Colors.textMuted,
    flexShrink: 0,
    fontWeight: '500',
  },
  startBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 100,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  startBtnTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
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

  // ===== Yesterday widget =====
  yesterdayList: {
    gap: 6,
  },
  yesterdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  yesterdayDrill: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  yesterdayDone: {
    color: Colors.textPrimary,
  },
  yesterdayMissed: {
    color: Colors.textMuted,
  },
  yesterdayMore: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    marginLeft: 26,
  },

  // ===== This Week widget =====
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.surfaceBorder,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  streakNumWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
