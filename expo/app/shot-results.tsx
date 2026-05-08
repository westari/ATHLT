import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Circle, Line, Rect, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, TrendingUp, Target, Zap, Share2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { supabase } from '@/constants/supabase';

// ----------------- Types -----------------

interface Shot {
  id: string;
  made: boolean;
  shot_index: number;
  court_x: number; // 0..1 (left to right of half court)
  court_y: number; // 0..1 (baseline to half court line)
  zone: string;
  release_angle?: number;
  arc_height?: number;
  detected_at: string;
}

interface ShotSession {
  id: string;
  drill_id: string;
  drill_name?: string;
  started_at: string;
  ended_at?: string;
  total_shots: number;
  makes: number;
  fg_percentage: number;
  notes?: string;
  coach_x_read?: string;
}

interface ZoneStats {
  zone: string;
  attempts: number;
  makes: number;
  pct: number;
}

// ----------------- Helpers -----------------

const ZONES = [
  'Left Corner 3',
  'Left Wing 3',
  'Top of Key 3',
  'Right Wing 3',
  'Right Corner 3',
  'Left Mid',
  'Free Throw',
  'Right Mid',
  'Left Block',
  'Right Block',
  'Restricted',
];

const computeZoneStats = (shots: Shot[]): ZoneStats[] => {
  const map: Record<string, { att: number; made: number }> = {};
  for (const z of ZONES) map[z] = { att: 0, made: 0 };
  for (const s of shots) {
    if (!map[s.zone]) map[s.zone] = { att: 0, made: 0 };
    map[s.zone].att += 1;
    if (s.made) map[s.zone].made += 1;
  }
  return ZONES.filter(z => map[z].att > 0).map(z => ({
    zone: z,
    attempts: map[z].att,
    makes: map[z].made,
    pct: map[z].att > 0 ? (map[z].made / map[z].att) * 100 : 0,
  }));
};

const bestSpot = (stats: ZoneStats[]): ZoneStats | null => {
  const filtered = stats.filter(s => s.attempts >= 3);
  if (filtered.length === 0) return null;
  return filtered.reduce((a, b) => (b.pct > a.pct ? b : a));
};

const worstSpot = (stats: ZoneStats[]): ZoneStats | null => {
  const filtered = stats.filter(s => s.attempts >= 3);
  if (filtered.length === 0) return null;
  return filtered.reduce((a, b) => (b.pct < a.pct ? b : a));
};

// ----------------- Court Component -----------------

interface CourtProps {
  shots: Shot[];
}

const COURT_W = 320;
const COURT_H = 300;

const ShotChart: React.FC<CourtProps> = ({ shots }) => {
  const courtColor = '#1A1A1A';
  const lineColor = '#666';

  return (
    <View style={styles.courtContainer}>
      <Svg width={COURT_W} height={COURT_H} viewBox={`0 0 ${COURT_W} ${COURT_H}`}>
        {/* court background */}
        <Rect x={0} y={0} width={COURT_W} height={COURT_H} fill={courtColor} rx={12} />

        {/* baseline */}
        <Line x1={0} y1={COURT_H - 10} x2={COURT_W} y2={COURT_H - 10} stroke={lineColor} strokeWidth={2} />

        {/* sidelines */}
        <Line x1={10} y1={0} x2={10} y2={COURT_H - 10} stroke={lineColor} strokeWidth={2} />
        <Line x1={COURT_W - 10} y1={0} x2={COURT_W - 10} y2={COURT_H - 10} stroke={lineColor} strokeWidth={2} />

        {/* free throw lane (paint) */}
        <Rect
          x={COURT_W / 2 - 60}
          y={COURT_H - 10 - 190}
          width={120}
          height={190}
          stroke={lineColor}
          strokeWidth={2}
          fill="none"
        />

        {/* free throw circle */}
        <Circle
          cx={COURT_W / 2}
          cy={COURT_H - 10 - 190}
          r={60}
          stroke={lineColor}
          strokeWidth={2}
          fill="none"
        />

        {/* hoop */}
        <Circle
          cx={COURT_W / 2}
          cy={COURT_H - 10 - 50}
          r={9}
          stroke={Colors.dark.gold}
          strokeWidth={2}
          fill="none"
        />

        {/* restricted area */}
        <Path
          d={`M ${COURT_W / 2 - 40} ${COURT_H - 10 - 50} A 40 40 0 0 1 ${COURT_W / 2 + 40} ${COURT_H - 10 - 50}`}
          stroke={lineColor}
          strokeWidth={1.5}
          fill="none"
        />

        {/* 3-point arc */}
        <Path
          d={`M 30 ${COURT_H - 10} L 30 ${COURT_H - 10 - 80} A 130 130 0 0 1 ${COURT_W - 30} ${COURT_H - 10 - 80} L ${COURT_W - 30} ${COURT_H - 10}`}
          stroke={lineColor}
          strokeWidth={2}
          fill="none"
        />

        {/* shot dots */}
        {shots.map((s, i) => {
          // map court_x (0..1) to court width with padding
          const px = 20 + s.court_x * (COURT_W - 40);
          const py = (COURT_H - 10) - (s.court_y * (COURT_H - 30));
          const color = s.made ? '#34D399' : '#EF4444';
          return (
            <G key={s.id || i}>
              <Circle cx={px} cy={py} r={6} fill={color} opacity={0.85} />
              <Circle cx={px} cy={py} r={6} stroke="#000" strokeWidth={1} fill="none" />
            </G>
          );
        })}
      </Svg>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#34D399' }]} />
          <Text style={styles.legendText}>Make</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendText}>Miss</Text>
        </View>
      </View>
    </View>
  );
};

