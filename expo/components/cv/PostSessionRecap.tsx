/**
 * PostSessionRecap — shown after a CV shooting session ends.
 *
 * Displays:
 *  - Overall FG% + makes/attempts
 *  - Best streak
 *  - Zone breakdown
 *  - Coach X analysis (loading → text reveal)
 *  - "Done" button
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, TrendingUp, Target, Zap } from 'lucide-react-native';
import Colors from '@/constants/colors';
import type { SessionRecap } from '@/lib/cv/ShotSync';
import type { TrackerSummary } from '@/lib/cv/ShotTracker';

interface Props {
  recap: SessionRecap | null;
  summary: TrackerSummary;
  loading: boolean;
  onDone: () => void;
}

export default function PostSessionRecap({ recap, summary, loading, onDone }: Props) {
  const insets  = useSafeAreaInsets();
  const fadeIn  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const makes      = recap?.makes ?? summary.makes;
  const total      = recap?.totalShots ?? summary.totalShots;
  const fgPct      = total > 0 ? ((makes / total) * 100).toFixed(1) : '0';
  const bestStreak = recap?.bestStreak ?? summary.bestStreak;
  const duration   = recap?.durationSeconds ?? Math.floor(summary.durationMs / 1000);
  const durationStr = duration >= 60
    ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`
    : `${duration}s`;

  const zoneStats = summary.sessionStats.byZone
    .filter(z => z.attempts >= 2)
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 5);

  const analysis = recap?.coachAnalysis;

  return (
    <Animated.View style={[styles.container, { paddingTop: insets.top, opacity: fadeIn }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.accentBar} />
          <Text style={styles.tagline}>SESSION COMPLETE</Text>
          <Text style={styles.headline}>
            {parseFloat(fgPct) >= 50 ? 'Shooting.' : 'Get back in the gym.'}
          </Text>
        </View>

        {/* FG% hero card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroFg}>{fgPct}%</Text>
          <Text style={styles.heroLabel}>FIELD GOAL</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{makes}</Text>
              <Text style={styles.heroStatLbl}>MAKES</Text>
            </View>
            <View style={styles.heroDiv} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{total}</Text>
              <Text style={styles.heroStatLbl}>ATTEMPTS</Text>
            </View>
            <View style={styles.heroDiv} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{bestStreak}</Text>
              <Text style={styles.heroStatLbl}>STREAK</Text>
            </View>
            <View style={styles.heroDiv} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{durationStr}</Text>
              <Text style={styles.heroStatLbl}>TIME</Text>
            </View>
          </View>
        </View>

        {/* Shot timeline */}
        {summary.shotEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SHOT CHART</Text>
            <View style={styles.timeline}>
              {summary.shotEvents.map((ev, i) => (
                <View
                  key={i}
                  style={[
                    styles.timelineDot,
                    ev.type === 'make' ? styles.dotMake : styles.dotMiss,
                  ]}
                />
              ))}
            </View>
            <View style={styles.timelineLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.dotMake]} />
                <Text style={styles.legendText}>Make</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.dotMiss]} />
                <Text style={styles.legendText}>Miss</Text>
              </View>
            </View>
          </View>
        )}

        {/* Zone breakdown */}
        {zoneStats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BY ZONE</Text>
            <View style={styles.zoneList}>
              {zoneStats.map((z) => {
                const pct = z.pct.toFixed(0);
                const barWidth = Math.max(4, z.pct);
                return (
                  <View key={z.zone} style={styles.zoneRow}>
                    <Text style={styles.zoneName} numberOfLines={1}>{z.zone}</Text>
                    <View style={styles.zoneBarWrap}>
                      <View style={[styles.zoneBar, { width: `${barWidth}%` }]} />
                    </View>
                    <Text style={styles.zonePct}>{pct}%</Text>
                    <Text style={styles.zoneAttempts}>{z.makes}/{z.attempts}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Coach X analysis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>COACH X</Text>
          <View style={styles.coachCard}>
            {loading ? (
              <View style={styles.coachLoading}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.coachLoadingText}>Coach X is breaking down your session...</Text>
              </View>
            ) : analysis ? (
              <>
                <Text style={styles.coachMessage}>{analysis.message}</Text>
                {analysis.planAdjustment.shouldAdjust && (
                  <View style={styles.adjustBadge}>
                    <Zap size={12} color={Colors.primary} />
                    <Text style={styles.adjustText}>
                      Plan adjusted: {analysis.planAdjustment.suggestedFocus}
                    </Text>
                  </View>
                )}
              </>
            ) : total < 3 ? (
              <Text style={styles.coachNoData}>Shoot at least 3 shots to get Coach X feedback.</Text>
            ) : (
              <Text style={styles.coachNoData}>Analysis unavailable. Check your connection.</Text>
            )}
          </View>
        </View>

        {/* Done button */}
        <TouchableOpacity style={styles.doneBtn} onPress={onDone} activeOpacity={0.85}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  // Header
  header: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  accentBar: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.primary, marginBottom: 8,
  },
  tagline: {
    fontSize: 11, fontWeight: '700', color: Colors.primary,
    letterSpacing: 2,
  },
  headline: {
    fontSize: 32, fontWeight: '900', color: Colors.textPrimary,
    letterSpacing: -1, textAlign: 'center',
  },

  // Hero FG card
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 24, alignItems: 'center', marginBottom: 20,
  },
  heroFg: {
    fontSize: 64, fontWeight: '900', color: Colors.textPrimary,
    letterSpacing: -3, lineHeight: 72,
  },
  heroLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 2, marginBottom: 20,
  },
  heroRow: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%', justifyContent: 'space-around',
  },
  heroStat: { alignItems: 'center', flex: 1 },
  heroStatVal: {
    fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5,
  },
  heroStatLbl: {
    fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.2, marginTop: 2,
  },
  heroDiv: { width: 1, height: 36, backgroundColor: Colors.surfaceBorder },

  // Section
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: Colors.primary,
    letterSpacing: 1.5, marginBottom: 12,
  },

  // Shot timeline
  timeline: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
  },
  timelineDot: {
    width: 12, height: 12, borderRadius: 6,
  },
  dotMake: { backgroundColor: '#4CAF50' },
  dotMiss: { backgroundColor: '#F44336' },
  timelineLegend: {
    flexDirection: 'row', gap: 16, marginTop: 10,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: Colors.textMuted, fontSize: 12, fontWeight: '500' },

  // Zone breakdown
  zoneList: {
    backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
  },
  zoneRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder, gap: 8,
  },
  zoneName: {
    width: 110, fontSize: 12, fontWeight: '600', color: Colors.textPrimary,
  },
  zoneBarWrap: {
    flex: 1, height: 5, backgroundColor: Colors.surfaceBorder, borderRadius: 3, overflow: 'hidden',
  },
  zoneBar: {
    height: 5, backgroundColor: Colors.primary, borderRadius: 3,
  },
  zonePct: {
    width: 36, fontSize: 12, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right',
  },
  zoneAttempts: {
    width: 32, fontSize: 11, color: Colors.textMuted, textAlign: 'right',
  },

  // Coach X card
  coachCard: {
    backgroundColor: 'rgba(212, 160, 23, 0.06)',
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(212, 160, 23, 0.25)',
    padding: 16, gap: 10,
  },
  coachLoading: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  coachLoadingText: {
    color: Colors.textMuted, fontSize: 13, flex: 1,
  },
  coachMessage: {
    color: Colors.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: '500',
  },
  coachNoData: {
    color: Colors.textMuted, fontSize: 13,
  },
  adjustBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(212, 160, 23, 0.12)',
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  adjustText: {
    color: Colors.primary, fontSize: 11, fontWeight: '700',
  },

  // Done button
  doneBtn: {
    backgroundColor: Colors.buttonDark,
    paddingVertical: 16, borderRadius: 100, alignItems: 'center',
    marginTop: 8,
  },
  doneBtnText: {
    color: Colors.buttonDarkText, fontSize: 16, fontWeight: '700',
  },
});
