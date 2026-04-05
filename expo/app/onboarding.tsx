import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import type { PlanDay } from '@/store/planStore';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const FALLBACK_SESSION = {
  focus: 'Ball Handling',
  duration: '45 min',
  drills: [
    { name: 'Dynamic warmup', time: '5 min', type: 'warmup' as const, detail: 'Light jog, high knees, butt kicks, arm circles' },
    { name: 'Stationary combo dribbles', time: '8 min', type: 'skill' as const, detail: 'Crossover, between legs, behind back — 30 sec each, both hands' },
    { name: 'Full court attack dribbles', time: '10 min', type: 'skill' as const, detail: 'Speed dribble, hesitation, in-and-out — full court and back' },
    { name: 'Pressure handling drill', time: '10 min', type: 'skill' as const, detail: 'Dribble in a tight space with cones, react to visual cues' },
    { name: 'Free throw shooting', time: '7 min', type: 'shooting' as const, detail: '3 sets of 10 — focus on routine consistency' },
    { name: 'Lane slides', time: '5 min', type: 'conditioning' as const, detail: 'Defensive slides baseline to baseline — 8 reps' },
  ],
};

const TYPE_COLORS: Record<string, string> = {
  warmup: '#8B9A6B',
  skill: Colors.primary,
  shooting: '#B08D57',
  conditioning: '#C47A6C',
};

