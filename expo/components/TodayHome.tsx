import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Play, Edit3 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const COACH_X_PORTRAIT = require('@/assets/images/coach-x-small.png');

function getCoachXLine(focus: string, isRest: boolean): string {
  if (isRest) return 'Rest day. Recover. See you tomorrow.';
  const f = (focus || '').toLowerCase();
  if (f.includes('shoot')) return "Shooting day. Let's eat.";
  if (f.includes('handle') || f.includes('dribbl') || f.includes('ball')) return 'Handle day. Lock in.';
  if (f.includes('finish') || f.includes('rim')) return 'Finishing today. Get to the rack.';
  if (f.includes('weak hand') || f.includes('left')) return 'Weak hand work. This is where you separate.';
  if (f.includes('defen')) return 'Defense day. Sit down and guard.';
  if (f.includes('iq') || f.includes('mental')) return 'Film and IQ work today. Sharpen up.';
  if (f.includes('condition') || f.includes('agility') || f.includes('athlet')) return 'Conditioning. Push the pace.';
  return "Here's today. Let's get it.";
}

export default function TodayHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, completedDrills, currentDayIndex } = usePlanStore();

  if (!plan) return null;

  const day = plan.days?.[currentDayIndex];
  const planDrills = day?.drills || [];

  // Resolve every drill in the day from the library
  const resolvedDrills = useMemo(
    () => planDrills.map(d => resolvePlanDrill(d)).filter((d): d is NonNullable<typeof d> => d !== null),
    [planDrills]
  );

  const donePct = resolvedDrills.length > 0
    ? Math.round((resolvedDrills.filter((_, i) => completedDrills[currentDayIndex + '-' + i]).length / resolvedDrills.length) * 100)
    : 0;

  const coachLine = useMemo(
    () => getCoachXLine(day?.focus || '', !!day?.isRest),
    [day?.focus, day?.isRest]
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
        {/* ===== Coach X talking — portrait LEFT, message RIGHT ===== */}
        <View style={styles.coachBlock}>
          <View style={styles.coachLeft}>
            <Image source={COACH_X_PORTRAIT} style={styles.coachImg} resizeMode="contain" />
          </View>
          <View style={styles.coachRight}>
            <Text style={styles.coachLabel}>COACH X</Text>
            <Text style={styles.coachMessage}>{coachLine}</Text>
          </View>
        </View>

        {/* ===== Day pills — closer to Coach X now ===== */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 16 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
        >
          {plan.days.map((d, i) => {
            const isCur = i === currentDayIndex;
            const dayDrills = (d.drills || []).map(x => resolvePlanDrill(x)).filter(Boolean);
            const dayPct = dayDrills.length > 0
              ? Math.round((dayDrills.filter((_, j) => completedDrills[i + '-' + j]).length / dayDrills.length) * 100)
              : 0;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.dayPill,
                  { backgroundColor: isCur ? '#1A1A1A' : Colors.surface, borderColor: isCur ? '#1A1A1A' : Colors.surfaceBorder }
                ]}
                onPress={() => usePlanStore.getState().setCurrentDayIndex(i)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayPillTopLetter, { color: isCur ? Colors.white : Colors.textMuted }]}>
                  {DAYS_SHORT[i]}
                </Text>
                <Text style={[styles.dayPillName, { color: isCur ? Colors.white : Colors.textPrimary }]}>
                  {d.day}
                </Text>
                {d.isRest
                  ? <Text style={[styles.dayPillStatus, { color: isCur ? Colors.white : Colors.textMuted }]}>REST</Text>
                  : <Text style={[styles.dayPillStatus, { color: isCur ? Colors.white : Colors.textMuted }]}>{dayPct}%</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ===== Plan card ===== */}
        <View style={styles.planCardWrap}>
          {day?.isRest ? (
            <View style={styles.restCard}>
              <Text style={styles.restTitle}>Rest day</Text>
              <Text style={styles.restBody}>Recovery matters as much as the work. See you tomorrow.</Text>
            </View>
          ) : (
            <View style={styles.planCard}>
              <View style={styles.planHeader}>
                <Text style={styles.planLabel}>TODAY'S WORKOUT</Text>
                <Text style={styles.planDuration}>{day?.duration}</Text>
              </View>
              <Text style={styles.planFocus}>{day?.focus}</Text>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: donePct + '%' }]} />
              </View>

              <View style={{ marginTop: 8 }}>
                {resolvedDrills.map((d, i) => {
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
                        { borderColor: done ? Colors.primary : Colors.surfaceBorder, backgroundColor: done ? Colors.primary : 'transparent' }
                      ]}>
                        {done && <Text style={styles.drillCheckMark}>✓</Text>}
                      </View>
                      <Text style={[
                        styles.drillName,
                        { color: done ? Colors.textMuted : Colors.textPrimary, textDecorationLine: done ? 'line-through' : 'none' }
                      ]} numberOfLines={1}>
                        {d.name}
                      </Text>
                      <Text style={styles.drillTime}>{d.time}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.startBtn} onPress={onStartSession} activeOpacity={0.85}>
                <Play size={18} color={Colors.white} fill={Colors.white} />
                <Text style={styles.startBtnTxt}>Start session</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.editBtn} onPress={onEditWorkout} activeOpacity={0.7}>
                <Edit3 size={16} color={Colors.textPrimary} />
                <Text style={styles.editBtnTxt}>Edit workout</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.bottomSection}>
          <Text style={styles.bottomLabel}>COMING SOON</Text>
          <Text style={styles.bottomBody}>Yesterday's recap, weekly progress, and more.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Coach X block — tighter spacing, portrait LEFT
  coachBlock: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
    alignItems: 'center',
  },
  coachLeft: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  coachImg: { width: 76, height: 76 },
  coachRight: { flex: 1 },
  coachLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.primary,
    letterSpacing: 1.5, marginBottom: 6,
  },
  coachMessage: {
    fontSize: 22, fontWeight: '700', color: Colors.textPrimary,
    letterSpacing: -0.6, lineHeight: 28,
  },

  dayPill: {
    minWidth: 60, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, alignItems: 'center',
  },
  dayPillTopLetter: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 3 },
  dayPillName: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  dayPillStatus: { fontSize: 9, marginTop: 2 },

  planCardWrap: { paddingHorizontal: 20 },
  planCard: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  planHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  planLabel: {
    fontSize: 11, color: Colors.textMuted,
    letterSpacing: 1.5, fontWeight: '700',
  },
  planDuration: { fontSize: 12, color: Colors.textMuted },
  planFocus: {
    fontSize: 24, fontWeight: '700', color: Colors.textPrimary,
    marginBottom: 16, letterSpacing: -0.6,
  },
  progressTrack: {
    height: 4, backgroundColor: Colors.surfaceBorder,
    borderRadius: 2, overflow: 'hidden', marginBottom: 8,
  },
  progressFill: { height: 4, backgroundColor: Colors.primary },

  drillRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  drillCheck: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  drillCheckMark: { fontSize: 9, color: Colors.black, fontWeight: '800' },
  drillName: { flex: 1, fontSize: 13 },
  drillTime: { fontSize: 11, color: Colors.textMuted },

  startBtn: {
    backgroundColor: '#1A1A1A', borderRadius: 100, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 16,
  },
  startBtnTxt: {
    fontSize: 15, fontWeight: '600', color: Colors.white, letterSpacing: 0.2,
  },
  editBtn: {
    backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.surfaceBorder,
    borderRadius: 100, paddingVertical: 14, marginTop: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  editBtnTxt: {
    fontSize: 14, fontWeight: '600', color: Colors.textPrimary, letterSpacing: 0.2,
  },

  restCard: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 28,
    borderWidth: 1, borderColor: Colors.surfaceBorder, alignItems: 'center',
  },
  restTitle: {
    fontSize: 22, fontWeight: '700', color: Colors.textPrimary,
    marginBottom: 8, letterSpacing: -0.5,
  },
  restBody: {
    fontSize: 14, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },

  bottomSection: {
    marginTop: 24, marginHorizontal: 20, paddingVertical: 20, paddingHorizontal: 16,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder,
    borderStyle: 'dashed', alignItems: 'center',
  },
  bottomLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 6,
  },
  bottomBody: {
    fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18,
  },
});
