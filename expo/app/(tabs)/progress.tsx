// expo/app/(tabs)/progress.tsx
// Progress tab.
//
// Changes:
//  - ADDED a "GAMES" section: season summary + recent 5 games + "See all"
//  - REMOVED the "TRAINING FOCUS" block (it just echoed onboarding answers —
//    that lives nowhere now; it was redundant junk)
//  - Kept the genuinely useful training analytics (stats row, this week,
//    drill breakdown, day by day)

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TrendingUp, Flame, Target, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import GameHistory from '@/components/GameHistory';

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, completedDrills, totalSessions, currentStreak } = usePlanStore();

  const totalDrillsCompleted = Object.keys(completedDrills).length;
  const days = plan?.days || [];
  const totalDrillsInPlan = days.reduce((sum, day) => sum + (day.drills?.length || 0), 0);
  const completionRate = totalDrillsInPlan > 0 ? Math.round((totalDrillsCompleted / totalDrillsInPlan) * 100) : 0;

  const dayStats = days.map((day, dayIndex) => {
    const drillCount = day.drills?.length || 0;
    const doneCount = day.drills?.filter((_, di) => completedDrills[dayIndex + '-' + di]).length || 0;
    return {
      day: day.day,
      focus: day.focus,
      isRest: day.isRest,
      total: drillCount,
      done: doneCount,
      pct: drillCount > 0 ? Math.round((doneCount / drillCount) * 100) : 0,
    };
  });

  const typeCount: Record<string, { total: number; done: number }> = {};
  days.forEach((day, dayIndex) => {
    (day.drills || []).forEach((drill, drillIndex) => {
      const t = drill.type || 'other';
      if (!typeCount[t]) typeCount[t] = { total: 0, done: 0 };
      typeCount[t].total++;
      if (completedDrills[dayIndex + '-' + drillIndex]) typeCount[t].done++;
    });
  });

  const TYPE_LABELS: Record<string, string> = {
    warmup: 'Warmup', skill: 'Skill Work', shooting: 'Shooting',
    conditioning: 'Conditioning', other: 'Other',
  };
  const TYPE_COLORS: Record<string, string> = {
    warmup: '#6F8A4B',
    skill: Colors.primary,
    shooting: '#A8733A',
    conditioning: '#B8503C',
    other: Colors.textMuted,
  };

  const goToGameHistory = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/game-history');
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.headerTitle}>Progress</Text>

        <View style={s.statsRow}>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: '#FBF5E2' }]}>
              <Target size={20} color={Colors.primary} />
            </View>
            <Text style={s.statValue}>{totalSessions}</Text>
            <Text style={s.statLabel}>Sessions</Text>
          </View>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: '#FBE9E9' }]}>
              <Flame size={20} color={Colors.danger} />
            </View>
            <Text style={s.statValue}>{currentStreak}</Text>
            <Text style={s.statLabel}>Day Streak</Text>
          </View>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: '#E8F2EB' }]}>
              <TrendingUp size={20} color={Colors.success} />
            </View>
            <Text style={s.statValue}>{completionRate}%</Text>
            <Text style={s.statLabel}>Complete</Text>
          </View>
        </View>

        {/* GAMES — summary + recent 5, tap to see all */}
        <View style={s.gamesHeader}>
          <Text style={s.sectionTitleBare}>GAMES</Text>
          <TouchableOpacity
            onPress={goToGameHistory}
            activeOpacity={0.7}
            style={s.seeAllBtn}
            hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
          >
            <Text style={s.seeAllText}>See all</Text>
            <ChevronRight size={14} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        <GameHistory limit={5} />

        {plan && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>THIS WEEK</Text>
            <Text style={s.weekTitle}>{plan.weekTitle}</Text>
            <View style={s.weekBar}>
              {dayStats.map((d, i) => (
                <View key={i} style={s.weekDay}>
                  <View style={s.weekBarOuter}>
                    <View style={[s.weekBarInner, {
                      height: d.isRest ? '0%' : (d.pct + '%'),
                      backgroundColor: d.pct === 100 ? Colors.success : d.pct > 0 ? Colors.primary : 'transparent',
                    }]} />
                  </View>
                  <Text style={[s.weekDayLabel, d.pct === 100 && { color: Colors.success }]}>{d.day}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {Object.keys(typeCount).length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>DRILL BREAKDOWN</Text>
            {Object.entries(typeCount).map(([type, counts], i) => {
              const pct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
              const color = TYPE_COLORS[type] || Colors.textMuted;
              return (
                <View key={i} style={s.breakdownRow}>
                  <View style={s.breakdownInfo}>
                    <View style={[s.breakdownDot, { backgroundColor: color }]} />
                    <Text style={s.breakdownLabel}>{TYPE_LABELS[type] || type}</Text>
                  </View>
                  <View style={s.breakdownBarOuter}>
                    <View style={[s.breakdownBarInner, { width: pct + '%', backgroundColor: color }]} />
                  </View>
                  <Text style={s.breakdownCount}>{counts.done}/{counts.total}</Text>
                </View>
              );
            })}
          </View>
        )}

        {plan && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>DAY BY DAY</Text>
            {dayStats.map((d, i) => (
              <View key={i} style={s.dayRow}>
                <View style={s.dayInfo}>
                  <Text style={s.dayName}>{d.day}</Text>
                  <Text style={s.dayFocus}>{d.isRest ? 'Rest Day' : d.focus}</Text>
                </View>
                {d.isRest ? (
                  <Text style={s.dayRest}>REST</Text>
                ) : (
                  <View style={s.dayProgress}>
                    <View style={s.dayBarOuter}>
                      <View style={[s.dayBarInner, {
                        width: d.pct + '%',
                        backgroundColor: d.pct === 100 ? Colors.success : Colors.primary,
                      }]} />
                    </View>
                    <Text style={[s.dayPct, d.pct === 100 && { color: Colors.success }]}>
                      {d.done}/{d.total}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {!plan && (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>No training data yet</Text>
            <Text style={s.emptyBody}>Complete your first session to start tracking progress.</Text>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 20 },
  headerTitle: {
    fontSize: 28, fontWeight: '800', color: Colors.textPrimary,
    paddingTop: 16, marginBottom: 20,
  },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16, alignItems: 'center',
  },
  statIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  statValue: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  statLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },

  gamesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitleBare: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.5,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.2,
  },

  section: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 20, marginBottom: 14, marginTop: 14,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 14,
  },
  weekTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 18 },
  weekBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', height: 120,
  },
  weekDay: { alignItems: 'center', flex: 1 },
  weekBarOuter: {
    width: 24, height: 100, backgroundColor: Colors.surfaceBorder, borderRadius: 12,
    overflow: 'hidden', justifyContent: 'flex-end', marginBottom: 8,
  },
  weekBarInner: { width: '100%', borderRadius: 12, minHeight: 4 },
  weekDayLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  breakdownRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  breakdownInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 100 },
  breakdownDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  breakdownBarOuter: {
    flex: 1, height: 6, backgroundColor: Colors.surfaceBorder,
    borderRadius: 3, overflow: 'hidden',
  },
  breakdownBarInner: { height: 6, borderRadius: 3 },
  breakdownCount: {
    fontSize: 12, color: Colors.textMuted, fontWeight: '600',
    width: 36, textAlign: 'right',
  },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  dayInfo: { flex: 1 },
  dayName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  dayFocus: { fontSize: 12, color: Colors.textMuted },
  dayRest: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1,
  },
  dayProgress: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayBarOuter: {
    width: 80, height: 6, backgroundColor: Colors.surfaceBorder,
    borderRadius: 3, overflow: 'hidden',
  },
  dayBarInner: { height: 6, borderRadius: 3 },
  dayPct: {
    fontSize: 12, color: Colors.textMuted, fontWeight: '600',
    width: 30, textAlign: 'right',
  },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: {
    fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8,
  },
  emptyBody: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
});