// ----------------- Stat Card -----------------

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, highlight }) => (
  <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, highlight && { color: Colors.dark.gold }]}>{value}</Text>
    {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
  </View>
);

// ----------------- Main Screen -----------------

export default function ShotResultsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = params.sessionId;

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ShotSession | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [coachRead, setCoachRead] = useState<string>('');
  const [readLoading, setReadLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const { data: sessionData, error: sessionErr } = await supabase
        .from('shot_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionErr) throw sessionErr;
      setSession(sessionData);
      if (sessionData.coach_x_read) setCoachRead(sessionData.coach_x_read);

      const { data: shotsData, error: shotsErr } = await supabase
        .from('shots')
        .select('*')
        .eq('session_id', sessionId)
        .order('shot_index', { ascending: true });

      if (shotsErr) throw shotsErr;
      setShots(shotsData || []);

      // generate coach read if not present
      if (!sessionData.coach_x_read && shotsData && shotsData.length > 0) {
        generateCoachRead(sessionData, shotsData);
      }
    } catch (e) {
      console.error('[ShotResults] load failed', e);
    } finally {
      setLoading(false);
    }
  };

  const generateCoachRead = async (s: ShotSession, sh: Shot[]) => {
    setReadLoading(true);
    try {
      const zoneStats = computeZoneStats(sh);
      const best = bestSpot(zoneStats);
      const worst = worstSpot(zoneStats);

      const res = await fetch(
        'https://collectiq-xi.vercel.app/api/coach-shot-read',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: s.id,
            drillName: s.drill_name,
            totalShots: s.total_shots,
            makes: s.makes,
            fgPct: s.fg_percentage,
            zoneStats,
            bestZone: best?.zone,
            worstZone: worst?.zone,
          }),
        }
      );

      const json = await res.json();
      if (json.read) {
        setCoachRead(json.read);
        // save back to supabase
        await supabase
          .from('shot_sessions')
          .update({ coach_x_read: json.read })
          .eq('id', s.id);
      }
    } catch (e) {
      console.error('[ShotResults] coach read failed', e);
    } finally {
      setReadLoading(false);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleNextDrill = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // pop back to today; today.tsx handles drill progression
    router.back();
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.dark.gold} size="large" />
        <Text style={styles.loadingText}>Loading session...</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ArrowLeft size={22} color={Colors.dark.text} />
          </TouchableOpacity>
        </View>
        <View style={{ padding: 24 }}>
          <Text style={styles.errorTitle}>No session found</Text>
          <Text style={styles.errorSub}>We couldn't load your shot data.</Text>
        </View>
      </View>
    );
  }

  const zoneStats = computeZoneStats(shots);
  const best = bestSpot(zoneStats);
  const worst = worstSpot(zoneStats);
  const fgPct = session.fg_percentage || (session.total_shots > 0 ? (session.makes / session.total_shots) * 100 : 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shot Results</Text>
        <TouchableOpacity style={styles.shareBtn}>
          <Share2 size={20} color={Colors.dark.subtext} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Drill name */}
        <Text style={styles.drillName}>{session.drill_name || 'Shooting Session'}</Text>
        <Text style={styles.drillSub}>
          {new Date(session.started_at).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </Text>

        {/* Top stats row */}
        <View style={styles.statsRow}>
          <StatCard
            label="Made"
            value={`${session.makes}/${session.total_shots}`}
            highlight
          />
          <StatCard
            label="FG%"
            value={`${fgPct.toFixed(0)}%`}
          />
          <StatCard
            label="Streak"
            value="—"
            sub="best run"
          />
        </View>

        {/* Shot Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shot Chart</Text>
          <ShotChart shots={shots} />
        </View>

        {/* Coach X read */}
        <View style={styles.coachReadCard}>
          <View style={styles.coachReadHeader}>
            <Image
              source={require('@/assets/images/coach-x-small.png')}
              style={styles.coachAvatar}
            />
            <Text style={styles.coachReadTitle}>Coach X's Read</Text>
          </View>
          {readLoading ? (
            <View style={styles.coachLoadingRow}>
              <ActivityIndicator color={Colors.dark.gold} size="small" />
              <Text style={styles.coachLoadingText}>Reading your session...</Text>
            </View>
          ) : coachRead ? (
            <Text style={styles.coachReadText}>{coachRead}</Text>
          ) : (
            <Text style={styles.coachReadText}>
              Solid work. {session.makes} of {session.total_shots} from the floor.
              {best && ` Best spot was ${best.zone.toLowerCase()} at ${best.pct.toFixed(0)}%.`}
              {worst && ` Tomorrow we attack ${worst.zone.toLowerCase()}.`}
            </Text>
          )}
        </View>

        {/* Best / Worst spots */}
        {(best || worst) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>By Zone</Text>
            {best && (
              <View style={styles.zoneRow}>
                <View style={[styles.zoneIcon, { backgroundColor: 'rgba(52, 211, 153, 0.15)' }]}>
                  <TrendingUp size={16} color="#34D399" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.zoneLabel}>Best Spot</Text>
                  <Text style={styles.zoneName}>{best.zone}</Text>
                </View>
                <Text style={[styles.zonePct, { color: '#34D399' }]}>
                  {best.pct.toFixed(0)}%
                </Text>
              </View>
            )}
            {worst && best?.zone !== worst.zone && (
              <View style={styles.zoneRow}>
                <View style={[styles.zoneIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <Target size={16} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.zoneLabel}>Needs Work</Text>
                  <Text style={styles.zoneName}>{worst.zone}</Text>
                </View>
                <Text style={[styles.zonePct, { color: '#EF4444' }]}>
                  {worst.pct.toFixed(0)}%
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Zone breakdown */}
        {zoneStats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Zones</Text>
            {zoneStats
              .sort((a, b) => b.pct - a.pct)
              .map(z => (
                <View key={z.zone} style={styles.zoneStatRow}>
                  <Text style={styles.zoneStatName}>{z.zone}</Text>
                  <Text style={styles.zoneStatStat}>
                    {z.makes}/{z.attempts}
                  </Text>
                  <Text style={styles.zoneStatPct}>{z.pct.toFixed(0)}%</Text>
                </View>
              ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleNextDrill}>
          <Zap size={18} color="#000" style={{ marginRight: 8 }} />
          <Text style={styles.primaryBtnText}>Continue Workout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingText: {
    color: Colors.dark.subtext,
    textAlign: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 17,
    fontWeight: '700',
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  drillName: {
    color: Colors.dark.text,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 8,
  },
  drillSub: {
    color: Colors.dark.subtext,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statCardHighlight: {
    borderColor: 'rgba(255, 215, 0, 0.3)',
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
  },
  statLabel: {
    color: Colors.dark.subtext,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statValue: {
    color: Colors.dark.text,
    fontSize: 22,
    fontWeight: '800',
  },
  statSub: {
    color: Colors.dark.subtext,
    fontSize: 11,
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  courtContainer: {
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  legend: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: Colors.dark.subtext,
    fontSize: 12,
  },
  coachReadCard: {
    backgroundColor: 'rgba(255, 215, 0, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  coachReadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  coachAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  coachReadTitle: {
    color: Colors.dark.gold,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coachReadText: {
    color: Colors.dark.text,
    fontSize: 15,
    lineHeight: 22,
  },
  coachLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coachLoadingText: {
    color: Colors.dark.subtext,
    fontSize: 14,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  zoneIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneLabel: {
    color: Colors.dark.subtext,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  zoneName: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  zonePct: {
    fontSize: 18,
    fontWeight: '800',
  },
  zoneStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  zoneStatName: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 14,
  },
  zoneStatStat: {
    color: Colors.dark.subtext,
    fontSize: 13,
    width: 50,
    textAlign: 'right',
  },
  zoneStatPct: {
    color: Colors.dark.gold,
    fontSize: 14,
    fontWeight: '700',
    width: 50,
    textAlign: 'right',
  },
  errorTitle: {
    color: Colors.dark.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorSub: {
    color: Colors.dark.subtext,
    fontSize: 15,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.dark.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  primaryBtn: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
