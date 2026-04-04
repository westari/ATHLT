import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';

const MOCK_STATS = {
  currentStreak: 4,
  longestStreak: 7,
  totalSessions: 18,
  totalHours: 13.5,
  totalDrills: 108,
  thisWeekSessions: 3,
  thisWeekMinutes: 135,
};

const SKILL_BREAKDOWN = [
  { name: 'Ball Handling', level: 72, change: +8, sessions: 6 },
  { name: 'Shooting', level: 65, change: +5, sessions: 5 },
  { name: 'Finishing', level: 58, change: +12, sessions: 4 },
  { name: 'Defense', level: 45, change: +3, sessions: 2 },
  { name: 'Speed & Agility', level: 61, change: +6, sessions: 3 },
  { name: 'Basketball IQ', level: 40, change: 0, sessions: 1 },
];

const WEEKLY_ACTIVITY = [
  { week: 'W1', sessions: 4, minutes: 180 },
  { week: 'W2', sessions: 3, minutes: 135 },
  { week: 'W3', sessions: 5, minutes: 225 },
  { week: 'W4', sessions: 3, minutes: 135 },
];

const RECENT_SESSIONS = [
  { date: 'Today', focus: 'Shooting', duration: '45 min', drillsCompleted: 6, drillsTotal: 6 },
  { date: 'Yesterday', focus: 'Ball Handling', duration: '45 min', drillsCompleted: 6, drillsTotal: 6 },
  { date: 'Mon, Apr 5', focus: 'Left Hand Finishing', duration: '45 min', drillsCompleted: 5, drillsTotal: 6 },
  { date: 'Sat, Apr 3', focus: 'Full Game Skills', duration: '60 min', drillsCompleted: 6, drillsTotal: 6 },
  { date: 'Fri, Apr 2', focus: 'Defense & Agility', duration: '45 min', drillsCompleted: 4, drillsTotal: 6 },
  { date: 'Thu, Apr 1', focus: 'Shooting', duration: '45 min', drillsCompleted: 6, drillsTotal: 6 },
];

