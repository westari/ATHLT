import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Edit3 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const COACH_X_IMAGE = require('@/assets/images/coach-x-small.png');

// Gold + dark gradient theme
const GRADIENT_COLORS = ['#1F1608', '#0F0A04', '#000000'];
const SURFACE = '#1A130A';
const BORDER = '#2D2418';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = '#B8AC95';
const TEXT_MUTED = '#6A6155';
const GOLD = '#D4AF37';

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

  const onStartSession = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/session');
  };

  const onEditWorkout = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/edit-workout');
  };

  return (
    <LinearGradient
      colors={GRADIENT_COLORS}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== Day strip — letter on top, circle below ===== */}
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
                <Text style={[
                  styles.dayLetter,
                  isCur && styles.dayLetterActive,
                ]}>
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

        {/* ===== Coach X moment ===== */}
        <View style={styles.coachBlock}>
          <Image source={COACH_X_IMAGE} style={styles.coachImg} resizeMode="contain" />
          <View style={styles.coachTextWrap}>
            <Text style={styles.coachMessage}>Here's today. Let's go.</Text>
          </View>
        </View>

        {/* ===== Workout section ===== */}
        <View style={styles.workoutWrap}>
          {day?.isRest ? (
            <View style={styles.restNote}>
              <Text style={styles.restNoteLabel}>REST DAY</Text>
              <Text style={styles.restNoteBody}>
                Recovery is part of the work. But if you wanna get shots up, go ahead.
              </Text>
            </View>
          ) : null}

          {/* Header row */}
          <View style={styles.workoutHeader}>
            <View style={styles.focusPill}>
              <Text style={styles.focusPillText}>
                {(day?.focus || (day?.isRest ? 'REST' : 'WORKOUT')).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.workoutDuration}>{day?.duration}</Text>
          </View>

          <Text style={styles.workoutTitle}>
            {day?.focus || (day?.isRest ? 'Rest day' : 'Workout')}
          </Text>

          {/* Progress bar */}
          {resolvedDrills.length > 0 ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: donePct + '%' }]} />
            </View>
          ) : null}

          {/* Drill list */}
          <View style={styles.drillList}>
            {resolvedDrills.length === 0 ? (
              <View style={styles.emptyDrillsWrap}>
                <Text style={styles.emptyDrillsText}>
                  No drills yet. Tap "Edit workout" to add some.
                </Text>
              </View>
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
                    <View style={[
                      styles.drillCheck,
                      done && styles.drillCheckDone,
                    ]}>
                      {done && <Text style={styles.drillCheckMark}>✓</Text>}
                    </View>
                    <Text
                      style={[
                        styles.drillName,
                        done && styles.drillNameDone,
                      ]}
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

          {/* Start session button — gold */}
          {resolvedDrills.length > 0 ? (
            <TouchableOpacity style={styles.startBtn} onPress={onStartSession} activeOpacity={0.85}>
              <Play size={20} color="#000000" fill="#000000" />
              <Text style={styles.startBtnTxt}>Start session</Text>
            </TouchableOpacity>
          ) : null}

          {/* Edit workout — bordered button */}
          <TouchableOpacity style={styles.editBtn} onPress={onEditWorkout} activeOpacity={0.7}>
            <Edit3 size={16} color={TEXT_SECONDARY} />
            <Text style={styles.editBtnTxt}>Edit workout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ===== Day strip =====
  dayStripWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  dayCol: {
    alignItems: 'center',
    gap: 8,
  },
  dayLetter: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_MUTED,
    letterSpacing: 0.5,
  },
  dayLetterActive: {
    color: GOLD,
    fontWeight: '700',
  },
  dayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: TEXT_MUTED,
    backgroundColor: 'transparent',
  },
  dayCircleActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  dayCircleRest: {
    borderStyle: 'dashed',
  },

  // ===== Coach X moment =====
  coachBlock: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
    gap: 16,
  },
  coachImg: {
    width: 80,
    height: 80,
  },
  coachTextWrap: { flex: 1 },
  coachMessage: {
    fontSize: 26,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: -0.7,
    lineHeight: 32,
  },

  // ===== Workout section =====
  workoutWrap: {
    paddingHorizontal: 24,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  focusPill: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  focusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 1.5,
  },
  workoutDuration: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  workoutTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: -0.8,
    marginBottom: 16,
  },

  progressTrack: {
    height: 3,
    backgroundColor: BORDER,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: 3,
    backgroundColor: GOLD,
  },

  // ===== Drill list =====
  drillList: {
    marginBottom: 24,
  },
  drillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  drillCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: TEXT_MUTED,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  drillCheckDone: {
    borderColor: GOLD,
    backgroundColor: GOLD,
  },
  drillCheckMark: {
    fontSize: 11,
    color: '#000000',
    fontWeight: '800',
  },
  drillName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    letterSpacing: -0.2,
  },
  drillNameDone: {
    color: TEXT_MUTED,
    textDecorationLine: 'line-through',
  },
  drillTime: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    flexShrink: 0,
    fontWeight: '500',
  },

  // ===== Start session — gold =====
  startBtn: {
    backgroundColor: GOLD,
    borderRadius: 100,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  startBtnTxt: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.2,
  },

  // ===== Edit workout — bordered =====
  editBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 100,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editBtnTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    letterSpacing: 0.2,
  },

  // ===== Rest day note =====
  restNote: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  restNoteLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  restNoteBody: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 19,
  },

  emptyDrillsWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyDrillsText: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 19,
  },
});
