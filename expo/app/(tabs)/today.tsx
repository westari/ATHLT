import { useRouter } from 'expo-router';
const router = useRouter();
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const WEEK_SCHEDULE = [
  { day: 'M', status: 'done', label: 'Handles' },
  { day: 'T', status: 'done', label: 'Finishing' },
  { day: 'W', status: 'rest', label: 'Rest' },
  { day: 'T', status: 'today', label: 'Shooting' },
  { day: 'F', status: 'upcoming', label: 'Defense' },
  { day: 'S', status: 'upcoming', label: 'Full Game' },
  { day: 'S', status: 'rest', label: 'Rest' },
];

const TODAY_SESSION = {
  focus: 'Shooting',
  duration: '45 min',
  drills: [
    { name: 'Dynamic warmup + form shots', time: '5 min', type: 'warmup', detail: 'Light jog, stretches, then 10 form shots from 5 feet' },
    { name: 'Spot shooting — 5 spots', time: '12 min', type: 'shooting', detail: 'Corners, wings, top of key — 10 makes from each spot' },
    { name: 'Off-dribble pull-ups', time: '10 min', type: 'skill', detail: 'Jab step, one dribble pull-up from mid-range — both directions' },
    { name: 'Catch & shoot off screens', time: '10 min', type: 'shooting', detail: 'Simulate coming off a screen, catch and shoot — quick release' },
    { name: 'Free throws under fatigue', time: '5 min', type: 'shooting', detail: 'Sprint baseline to baseline, then shoot 2 FTs — repeat 5x' },
    { name: 'Core circuit', time: '5 min', type: 'conditioning', detail: 'Planks, Russian twists, leg raises — 30 sec each, 3 rounds' },
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
  const [expandedDrill, setExpandedDrill] = useState<number | null>(null);
  const [completedDrills, setCompletedDrills] = useState<Record<number, boolean>>({});

  const handleDrillPress = (index: number) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedDrill(expandedDrill === index ? null : index);
  };

  const handleDrillComplete = (index: number) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCompletedDrills({ ...completedDrills, [index]: !completedDrills[index] });
  };

  const completedCount = Object.values(completedDrills).filter(Boolean).length;
  const totalDrills = TODAY_SESSION.drills.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Today</Text>
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>3 day streak</Text>
          </View>
        </View>

        {/* Weekly schedule bar */}
        <View style={styles.weekBar}>
          {WEEK_SCHEDULE.map((day, i) => (
            <View key={i} style={styles.weekDay}>
              <Text style={[
                styles.weekDayLabel,
                day.status === 'today' && styles.weekDayLabelActive,
              ]}>{day.day}</Text>
              <View style={[
                styles.weekDot,
                day.status === 'done' && styles.weekDotDone,
                day.status === 'today' && styles.weekDotToday,
                day.status === 'rest' && styles.weekDotRest,
              ]}>
                {day.status === 'done' && <Text style={styles.weekCheck}>✓</Text>}
                {day.status === 'today' && <View style={styles.weekTodayInner} />}
              </View>
            </View>
          ))}
        </View>

        {/* Session card */}
        <View style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <View>
              <Text style={styles.sessionFocus}>{TODAY_SESSION.focus}</Text>
              <Text style={styles.sessionMeta}>
                {TODAY_SESSION.duration} · {totalDrills} drills
                {completedCount > 0 && ` · ${completedCount}/${totalDrills} done`}
              </Text>
            </View>
            <View style={styles.durationBadge}>
              <Text style={styles.durationBadgeText}>{TODAY_SESSION.duration}</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(completedCount / totalDrills) * 100}%` }]} />
          </View>

          {TODAY_SESSION.drills.map((drill, index) => {
            const isDone = completedDrills[index];
            const isExpanded = expandedDrill === index;
            const typeColor = TYPE_COLORS[drill.type] || Colors.textMuted;
            const typeLabel = TYPE_LABELS[drill.type] || '';

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
                  {isExpanded && <Text style={styles.drillDetail}>{drill.detail}</Text>}
                </View>

                <Text style={styles.expandArrow}>{isExpanded ? '−' : '+'}</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.startButton} activeOpacity={0.85} onPress={() => router.push('/session' as any)}>
            <Text style={styles.startButtonText}>
              {completedCount > 0 && completedCount < totalDrills ? 'CONTINUE SESSION' : completedCount === totalDrills ? 'SESSION COMPLETE' : 'START SESSION'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>3</Text>
            <Text style={styles.statLabel}>Sessions{'\n'}this week</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>2h 15m</Text>
            <Text style={styles.statLabel}>Total{'\n'}trained</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.accent }]}>W1</Text>
            <Text style={styles.statLabel}>Current{'\n'}week</Text>
          </View>
        </View>

        {/* AI insight */}
        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <View style={styles.insightDot} />
            <Text style={styles.insightLabel}>AI INSIGHT</Text>
          </View>
          <Text style={styles.insightText}>
            You've been consistent with ball handling this week. Your plan shifts to finishing and shooting next week to build on that foundation.
          </Text>
        </View>

        {/* Up next */}
        <TouchableOpacity style={styles.upNextCard} activeOpacity={0.8}>
          <View style={styles.upNextContent}>
            <Text style={styles.upNextLabel}>TOMORROW</Text>
            <Text style={styles.upNextFocus}>Defense & Agility</Text>
            <Text style={styles.upNextMeta}>45 min · Closeouts, slides, help & recover</Text>
          </View>
          <ChevronRight size={18} color={Colors.textMuted} />
        </TouchableOpacity>

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
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary },
  streakBadge: {
    backgroundColor: Colors.surface, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  streakText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  weekBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 14, marginBottom: 16,
  },
  weekDay: { alignItems: 'center', gap: 8 },
  weekDayLabel: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  weekDayLabelActive: { color: Colors.primary },
  weekDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  weekDotDone: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  weekDotToday: { borderColor: Colors.primary, borderWidth: 2 },
  weekDotRest: { borderColor: Colors.surfaceBorder, borderStyle: 'dashed' as any },
  weekCheck: { fontSize: 12, color: Colors.black, fontWeight: '800' },
  weekTodayInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
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
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 16, alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  statLabel: { fontSize: 10, color: Colors.textMuted, textAlign: 'center', lineHeight: 14 },
  insightCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 18, marginBottom: 12,
  },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  insightDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  insightLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5 },
  insightText: { fontSize: 13, color: Colors.primary, lineHeight: 19, fontWeight: '500' },
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
