import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Play } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// When you generate the side-peek pointing pose in Dreamina, save it as
// coach-x-peek.png in assets/images and swap this require to use it.
const COACH_X_IMAGE = require('@/assets/images/coach-x-small.png');

const COACH_X_LINE = "Here's today.\nLet's go.";

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
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== Day strip — top of screen, small rounded chips ===== */}
        <View style={styles.dayStripWrap}>
          {plan.days.map((d, i) => {
            const isCur = i === currentDayIndex;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.dayChip,
                  isCur && styles.dayChipActive,
                ]}
                onPress={() => {
                  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  usePlanStore.getState().setCurrentDayIndex(i);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dayChipLetter,
                  isCur && styles.dayChipLetterActive,
                  d.isRest && !isCur && styles.dayChipLetterRest,
                ]}>
                  {DAYS_SHORT[i]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ===== Coach X moment — image left, big bold text right ===== */}
        <View style={styles.coachBlock}>
          <Image source={COACH_X_IMAGE} style={styles.coachImg} resizeMode="contain" />
          <View style={styles.coachTextWrap}>
            <Text style={styles.coachMessage}>{COACH_X_LINE}</Text>
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

          {/* Header */}
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

          {/* Start session — massive primary action */}
          {resolvedDrills.length > 0 ? (
            <TouchableOpacity style={styles.startBtn} onPress={onStartSession} activeOpacity={0.85}>
              <Play size={20} color={Colors.white} fill={Colors.white} />
              <Text style={styles.startBtnTxt}>Start session</Text>
            </TouchableOpacity>
          ) : null}

          {/* Edit workout — secondary text link */}
          <TouchableOpacity style={styles.editLink} onPress={onEditWorkout} activeOpacity={0.6}>
            <Text style={styles.editLinkTxt}>Edit workout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ===== Day strip — top of screen =====
  dayStripWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  dayChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayChipLetter: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  dayChipLetterActive: {
    color: Colors.white,
  },
  dayChipLetterRest: {
    color: Colors.textMuted,
  },

  // ===== Coach X moment =====
  coachBlock: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 28,
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
    color: Colors.textPrimary,
    letterSpacing: -0.7,
    lineHeight: 32,
  },

  // ===== Workout section =====
  workoutWrap: {
    paddingHorizontal: 20,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  focusPill: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  focusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
  },
  workoutDuration: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  workoutTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.8,
    marginBottom: 20,
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
    borderBottomColor: Colors.surfaceBorder,
  },
  drillCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
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
    fontSize: 11,
    color: Colors.white,
    fontWeight: '800',
  },
  drillName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  drillNameDone: {
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  drillTime: {
    fontSize: 13,
    color: Colors.textMuted,
    flexShrink: 0,
    fontWeight: '500',
  },

  // ===== Start session — massive primary =====
  startBtn: {
    backgroundColor: '#1A1A1A',
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
    color: Colors.white,
    letterSpacing: 0.2,
  },

  // ===== Edit workout — secondary text link =====
  editLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  editLinkTxt: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textMuted,
    letterSpacing: -0.1,
  },

  // ===== Rest day note =====
  restNote: {
    backgroundColor: '#FBF5E2',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  restNoteLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  restNoteBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },

  emptyDrillsWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyDrillsText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
});
