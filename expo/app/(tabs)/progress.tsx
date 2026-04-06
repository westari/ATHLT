import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrendingUp, Flame, Target, Calendar, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { plan, profile, completedDrills, totalSessions, currentStreak } = usePlanStore();

  // Calculate stats
  const totalDrillsCompleted = Object.keys(completedDrills).length;
  const days = plan?.days || [];
  const totalDrillsInPlan = days.reduce((sum, day) => sum + (day.drills?.length || 0), 0);
  const completionRate = totalDrillsInPlan > 0 ? Math.round((totalDrillsCompleted / totalDrillsInPlan) * 100) : 0;

  // Per-day completion
  const dayStats = days.map((day, dayIndex) => {
    const drillCount = day.drills?.length || 0;
    const doneCount = day.drills?.filter((_, di) => completedDrills[`${dayIndex}-${di}`]).length || 0;
    return {
      day: day.day,
      focus: day.focus,
      isRest: day.isRest,
      total: drillCount,
      done: doneCount,
      pct: drillCount > 0 ? Math.round((doneCount / drillCount) * 100) : 0,
    };
  });

  // Drill type breakdown
  const typeCount: Record<string, { total: number; done: number }> = {};
  days.forEach((day, dayIndex) => {
    (day.drills || []).forEach((drill, drillIndex) => {
      var t = drill.type || 'other';
      if (!typeCount[t]) typeCount[t] = { total: 0, done: 0 };
      typeCount[t].total++;
      if (completedDrills[`${dayIndex}-${drillIndex}`]) typeCount[t].done++;
    });
  });

  const TYPE_LABELS: Record<string, string> = {
    warmup: 'Warmup', skill: 'Skill Work', shooting: 'Shooting', conditioning: 'Conditioning', other: 'Other',
  };
  const TYPE_COLORS: Record<string, string> = {
    warmup: '#8B9A6B', skill: Colors.primary, shooting: '#B08D57', conditioning: '#C47A6C', other: Colors.textMuted,
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.headerTitle}>Progress</Text>

        {/* Big stats row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: '#1A1708' }]}>
              <Target size={20} color={Colors.primary} />
            </View>
            <Text style={s.statValue}>{totalSessions}</Text>
            <Text style={s.statLabel}>Sessions</Text>
          </View>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: '#1A1210' }]}>
              <Flame size={20} color="#C47A6C" />
            </View>
            <Text style={s.statValue}>{currentStreak}</Text>
            <Text style={s.statLabel}>Day Streak</Text>
          </View>
          <View style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: '#121A12' }]}>
              <TrendingUp size={20} color="#8B9A6B" />
            </View>
            <Text style={s.statValue}>{completionRate}%</Text>
            <Text style={s.statLabel}>Complete</Text>
          </View>
        </View>

        {/* Weekly overview */}
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
                      backgroundColor: d.pct === 100 ? '#8B9A6B' : d.pct > 0 ? Colors.primary : 'transparent',
                    }]} />
                  </View>
                  <Text style={[s.weekDayLabel, d.pct === 100 && { color: '#8B9A6B' }]}>{d.day}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Drill type breakdown */}
        {Object.keys(typeCount).length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>DRILL BREAKDOWN</Text>
            {Object.entries(typeCount).map(([type, counts], i) => {
              var pct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;
              var color = TYPE_COLORS[type] || Colors.textMuted;
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

        {/* Day by day */}
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
                        backgroundColor: d.pct === 100 ? '#8B9A6B' : Colors.primary,
                      }]} />
                    </View>
                    <Text style={[s.dayPct, d.pct === 100 && { color: '#8B9A6B' }]}>{d.done}/{d.total}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Player info */}
        {profile && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>TRAINING FOCUS</Text>
            <View style={s.focusRow}>
              <Text style={s.focusLabel}>Primary Goal</Text>
              <Text style={s.focusValue}>{profile.goal}</Text>
            </View>
            <View style={s.focusRow}>
              <Text style={s.focusLabel}>Main Weakness</Text>
              <Text style={[s.focusValue, { color: '#C47A6C' }]}>{profile.weakness}</Text>
            </View>
            <View style={s.focusRow}>
              <Text style={s.focusLabel}>Frequency</Text>
              <Text style={s.focusValue}>{profile.frequency}</Text>
            </View>
            <View style={s.focusRow}>
              <Text style={s.focusLabel}>Session Length</Text>
              <Text style={s.focusValue}>{profile.duration}</Text>
            </View>
          </View>
        )}

        {/* Empty state */}
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
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, paddingTop: 16, marginBottom: 20 },
  // Stats row
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16, alignItems: 'center',
  },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  statLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  // Section
  section: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 20, marginBottom: 14,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 14 },
  weekTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 18 },
  // Weekly bar chart
  weekBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120 },
  weekDay: { alignItems: 'center', flex: 1 },
  weekBarOuter: {
    width: 24, height: 100, backgroundColor: '#1A1A1A', borderRadius: 12, overflow: 'hidden',
    justifyContent: 'flex-end', marginBottom: 8,
  },
  weekBarInner: { width: '100%', borderRadius: 12, minHeight: 4 },
  weekDayLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  // Breakdown
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#222' },
  breakdownInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 100 },
  breakdownDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  breakdownBarOuter: { flex: 1, height: 6, backgroundColor: '#1A1A1A', borderRadius: 3, overflow: 'hidden' },
  breakdownBarInner: { height: 6, borderRadius: 3 },
  breakdownCount: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', width: 36, textAlign: 'right' },
  // Day by day
  dayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#222',
  },
  dayInfo: { flex: 1 },
  dayName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  dayFocus: { fontSize: 12, color: Colors.textMuted },
  dayRest: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },
  dayProgress: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayBarOuter: { width: 80, height: 6, backgroundColor: '#1A1A1A', borderRadius: 3, overflow: 'hidden' },
  dayBarInner: { height: 6, borderRadius: 3 },
  dayPct: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', width: 30, textAlign: 'right' },
  // Focus
  focusRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#222',
  },
  focusLabel: { fontSize: 13, color: Colors.textMuted },
  focusValue: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right', flex: 1, marginLeft: 16 },
  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
});
