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
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const TODAY_SESSION = {
  focus: 'Ball Handling',
  duration: '45 min',
  drills: [
    { name: 'Dynamic warmup', time: '5 min', type: 'warmup', detail: 'Light jog, high knees, butt kicks, arm circles' },
    { name: 'Stationary combo dribbles', time: '8 min', type: 'skill', detail: 'Crossover, between legs, behind back — 30 sec each, both hands' },
    { name: 'Full court attack dribbles', time: '10 min', type: 'skill', detail: 'Speed dribble, hesitation, in-and-out — full court and back' },
    { name: 'Pressure handling drill', time: '10 min', type: 'skill', detail: 'Dribble in a tight space with cones, react to visual cues' },
    { name: 'Free throw shooting', time: '7 min', type: 'shooting', detail: '3 sets of 10 — focus on routine consistency' },
    { name: 'Lane slides', time: '5 min', type: 'conditioning', detail: 'Defensive slides baseline to baseline — 8 reps' },
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
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpandedDrill(expandedDrill === index ? null : index);
  };

  const handleDrillComplete = (index: number) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setCompletedDrills({ ...completedDrills, [index]: !completedDrills[index] });
  };

  const completedCount = Object.values(completedDrills).filter(Boolean).length;
  const totalDrills = TODAY_SESSION.drills.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerDate}>Monday, April 7</Text>
            <Text style={styles.headerTitle}>Today's Session</Text>
          </View>
          <View style={styles.streakBadge}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>3</Text>
          </View>
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

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(completedCount / totalDrills) * 100}%` }]} />
          </View>

          {/* Drills */}
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
                  {isExpanded && (
                    <Text style={styles.drillDetail}>{drill.detail}</Text>
                  )}
                </View>

                <Text style={styles.expandArrow}>{isExpanded ? '−' : '+'}</Text>
              </TouchableOpacity>
            );
          })}

          {/* Start button */}
          <TouchableOpacity style={styles.startButton} activeOpacity={0.85}>
            <Text style={styles.startButtonText}>
              {completedCount > 0 && completedCount < totalDrills ? 'CONTINUE SESSION' : completedCount === totalDrills ? 'SESSION COMPLETE ✓' : 'START SESSION'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>3</Text>
            <Text style={styles.statLabel}>Sessions{'\n'}this week</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>2h 15m</Text>
            <Text style={styles.statLabel}>Total time{'\n'}trained</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.accent }]}>3</Text>
            <Text style={styles.statLabel}>Day{'\n'}streak</Text>
          </View>
        </View>

        {/* Up next */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>UP NEXT — TOMORROW</Text>
          <View style={styles.upNextContent}>
            <View>
              <Text style={styles.upNextFocus}>Left Hand Finishing</Text>
              <Text style={styles.upNextMeta}>45 min · 6 drills · Mikan drill, reverse layups, floaters</Text>
            </View>
          </View>
        </View>

        {/* AI insight */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>AI INSIGHT</Text>
          <View style={styles.insightContent}>
            <Text style={styles.insightIcon}>⚡</Text>
            <Text style={styles.insightText}>
              You've been consistent with ball handling this week. Your plan shifts to finishing and shooting next week to build on that foundation.
            </Text>
          </View>
        </View>

        {/* Film prompt */}
        <TouchableOpacity style={styles.filmCard} activeOpacity={0.8}>
          <Text style={styles.filmIcon}>🎬</Text>
          <View style={styles.filmContent}>
            <Text style={styles.filmTitle}>Upload game film</Text>
            <Text style={styles.filmSubtitle}>Get AI analysis on your strengths and weaknesses from real game footage</Text>
          </View>
          <Text style={styles.filmArrow}>→</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerDate: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  streakEmoji: {
    fontSize: 16,
  },
  streakText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sessionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 20,
    marginBottom: 16,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sessionFocus: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sessionMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  durationBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  durationBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.black,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#252525',
    borderRadius: 2,
    marginBottom: 18,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  drillRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#222222',
    gap: 12,
  },
  drillRowDone: {
    opacity: 0.45,
  },
  completeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkmark: {
    fontSize: 13,
    color: Colors.black,
    fontWeight: '800',
  },
  drillInfo: {
    flex: 1,
  },
  drillName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 5,
  },
  drillNameDone: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  drillMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeTag: {
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  typeTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  drillTime: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  drillDetail: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginTop: 10,
  },
  expandArrow: {
    fontSize: 18,
    color: Colors.textMuted,
    marginTop: 4,
  },
  startButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 16,
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.black,
    letterSpacing: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 18,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  upNextContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upNextFocus: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  upNextMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  insightContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  insightIcon: {
    fontSize: 16,
  },
  insightText: {
    fontSize: 13,
    color: Colors.primary,
    lineHeight: 19,
    flex: 1,
    fontWeight: '500',
  },
  filmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141210',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2518',
    padding: 18,
    marginBottom: 12,
    gap: 14,
  },
  filmIcon: {
    fontSize: 28,
  },
  filmContent: {
    flex: 1,
  },
  filmTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  filmSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  filmArrow: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: '600',
  },
});