const TYPE_LABELS: Record<string, string> = {
  warmup: 'WARMUP',
  skill: 'SKILL WORK',
  shooting: 'SHOOTING',
  conditioning: 'CONDITIONING',
};

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, completedDrills, toggleDrill, currentStreak, totalSessions, loadFromStorage } = usePlanStore();
  const [expandedDrill, setExpandedDrill] = useState<number | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  useEffect(() => {
    loadFromStorage();
  }, []);

  // Find today's day index based on day of week
  useEffect(() => {
    if (plan?.days) {
      const today = DAYS_OF_WEEK[new Date().getDay()];
      const todayShort = today.slice(0, 3);
      const idx = plan.days.findIndex(d =>
        d.day.toLowerCase().startsWith(todayShort.toLowerCase())
      );
      if (idx >= 0) setSelectedDayIndex(idx);
    }
  }, [plan]);

  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Use AI plan or fallback
  const hasPlan = plan && plan.days && plan.days.length > 0;
  const currentDay: PlanDay | null = hasPlan ? plan.days[selectedDayIndex] : null;
  const session = currentDay && !currentDay.isRest ? currentDay : null;
  const drills = session?.drills || FALLBACK_SESSION.drills;
  const sessionFocus = session?.focus || FALLBACK_SESSION.focus;
  const sessionDuration = session?.duration || FALLBACK_SESSION.duration;

  const handleDrillPress = (index: number) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedDrill(expandedDrill === index ? null : index);
  };

  const handleDrillComplete = (index: number) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleDrill(selectedDayIndex, index);
  };

  const handleDaySelect = (index: number) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDayIndex(index);
    setExpandedDrill(null);
  };

  const isDrillDone = (index: number) => completedDrills[`${selectedDayIndex}-${index}`] || false;
  const completedCount = drills.filter((_, i) => isDrillDone(i)).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerDate}>{todayDate}</Text>
            <Text style={styles.headerTitle}>
              {hasPlan ? plan.weekTitle : 'Today\'s Session'}
            </Text>
          </View>
          {currentStreak > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>{currentStreak} day streak</Text>
            </View>
          )}
        </View>

        {/* AI Insight */}
        {hasPlan && plan.aiInsight && (
          <View style={styles.insightCard}>
            <View style={styles.insightDot} />
            <Text style={styles.insightText}>{plan.aiInsight}</Text>
          </View>
        )}

        {/* Weekly schedule bar */}
        {hasPlan && (
          <View style={styles.weekBar}>
            {plan.days.map((day, i) => {
              const isSelected = i === selectedDayIndex;
              const isRest = day.isRest;
              const dayDrills = day.drills || [];
              const dayCompleted = dayDrills.filter((_, di) => completedDrills[`${i}-${di}`]).length;
              const allDone = dayDrills.length > 0 && dayCompleted === dayDrills.length;

              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.weekDay, isSelected && styles.weekDaySelected]}
                  onPress={() => handleDaySelect(i)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.weekDayLabel, isSelected && styles.weekDayLabelActive]}>
                    {day.day}
                  </Text>
                  <View style={[
                    styles.weekDot,
                    allDone && styles.weekDotDone,
                    isSelected && !allDone && styles.weekDotToday,
                    isRest && styles.weekDotRest,
                  ]}>
                    {allDone && <Text style={styles.weekCheck}>✓</Text>}
                    {isSelected && !allDone && !isRest && <View style={styles.weekTodayInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Rest day */}
        {currentDay?.isRest && (
          <View style={styles.restCard}>
            <Text style={styles.restTitle}>Recovery Day</Text>
            <Text style={styles.restSubtitle}>
              Your body builds muscle during rest, not during training. Stretch, hydrate, and get good sleep tonight.
            </Text>
          </View>
        )}

        {/* Session card */}
        {!currentDay?.isRest && (
          <View style={styles.sessionCard}>
            <View style={styles.sessionHeader}>
              <View>
                <Text style={styles.sessionFocus}>{sessionFocus}</Text>
                <Text style={styles.sessionMeta}>
                  {sessionDuration} · {drills.length} drills
                  {completedCount > 0 && ` · ${completedCount}/${drills.length} done`}
                </Text>
              </View>
              <View style={styles.durationBadge}>
                <Text style={styles.durationBadgeText}>{sessionDuration}</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(completedCount / Math.max(drills.length, 1)) * 100}%` }]} />
            </View>

            {drills.map((drill, index) => {
              const isDone = isDrillDone(index);
              const isExpanded = expandedDrill === index;
              const typeColor = TYPE_COLORS[drill.type] || Colors.textMuted;
              const typeLabel = TYPE_LABELS[drill.type] || drill.type?.toUpperCase() || '';

              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.drillRow, isDone && styles.drillRowDone]}
                  onPress={() => handleDrillPress(index)}
                  activeOpacity={0.7}
                >
                  <TouchableOpacity
                    style={[
                      styles.completeCircle,
                      isDone && { borderColor: typeColor, backgroundColor: typeColor },
                    ]}
                    onPress={() => handleDrillComplete(index)}
                    activeOpacity={0.7}
                  >
                    {isDone && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>

                  <View style={styles.drillInfo}>
                    <Text style={[styles.drillName, isDone && styles.drillNameDone]}>{drill.name}</Text>
                    <View style={styles.drillMetaRow}>
                      <View style={[styles.typeTag, { backgroundColor: typeColor + '20' }]}>
                        <Text style={[styles.typeTagText, { color: typeColor }]}>{typeLabel}</Text>
                      </View>
                      <Text style={styles.drillTime}>{drill.time}</Text>
                    </View>
                    {isExpanded && drill.detail && (
                      <Text style={styles.drillDetail}>{drill.detail}</Text>
                    )}
                  </View>

                  <Text style={styles.expandArrow}>{isExpanded ? '−' : '+'}</Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.startButton}
              activeOpacity={0.85}
              onPress={() => router.push('/session' as any)}
            >
              <Text style={styles.startButtonText}>
                {completedCount > 0 && completedCount < drills.length
                  ? 'CONTINUE SESSION'
                  : completedCount === drills.length
                  ? 'SESSION COMPLETE'
                  : 'START SESSION'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalSessions}</Text>
            <Text style={styles.statLabel}>Total{'\n'}sessions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{currentStreak}</Text>
            <Text style={styles.statLabel}>Day{'\n'}streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.accent }]}>W1</Text>
            <Text style={styles.statLabel}>Current{'\n'}week</Text>
          </View>
        </View>

        {/* Up next - show next non-rest day */}
        {hasPlan && (() => {
          const nextIdx = plan.days.findIndex((d, i) => i > selectedDayIndex && !d.isRest);
          const nextDay = nextIdx >= 0 ? plan.days[nextIdx] : null;
          if (!nextDay) return null;
          return (
            <TouchableOpacity
              style={styles.upNextCard}
              activeOpacity={0.8}
              onPress={() => handleDaySelect(nextIdx)}
            >
              <View style={styles.upNextContent}>
                <Text style={styles.upNextLabel}>NEXT SESSION — {nextDay.day.toUpperCase()}</Text>
                <Text style={styles.upNextFocus}>{nextDay.focus}</Text>
                <Text style={styles.upNextMeta}>
                  {nextDay.duration} · {nextDay.drills.length} drills
                </Text>
              </View>
              <ChevronRight size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          );
        })()}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 20 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 16, paddingBottom: 16,
  },
  headerDate: { fontSize: 13, color: Colors.textMuted, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  streakBadge: {
    backgroundColor: Colors.surface, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  streakText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  // Insight
  insightCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16, marginBottom: 16,
  },
  insightDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 4 },
  insightText: { fontSize: 13, color: Colors.primary, lineHeight: 19, flex: 1, fontWeight: '500' },
  // Week bar
  weekBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 12, marginBottom: 16,
  },
  weekDay: { alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingVertical: 4, borderRadius: 8 },
  weekDaySelected: { backgroundColor: '#1A1708' },
  weekDayLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  weekDayLabelActive: { color: Colors.primary },
  weekDot: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1.5, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  weekDotDone: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  weekDotToday: { borderColor: Colors.primary, borderWidth: 2 },
  weekDotRest: { borderStyle: 'dashed' as any },
  weekCheck: { fontSize: 11, color: Colors.black, fontWeight: '800' },
  weekTodayInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },
  // Rest card
  restCard: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 28, alignItems: 'center', marginBottom: 16,
  },
  restTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  restSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  // Session card
  sessionCard: {
    backgroundColor: Colors.surface, borderRadius: 18,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 20, marginBottom: 16,
  },
  sessionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16,
  },
  sessionFocus: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  sessionMeta: { fontSize: 13, color: Colors.textSecondary },
  durationBadge: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  durationBadgeText: { fontSize: 12, fontWeight: '800', color: Colors.black },
  progressTrack: { height: 4, backgroundColor: '#252525', borderRadius: 2, marginBottom: 14, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: Colors.accent, borderRadius: 2 },
  // Drills
  drillRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#222222', gap: 12,
  },
  drillRowDone: { opacity: 0.4 },
  completeCircle: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkmark: { fontSize: 13, color: Colors.black, fontWeight: '800' },
  drillInfo: { flex: 1 },
  drillName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: 5 },
  drillNameDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  drillMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeTag: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  typeTagText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  drillTime: { fontSize: 12, color: Colors.textMuted },
  drillDetail: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginTop: 10 },
  expandArrow: { fontSize: 18, color: Colors.textMuted, marginTop: 4 },
  startButton: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 18, alignItems: 'center', marginTop: 16,
  },
  startButtonText: { fontSize: 14, fontWeight: '900', color: Colors.black, letterSpacing: 2 },
  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 16, alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  statLabel: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', lineHeight: 14 },
  // Up next
  upNextCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 18, marginBottom: 12,
  },
  upNextContent: { flex: 1 },
  upNextLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 6 },
  upNextFocus: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  upNextMeta: { fontSize: 12, color: Colors.textSecondary },
});
