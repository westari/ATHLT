// expo/components/GameHistory.tsx
// Reads the user's logged games from Supabase and shows:
//   - A season summary header (W-L record, avg points/rebounds/assists)
//   - A list of games (newest first)
//
// Used in the Progress tab (inline) and linked from a dedicated screen.
// `limit` lets the Progress tab show a compact view (e.g. last 5) with a
// "See all" affordance handled by the parent.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Trophy, TrendingUp } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/constants/supabase';

export type GameRow = {
  id: string;
  opponent: string;
  result: 'W' | 'L' | null;
  your_score: number | null;
  opp_score: number | null;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  notes: string | null;
  played_at: string;
};

type Props = {
  /** Cap how many games to render (e.g. 5 for a compact Progress view). */
  limit?: number;
  /** Hide the season summary header (used when space is tight). */
  hideSummary?: boolean;
};

export default function GameHistory({ limit, hideSummary }: Props) {
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGames = useCallback(async () => {
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        setGames([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('games')
        .select('*')
        .eq('user_id', userId)
        .order('played_at', { ascending: false });

      if (limit) query = query.limit(limit);

      const { data, error: qErr } = await query;
      if (qErr) throw qErr;
      setGames((data || []) as GameRow[]);
    } catch (e: any) {
      console.warn('GameHistory load error', e);
      setError('Could not load games.');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  useFocusEffect(
    useCallback(() => {
      loadGames();
    }, [loadGames])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyBody}>{error}</Text>
      </View>
    );
  }

  if (games.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Trophy size={28} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>No games logged yet</Text>
        <Text style={styles.emptyBody}>
          Tap the + button and choose "Log a Game" after your next game.
        </Text>
      </View>
    );
  }

  // ===== Season summary =====
  const wins = games.filter(g => g.result === 'W').length;
  const losses = games.filter(g => g.result === 'L').length;

  const withStat = (key: 'points' | 'rebounds' | 'assists') =>
    games.filter(g => typeof g[key] === 'number');
  const avg = (key: 'points' | 'rebounds' | 'assists') => {
    const arr = withStat(key);
    if (arr.length === 0) return null;
    const sum = arr.reduce((acc, g) => acc + (g[key] as number), 0);
    return (sum / arr.length).toFixed(1);
  };

  const avgPts = avg('points');
  const avgReb = avg('rebounds');
  const avgAst = avg('assists');

  return (
    <View>
      {!hideSummary && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.recordWrap}>
              <Text style={styles.recordValue}>
                {wins}<Text style={styles.recordDash}>–</Text>{losses}
              </Text>
              <Text style={styles.recordLabel}>RECORD</Text>
            </View>
            <View style={styles.summaryStats}>
              <SummaryStat label="PTS" value={avgPts} />
              <SummaryStat label="REB" value={avgReb} />
              <SummaryStat label="AST" value={avgAst} />
            </View>
          </View>
          <Text style={styles.summaryHint}>
            {games.length} game{games.length === 1 ? '' : 's'} logged · averages per game
          </Text>
        </View>
      )}

      <View style={styles.list}>
        {games.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </View>
    </View>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryStatVal}>{value ?? '—'}</Text>
      <Text style={styles.summaryStatLbl}>{label}</Text>
    </View>
  );
}

function GameCard({ game }: { game: GameRow }) {
  const isWin = game.result === 'W';
  const dateLabel = formatDate(game.played_at);

  const statLine = [
    game.points != null ? `${game.points} pts` : null,
    game.rebounds != null ? `${game.rebounds} reb` : null,
    game.assists != null ? `${game.assists} ast` : null,
  ].filter(Boolean).join(' · ');

  const scoreLine =
    game.your_score != null && game.opp_score != null
      ? `${game.your_score}–${game.opp_score}`
      : null;

  return (
    <View style={styles.gameCard}>
      <View style={[
        styles.resultBadge,
        isWin ? styles.resultBadgeWin : styles.resultBadgeLoss,
      ]}>
        <Text style={[
          styles.resultBadgeText,
          isWin ? styles.resultBadgeTextWin : styles.resultBadgeTextLoss,
        ]}>
          {game.result ?? '—'}
        </Text>
      </View>

      <View style={styles.gameInfo}>
        <View style={styles.gameTopRow}>
          <Text style={styles.gameOpponent} numberOfLines={1}>
            vs {game.opponent}
          </Text>
          {scoreLine && <Text style={styles.gameScore}>{scoreLine}</Text>}
        </View>
        <Text style={styles.gameMeta}>
          {dateLabel}
          {statLine ? `  ·  ${statLine}` : ''}
        </Text>
        {game.notes ? (
          <Text style={styles.gameNotes} numberOfLines={2}>
            {game.notes}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  centered: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  emptyBody: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },

  // Summary
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 20,
    marginBottom: 14,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordWrap: {
    alignItems: 'flex-start',
  },
  recordValue: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  recordDash: {
    color: Colors.textMuted,
    fontWeight: '700',
  },
  recordLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.4,
    marginTop: 2,
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 22,
  },
  summaryStat: {
    alignItems: 'center',
  },
  summaryStatVal: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  summaryStatLbl: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginTop: 3,
  },
  summaryHint: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
    marginTop: 14,
  },

  // List
  list: {
    gap: 10,
  },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 14,
  },
  resultBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resultBadgeWin: {
    backgroundColor: 'rgba(61, 154, 92, 0.14)',
  },
  resultBadgeLoss: {
    backgroundColor: 'rgba(196, 69, 69, 0.14)',
  },
  resultBadgeText: {
    fontSize: 15,
    fontWeight: '800',
  },
  resultBadgeTextWin: {
    color: Colors.success,
  },
  resultBadgeTextLoss: {
    color: Colors.danger,
  },
  gameInfo: {
    flex: 1,
  },
  gameTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  gameOpponent: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    flex: 1,
  },
  gameScore: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    flexShrink: 0,
  },
  gameMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
    marginTop: 3,
  },
  gameNotes: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 6,
    lineHeight: 17,
    fontStyle: 'italic',
  },
});
