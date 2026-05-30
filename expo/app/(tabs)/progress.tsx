import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CalendarDays, Dumbbell, Gamepad2, Film, ChevronRight, TrendingUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';
import GameHistory from '@/components/GameHistory';

type FilterTab = 'All' | 'Sessions' | 'Games' | 'Film';

const FILTER_TABS: FilterTab[] = ['All', 'Sessions', 'Games', 'Film'];
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, completedDrills, completedSessions, currentStreak, totalSessions } = usePlanStore();

  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');

  const onFilter = (f: FilterTab) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveFilter(f);
  };

  // Weekly activity dots — which days of the current plan have completed sessions
  const weekActivity = (plan?.days ?? []).map((d, i) => {
    if (d.isRest) return 'rest';
    const drills = (d.drills || []).map(x => resolvePlanDrill(x)).filter(Boolean);
    if (drills.length === 0) return 'empty';
    const done = drills.filter((_, j) => completedDrills[`${i}-${j}`]).length;
    if (done === drills.length) return 'done';
    if (done > 0) return 'partial';
    return 'none';
  });

  const showSessions = activeFilter === 'All' || activeFilter === 'Sessions';
  const showGames    = activeFilter === 'All' || activeFilter === 'Games';
  const showFilm     = activeFilter === 'All' || activeFilter === 'Film';

  const hasSomething = completedSessions.length > 0 || totalSessions > 0;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <Text style={s.pageTitle}>History</Text>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterRow}>
          {FILTER_TABS.map(f => (
            <TouchableOpacity
              key={f}
              style={[s.filterPill, activeFilter === f && s.filterPillActive]}
              onPress={() => onFilter(f)}
              activeOpacity={0.75}
            >
              <Text style={[s.filterPillText, activeFilter === f && s.filterPillTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Weekly activity calendar */}
        {plan && (
          <View style={s.weekCard}>
            <Text style={s.weekLabel}>THIS WEEK</Text>
            <View style={s.weekRow}>
              {weekActivity.map((status, i) => (
                <View key={i} style={s.weekDayCol}>
                  <Text style={s.weekDayLetter}>{DAY_LABELS[i]}</Text>
                  <View style={[
                    s.weekDot,
                    status === 'done'    && s.weekDotDone,
                    status === 'partial' && s.weekDotPartial,
                    status === 'rest'    && s.weekDotRest,
                    status === 'none'    && s.weekDotNone,
                  ]} />
                </View>
              ))}
            </View>
            <View style={s.weekLegend}>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: Colors.success }]} />
                <Text style={s.legendText}>Done</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: Colors.primary }]} />
                <Text style={s.legendText}>Partial</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: Colors.surfaceBorder }]} />
                <Text style={s.legendText}>Rest</Text>
              </View>
            </View>
          </View>
        )}

        {/* Summary stats row */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statBoxVal}>{currentStreak}</Text>
            <Text style={s.statBoxLabel}>STREAK</Text>
          </View>
          <View style={s.statBoxDivider} />
          <View style={s.statBox}>
            <Text style={s.statBoxVal}>{totalSessions}</Text>
            <Text style={s.statBoxLabel}>SESSIONS</Text>
          </View>
          <View style={s.statBoxDivider} />
          <View style={s.statBox}>
            <Text style={s.statBoxVal}>{Object.keys(completedDrills).length}</Text>
            <Text style={s.statBoxLabel}>DRILLS</Text>
          </View>
        </View>

        {/* Sessions section */}
        {showSessions && (
          <>
            {completedSessions.length > 0 ? (
              <>
                <Text style={s.sectionLabel}>SESSIONS</Text>
                {completedSessions.slice().reverse().slice(0, 10).map((session, i) => (
                  <TouchableOpacity
                    key={i}
                    style={s.sessionCard}
                    onPress={() => router.push('/progress' as any)}
                    activeOpacity={0.7}
                  >
                    <View style={s.sessionIconWrap}>
                      <Dumbbell size={16} color={Colors.primary} />
                    </View>
                    <View style={s.sessionInfo}>
                      <Text style={s.sessionName}>{session.focus || 'Workout'}</Text>
                      <Text style={s.sessionMeta}>
                        {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {session.drillsCompleted != null
                          ? ` · ${session.drillsCompleted}/${session.drillsTotal} drills`
                          : ''}
                        {session.duration ? ` · ${session.duration}` : ''}
                      </Text>
                    </View>
                    <View style={s.sessionRight}>
                      {session.drillsCompleted === session.drillsTotal && session.drillsTotal > 0 && (
                        <View style={s.completedBadge}>
                          <Text style={s.completedBadgeText}>Done</Text>
                        </View>
                      )}
                      <ChevronRight size={15} color={Colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            ) : activeFilter === 'Sessions' ? (
              <EmptyState
                Icon={Dumbbell}
                title="No sessions yet"
                body="Complete a workout from the Home tab to start tracking."
              />
            ) : null}
          </>
        )}

        {/* Games section */}
        {showGames && (
          <>
            <View style={s.gamesSectionHeader}>
              <Text style={s.sectionLabel}>GAMES</Text>
              <TouchableOpacity
                onPress={() => router.push('/game-history')}
                activeOpacity={0.7}
                hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
              >
                <Text style={s.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <GameHistory limit={3} />
          </>
        )}

        {/* Film section */}
        {showFilm && (
          <View style={s.filmSection}>
            <Text style={s.sectionLabel}>FILM</Text>
            <TouchableOpacity
              style={s.filmCta}
              onPress={() => router.push('/(tabs)/film')}
              activeOpacity={0.82}
            >
              <View style={s.filmCtaIcon}>
                <Film size={20} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.filmCtaTitle}>Go to Film Room</Text>
                <Text style={s.filmCtaSub}>Upload clips and analyze your game with AI</Text>
              </View>
              <ChevronRight size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Global empty state */}
        {!hasSomething && activeFilter === 'All' && !plan && (
          <EmptyState
            Icon={CalendarDays}
            title="No training history yet"
            body="Complete your first session from Home to start building your record."
          />
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function EmptyState({ Icon, title, body }: { Icon: any; title: string; body: string }) {
  return (
    <View style={s.emptyState}>
      <Icon size={36} color={Colors.textMuted} strokeWidth={1.5} />
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 0 },

  pageTitle: {
    fontSize: 28, fontWeight: '300', color: Colors.textPrimary,
    letterSpacing: -0.6, paddingTop: 16, marginBottom: 16, paddingHorizontal: 24,
  },

  filterScroll: { marginBottom: 20 },
  filterRow: { paddingHorizontal: 24, gap: 8, flexDirection: 'row' },
  filterPill: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.hairline,
  },
  filterPillActive: { backgroundColor: Colors.textPrimary, borderColor: Colors.textPrimary },
  filterPillText: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  filterPillTextActive: { color: Colors.white, fontWeight: '600' },

  weekCard: {
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.hairline,
    padding: 20, marginHorizontal: 24, marginBottom: 16,
  },
  weekLabel: {
    fontSize: 11, fontWeight: '500', color: Colors.textMuted,
    letterSpacing: 0.96, textTransform: 'uppercase', marginBottom: 14,
  },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  weekDayCol: { alignItems: 'center', gap: 6 },
  weekDayLetter: { fontSize: 11, fontWeight: '500', color: Colors.textMuted },
  weekDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.surfaceBorder,
  },
  weekDotDone:    { backgroundColor: Colors.success },
  weekDotPartial: { backgroundColor: Colors.primary },
  weekDotRest:    { backgroundColor: Colors.surfaceBorder, borderStyle: 'dashed', borderWidth: 1 },
  weekDotNone:    { backgroundColor: Colors.surfaceBorder },
  weekLegend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: Colors.textMuted },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.hairline,
    marginHorizontal: 24, marginBottom: 24, paddingVertical: 20,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statBoxVal: {
    fontSize: 30, fontWeight: '300', color: Colors.textPrimary,
    letterSpacing: -0.9, fontVariant: ['tabular-nums'],
  },
  statBoxLabel: {
    fontSize: 10, fontWeight: '500', color: Colors.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 3,
  },
  statBoxDivider: { width: 1, height: 36, backgroundColor: Colors.hairline },

  sectionLabel: {
    fontSize: 11, fontWeight: '500', color: Colors.textMuted,
    letterSpacing: 0.96, textTransform: 'uppercase',
    paddingHorizontal: 24, marginBottom: 10,
  },

  sessionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.hairline,
    padding: 14, marginHorizontal: 24, marginBottom: 8,
  },
  sessionIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  sessionInfo: { flex: 1 },
  sessionName: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary, letterSpacing: -0.2 },
  sessionMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  sessionRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  completedBadge: {
    backgroundColor: 'rgba(24,184,114,0.10)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100,
  },
  completedBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.success },

  gamesSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, marginBottom: 10,
  },
  seeAll: { fontSize: 13, fontWeight: '500', color: Colors.primary },

  filmSection: { marginBottom: 8 },
  filmCta: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.hairline,
    padding: 16, marginHorizontal: 24,
  },
  filmCtaIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  filmCtaTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.2 },
  filmCtaSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  emptyState: {
    alignItems: 'center', paddingTop: 48, paddingBottom: 24, paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17, fontWeight: '300', color: Colors.textBody,
    marginTop: 12, marginBottom: 6, letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20,
  },
});