const ACHIEVEMENTS = [
  { name: 'First Session', description: 'Completed your first training session', earned: true, icon: '🏀' },
  { name: '3 Day Streak', description: 'Trained 3 days in a row', earned: true, icon: '🔥' },
  { name: '7 Day Streak', description: 'Trained 7 days in a row', earned: true, icon: '⚡' },
  { name: '10 Sessions', description: 'Completed 10 total sessions', earned: true, icon: '💪' },
  { name: 'Left Hand Warrior', description: 'Completed 5 left hand finishing sessions', earned: false, icon: '🤚' },
  { name: 'Sharpshooter', description: 'Completed 10 shooting sessions', earned: false, icon: '🎯' },
  { name: '30 Day Streak', description: 'Trained 30 days in a row', earned: false, icon: '👑' },
];

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState<'overview' | 'history' | 'achievements'>('overview');

  const maxSkillLevel = Math.max(...SKILL_BREAKDOWN.map(s => s.level));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <Text style={styles.headerTitle}>Progress</Text>

        {/* Tab selector */}
        <View style={styles.tabRow}>
          {(['overview', 'history', 'achievements'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, selectedTab === tab && styles.tabActive]}
              onPress={() => setSelectedTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedTab === 'overview' && (
          <>
            {/* Big stats row */}
            <View style={styles.bigStatsRow}>
              <View style={styles.bigStat}>
                <Text style={styles.bigStatValue}>{MOCK_STATS.currentStreak}</Text>
                <Text style={styles.bigStatLabel}>Day{'\n'}streak</Text>
              </View>
              <View style={styles.bigStatDivider} />
              <View style={styles.bigStat}>
                <Text style={styles.bigStatValue}>{MOCK_STATS.totalSessions}</Text>
                <Text style={styles.bigStatLabel}>Total{'\n'}sessions</Text>
              </View>
              <View style={styles.bigStatDivider} />
              <View style={styles.bigStat}>
                <Text style={styles.bigStatValue}>{MOCK_STATS.totalHours}h</Text>
                <Text style={styles.bigStatLabel}>Hours{'\n'}trained</Text>
              </View>
            </View>

            {/* This week card */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>THIS WEEK</Text>
              <View style={styles.thisWeekRow}>
                <View style={styles.thisWeekStat}>
                  <Text style={styles.thisWeekValue}>{MOCK_STATS.thisWeekSessions}</Text>
                  <Text style={styles.thisWeekLabel}>sessions</Text>
                </View>
                <View style={styles.thisWeekStat}>
                  <Text style={styles.thisWeekValue}>{MOCK_STATS.thisWeekMinutes}</Text>
                  <Text style={styles.thisWeekLabel}>minutes</Text>
                </View>
                <View style={styles.thisWeekStat}>
                  <Text style={styles.thisWeekValue}>{MOCK_STATS.totalDrills}</Text>
                  <Text style={styles.thisWeekLabel}>drills done</Text>
                </View>
              </View>
            </View>

            {/* Weekly activity chart */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>WEEKLY ACTIVITY</Text>
              <View style={styles.chartRow}>
                {WEEKLY_ACTIVITY.map((week, i) => {
                  const maxMinutes = Math.max(...WEEKLY_ACTIVITY.map(w => w.minutes));
                  const height = (week.minutes / maxMinutes) * 100;
                  const isCurrentWeek = i === WEEKLY_ACTIVITY.length - 1;
                  return (
                    <View key={i} style={styles.chartCol}>
                      <View style={styles.barContainer}>
                        <View
                          style={[
                            styles.bar,
                            { height: `${height}%` },
                            isCurrentWeek && styles.barActive,
                          ]}
                        />
                      </View>
                      <Text style={[styles.chartLabel, isCurrentWeek && styles.chartLabelActive]}>
                        {week.week}
                      </Text>
                      <Text style={styles.chartValue}>{week.sessions}x</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Skill breakdown */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>SKILL BREAKDOWN</Text>
              {SKILL_BREAKDOWN.map((skill, i) => (
                <View key={i} style={styles.skillRow}>
                  <View style={styles.skillInfo}>
                    <Text style={styles.skillName}>{skill.name}</Text>
                    <Text style={styles.skillSessions}>{skill.sessions} sessions</Text>
                  </View>
                  <View style={styles.skillBarContainer}>
                    <View style={styles.skillBarTrack}>
                      <View style={[styles.skillBarFill, { width: `${skill.level}%` }]} />
                    </View>
                  </View>
                  <View style={styles.skillChange}>
                    <Text style={[
                      styles.skillChangeText,
                      skill.change > 0 && styles.skillChangePositive,
                      skill.change === 0 && styles.skillChangeNeutral,
                    ]}>
                      {skill.change > 0 ? `+${skill.change}` : skill.change === 0 ? '—' : skill.change}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* AI insight */}
            <View style={styles.insightCard}>
              <View style={styles.insightDot} />
              <Text style={styles.insightText}>
                Your finishing improved the most this month (+12). Defense is your least trained skill — next week's plan will include more defensive drills to balance your development.
              </Text>
            </View>
          </>
        )}

        {selectedTab === 'history' && (
          <>
            <View style={styles.historyHeader}>
              <Text style={styles.historyCount}>{RECENT_SESSIONS.length} sessions</Text>
            </View>

            {RECENT_SESSIONS.map((session, i) => (
              <TouchableOpacity key={i} style={styles.sessionCard} activeOpacity={0.7}>
                <View style={styles.sessionLeft}>
                  <Text style={styles.sessionDate}>{session.date}</Text>
                  <Text style={styles.sessionFocus}>{session.focus}</Text>
                  <Text style={styles.sessionMeta}>
                    {session.duration} · {session.drillsCompleted}/{session.drillsTotal} drills
                  </Text>
                </View>
                <View style={styles.sessionRight}>
                  {session.drillsCompleted === session.drillsTotal ? (
                    <View style={styles.completeBadge}>
                      <Text style={styles.completeBadgeText}>✓</Text>
                    </View>
                  ) : (
                    <View style={styles.partialBadge}>
                      <Text style={styles.partialBadgeText}>
                        {Math.round((session.drillsCompleted / session.drillsTotal) * 100)}%
                      </Text>
                    </View>
                  )}
                  <ChevronRight size={14} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {selectedTab === 'achievements' && (
          <>
            <Text style={styles.achievementSubtitle}>
              {ACHIEVEMENTS.filter(a => a.earned).length}/{ACHIEVEMENTS.length} earned
            </Text>

            {ACHIEVEMENTS.map((achievement, i) => (
              <View
                key={i}
                style={[
                  styles.achievementCard,
                  !achievement.earned && styles.achievementCardLocked,
                ]}
              >
                <Text style={[styles.achievementIcon, !achievement.earned && styles.achievementIconLocked]}>
                  {achievement.icon}
                </Text>
                <View style={styles.achievementContent}>
                  <Text style={[
                    styles.achievementName,
                    !achievement.earned && styles.achievementNameLocked,
                  ]}>
                    {achievement.name}
                  </Text>
                  <Text style={styles.achievementDesc}>{achievement.description}</Text>
                </View>
                {achievement.earned && (
                  <View style={styles.earnedBadge}>
                    <Text style={styles.earnedBadgeText}>✓</Text>
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, paddingTop: 16, marginBottom: 16 },

  // Tabs
  tabRow: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 4, marginBottom: 20,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#1A1708' },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary },

  // Big stats
  bigStatsRow: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 24, marginBottom: 14,
    alignItems: 'center',
  },
  bigStat: { flex: 1, alignItems: 'center' },
  bigStatValue: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  bigStatLabel: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 15 },
  bigStatDivider: { width: 1, height: 40, backgroundColor: Colors.surfaceBorder },

  // Section card
  sectionCard: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 20, marginBottom: 14,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 16 },

  // This week
  thisWeekRow: { flexDirection: 'row', justifyContent: 'space-around' },
  thisWeekStat: { alignItems: 'center' },
  thisWeekValue: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  thisWeekLabel: { fontSize: 11, color: Colors.textMuted },

  // Chart
  chartRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120 },
  chartCol: { alignItems: 'center', flex: 1 },
  barContainer: { width: 28, height: 80, justifyContent: 'flex-end', marginBottom: 8 },
  bar: { width: 28, borderRadius: 6, backgroundColor: Colors.surfaceBorder },
  barActive: { backgroundColor: Colors.primary },
  chartLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  chartLabelActive: { color: Colors.primary, fontWeight: '700' },
  chartValue: { fontSize: 10, color: Colors.textMuted },

  // Skill breakdown
  skillRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  skillInfo: { width: 110 },
  skillName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  skillSessions: { fontSize: 10, color: Colors.textMuted },
  skillBarContainer: { flex: 1 },
  skillBarTrack: { height: 6, backgroundColor: '#1E1E1E', borderRadius: 3, overflow: 'hidden' },
  skillBarFill: { height: 6, backgroundColor: Colors.primary, borderRadius: 3 },
  skillChange: { width: 36, alignItems: 'flex-end' },
  skillChangeText: { fontSize: 13, fontWeight: '700' },
  skillChangePositive: { color: Colors.accent },
  skillChangeNeutral: { color: Colors.textMuted },

  // Insight
  insightCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 18, marginBottom: 14,
  },
  insightDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 4 },
  insightText: { fontSize: 13, color: Colors.primary, lineHeight: 19, flex: 1, fontWeight: '500' },

  // History
  historyHeader: { marginBottom: 14 },
  historyCount: { fontSize: 14, color: Colors.textSecondary },
  sessionCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16, marginBottom: 10,
  },
  sessionLeft: { flex: 1 },
  sessionDate: { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  sessionFocus: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  sessionMeta: { fontSize: 12, color: Colors.textSecondary },
  sessionRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  completeBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  completeBadgeText: { fontSize: 14, color: Colors.black, fontWeight: '800' },
  partialBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: Colors.primary + '20',
  },
  partialBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  // Achievements
  achievementSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  achievementCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16, marginBottom: 10,
  },
  achievementCardLocked: { opacity: 0.4 },
  achievementIcon: { fontSize: 28 },
  achievementIconLocked: { opacity: 0.5 },
  achievementContent: { flex: 1 },
  achievementName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  achievementNameLocked: { color: Colors.textMuted },
  achievementDesc: { fontSize: 12, color: Colors.textSecondary },
  earnedBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  earnedBadgeText: { fontSize: 12, color: Colors.black, fontWeight: '800' },
});
