/**
 * PostSessionRecap — shown after a CV shooting session ends.
 *
 * Layout (spec: PostSessionScreen.jsx):
 *  - Hero: big FG% number (64px / weight 300) + makes/attempts breakdown
 *  - Quick stats row: Streak / Duration / Shots
 *  - Zone breakdown card: bar-chart style per zone
 *  - Shot timeline: make/miss dot strip in chronological order
 *  - Coach X analysis card: gold-tinted, insight + plan adjustment
 *  - Done button
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Zap, TrendingUp } from 'lucide-react-native';
import Colors from '@/constants/colors';
import type { SessionRecap } from '@/lib/cv/ShotSync';
import type { TrackerSummary } from '@/lib/cv/ShotTracker';

interface Props {
  recap:   SessionRecap | null;
  summary: TrackerSummary;
  loading: boolean;
  onDone:  () => void;
}

export default function PostSessionRecap({ recap, summary, loading, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const makes      = recap?.makes      ?? summary.makes;
  const total      = recap?.totalShots ?? summary.totalShots;
  const fgPct      = total > 0 ? ((makes / total) * 100).toFixed(1) : '0.0';
  const bestStreak = recap?.bestStreak ?? summary.bestStreak;

  const rawDuration = recap?.durationSeconds ?? Math.floor((summary as any).durationMs / 1000 ?? 0);
  const durationStr = rawDuration >= 60
    ? `${Math.floor(rawDuration / 60)}m ${String(rawDuration % 60).padStart(2, '0')}s`
    : `${rawDuration}s`;

  const zoneStats = summary.sessionStats.byZone
    .filter(z => z.attempts >= 1)
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 6);

  const analysis   = recap?.coachAnalysis;
  const isPositive = parseFloat(fgPct) >= 50;

  return (
    <Animated.View style={[s.container, { opacity: fadeIn }]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header label */}
        <View style={s.header}>
          <View style={s.accentBar} />
          <Text style={s.tagline}>SESSION COMPLETE</Text>
          <Text style={s.headline}>
            {isPositive ? 'Shooting.' : 'Get back in the gym.'}
          </Text>
        </View>

        {/* Hero FG% card */}
        <View style={s.heroCard}>
          <Text style={s.heroLabel}>FIELD GOAL %</Text>
          <View style={s.heroNumRow}>
            <Text style={s.heroNum}>{fgPct.split('.')[0]}</Text>
            <View style={s.heroNumSuffix}>
              <Text style={s.heroNumDecimal}>.{fgPct.split('.')[1]}</Text>
              <Text style={s.heroNumPct}>%</Text>
            </View>
          </View>
          <Text style={s.heroBreakdown}>{makes} makes / {total} attempts</Text>

          {/* Quick stats row */}
          <View style={s.heroStatsRow}>
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{bestStreak}</Text>
              <Text style={s.heroStatLbl}>STREAK</Text>
            </View>
            <View style={s.heroStatDiv} />
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{durationStr}</Text>
              <Text style={s.heroStatLbl}>TIME</Text>
            </View>
            <View style={s.heroStatDiv} />
            <View style={s.heroStat}>
              <Text style={s.heroStatVal}>{total}</Text>
              <Text style={s.heroStatLbl}>SHOTS</Text>
            </View>
          </View>
        </View>

        {/* Zone breakdown */}
        {zoneStats.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>BY ZONE</Text>
            {zoneStats.map(z => {
              const pct = z.pct;
              const barWidth = Math.max(2, Math.min(100, pct));
              const barColor = pct >= 50 ? Colors.success : pct >= 33 ? Colors.primary : Colors.danger;
              return (
                <View key={z.zone} style={s.zoneRow}>
                  <Text style={s.zoneName} numberOfLines={1}>{z.zone}</Text>
                  <View style={s.zoneBarTrack}>
                    <View style={[s.zoneBarFill, { width: `${barWidth}%`, backgroundColor: barColor }]} />
                  </View>
                  <Text style={s.zonePct}>{pct.toFixed(0)}%</Text>
                  <Text style={s.zoneFraction}>{z.makes}/{z.attempts}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Shot timeline */}
        {summary.shotEvents.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>SHOT TIMELINE</Text>
            <View style={s.timeline}>
              {summary.shotEvents.map((ev, i) => (
                <View
                  key={i}
                  style={[
                    s.timelineDot,
                    ev.type === 'make' ? s.dotMake : s.dotMiss,
                  ]}
                />
              ))}
            </View>
            <View style={s.timelineLegend}>
              <View style={s.legendRow}>
                <View style={[s.legendDot, s.dotMake]} />
                <Text style={s.legendText}>Make</Text>
              </View>
              <View style={s.legendRow}>
                <View style={[s.legendDot, s.dotMiss]} />
                <Text style={s.legendText}>Miss</Text>
              </View>
            </View>
          </View>
        )}

        {/* Coach X analysis */}
        <View style={s.coachCard}>
          <View style={s.coachHeader}>
            <View style={s.coachLabelRow}>
              <Zap size={12} color={Colors.primary} />
              <Text style={s.coachLabel}>COACH X</Text>
            </View>
          </View>
          {loading ? (
            <View style={s.coachLoading}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={s.coachLoadingText}>Breaking down your session...</Text>
            </View>
          ) : analysis ? (
            <>
              <Text style={s.coachMessage}>"{analysis.message}"</Text>
              {analysis.planAdjustment?.shouldAdjust && (
                <View style={s.adjustBadge}>
                  <TrendingUp size={12} color={Colors.primary} />
                  <Text style={s.adjustText}>
                    Next focus: {analysis.planAdjustment.suggestedFocus}
                  </Text>
                </View>
              )}
            </>
          ) : total < 3 ? (
            <Text style={s.coachEmpty}>Shoot at least 3 shots to get feedback from Coach X.</Text>
          ) : (
            <Text style={s.coachEmpty}>Analysis unavailable — check your connection.</Text>
          )}
        </View>

        {/* Done button */}
        <TouchableOpacity style={s.doneBtn} onPress={onDone} activeOpacity={0.85}>
          <Text style={s.doneBtnText}>Done</Text>
        </TouchableOpacity>

      </ScrollView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24, paddingTop: 16 },

  header: { alignItems: 'center', paddingVertical: 12, gap: 6, marginBottom: 8 },
  accentBar: {
    width: 36, height: 3, borderRadius: 2, backgroundColor: Colors.primary, marginBottom: 6,
  },
  tagline: {
    fontSize: 11, fontWeight: '500', color: Colors.textMuted,
    letterSpacing: 1.1, textTransform: 'uppercase',
  },
  headline: {
    fontSize: 22, fontWeight: '300', color: Colors.textPrimary,
    letterSpacing: -0.5,
  },

  heroCard: {
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.hairline,
    padding: 24, marginBottom: 14, alignItems: 'center',
  },
  heroLabel: {
    fontSize: 11, fontWeight: '500', color: Colors.textMuted,
    letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 4,
  },
  heroNumRow: { flexDirection: 'row', alignItems: 'flex-start' },
  heroNum: {
    fontSize: 64, fontWeight: '300', color: Colors.textPrimary,
    letterSpacing: -2.5, fontVariant: ['tabular-nums'], lineHeight: 72,
  },
  heroNumSuffix: { paddingTop: 8, paddingLeft: 2 },
  heroNumDecimal: {
    fontSize: 28, fontWeight: '300', color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  heroNumPct: { fontSize: 20, fontWeight: '300', color: Colors.textMuted, marginTop: 4 },
  heroBreakdown: {
    fontSize: 14, color: Colors.textMuted, letterSpacing: -0.1, marginTop: 4, marginBottom: 20,
  },

  heroStatsRow: { flexDirection: 'row', width: '100%' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatVal: {
    fontSize: 24, fontWeight: '300', color: Colors.textPrimary,
    letterSpacing: -0.6, fontVariant: ['tabular-nums'],
  },
  heroStatLbl: {
    fontSize: 10, fontWeight: '500', color: Colors.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 3,
  },
  heroStatDiv: { width: 1, height: 36, backgroundColor: Colors.hairline, alignSelf: 'center' },

  card: {
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.hairline,
    padding: 20, marginBottom: 14,
  },
  cardTitle: {
    fontSize: 11, fontWeight: '500', color: Colors.textMuted,
    letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 14,
  },

  zoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 10,
  },
  zoneName: { fontSize: 13, color: Colors.textBody, width: 90, fontWeight: '500' },
  zoneBarTrack: {
    flex: 1, height: 6, backgroundColor: Colors.surfaceBorder,
    borderRadius: 3, overflow: 'hidden',
  },
  zoneBarFill: { height: 6, borderRadius: 3 },
  zonePct: {
    width: 36, fontSize: 13, fontWeight: '300', color: Colors.textPrimary,
    textAlign: 'right', fontVariant: ['tabular-nums'],
  },
  zoneFraction: {
    width: 38, fontSize: 11, color: Colors.textMuted,
    textAlign: 'right', fontVariant: ['tabular-nums'],
  },

  timeline: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10,
  },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  dotMake: { backgroundColor: Colors.success },
  dotMiss: { backgroundColor: Colors.danger },
  timelineLegend: { flexDirection: 'row', gap: 16 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: Colors.textMuted },

  coachCard: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 22, borderWidth: 1, borderColor: 'rgba(201,162,74,0.25)',
    padding: 20, marginBottom: 20,
  },
  coachHeader: { marginBottom: 10 },
  coachLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  coachLabel: {
    fontSize: 11, fontWeight: '600', color: Colors.primary,
    letterSpacing: 1.1, textTransform: 'uppercase',
  },
  coachLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coachLoadingText: { fontSize: 14, color: Colors.textMuted, fontStyle: 'italic' },
  coachMessage: {
    fontSize: 15, color: Colors.primaryPressed, lineHeight: 22,
    letterSpacing: -0.1, fontStyle: 'italic',
  },
  coachEmpty: { fontSize: 14, color: Colors.textMuted, fontStyle: 'italic' },
  adjustBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(201,162,74,0.12)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
    alignSelf: 'flex-start', marginTop: 10,
  },
  adjustText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  doneBtn: {
    backgroundColor: Colors.textPrimary, borderRadius: 100,
    paddingVertical: 16, alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 16, fontWeight: '600', color: Colors.white, letterSpacing: -0.2,
  },
});
