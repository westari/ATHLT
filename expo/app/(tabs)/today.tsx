import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import type { PlanDay } from '@/store/planStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

// ─── WELCOME SCREEN (shown before onboarding) ───
function WelcomeView({ onGetStarted, onSignIn }: { onGetStarted: () => void; onSignIn: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[welcomeStyles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={welcomeStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={welcomeStyles.header}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={welcomeStyles.headerLogo}
            resizeMode="contain"
          />
        </View>

        <View style={welcomeStyles.previewCard}>
          <View style={welcomeStyles.cardHeader}>
            <View>
              <Text style={welcomeStyles.cardGreeting}>TODAY'S SESSION</Text>
              <Text style={welcomeStyles.cardTitle}>Left Hand Focus</Text>
            </View>
            <View style={welcomeStyles.cardBadge}>
              <Text style={welcomeStyles.cardBadgeText}>45 MIN</Text>
            </View>
          </View>

          {[
            { name: 'Dynamic warmup + ball handling', meta: '5 min · 3 drills', done: true, active: false },
            { name: 'Left hand finishing package', meta: '20 min · Mikan drill, reverse layups, floaters', done: false, active: true },
            { name: 'Catch & shoot from weak spots', meta: '15 min · Left wing, top of key, left corner', done: false, active: false },
            { name: 'Game-speed suicides', meta: '5 min · Conditioning finisher', done: false, active: false },
          ].map((drill, i) => (
            <View key={i} style={[welcomeStyles.drillItem, i === 3 && { borderBottomWidth: 0 }]}>
              <View style={[welcomeStyles.drillDot, drill.active && welcomeStyles.drillDotActive]} />
              <View style={welcomeStyles.drillContent}>
                <Text style={[welcomeStyles.drillName, drill.active && welcomeStyles.drillNameActive]}>{drill.name}</Text>
                <Text style={welcomeStyles.drillMeta}>{drill.meta}</Text>
              </View>
              {drill.done && <Text style={welcomeStyles.drillCheck}>✓</Text>}
              {drill.active && <Text style={welcomeStyles.drillArrow}>→</Text>}
            </View>
          ))}

          <View style={welcomeStyles.insightBox}>
            <Text style={welcomeStyles.insightIcon}>⚡</Text>
            <Text style={welcomeStyles.insightText}>
              Based on your last game: your left hand finishing was 2/8. Today's plan targets that.
            </Text>
          </View>
        </View>

        <Text style={welcomeStyles.headline}>
         TEST - CAN YOU SEE THIS?
        </Text>

        <TouchableOpacity style={welcomeStyles.primaryButton} onPress={onGetStarted} activeOpacity={0.85}>
          <Text style={welcomeStyles.primaryButtonText}>GET STARTED — IT'S FREE</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onSignIn} activeOpacity={0.7} style={welcomeStyles.signInButton}>
          <Text style={welcomeStyles.signInText}>
            Already have an account? <Text style={welcomeStyles.signInLink}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── MAIN TODAY SCREEN ───
export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, profile, completedDrills, toggleDrill, currentStreak, totalSessions, loadFromStorage } = usePlanStore();
  const [expandedDrill, setExpandedDrill] = useState<number | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadFromStorage().then(() => {
      setIsReady(true);
    });
  }, []);

  // Find today's day index
  useEffect(() => {
    if (plan?.days) {
      const today = DAYS_OF_WEEK[new Date().getDay()];
      const idx = plan.days.findIndex(d =>
        d.day.toLowerCase().startsWith(today.toLowerCase().slice(0, 3))
      );
      if (idx >= 0) setSelectedDayIndex(idx);
    }
  }, [plan]);

  // Show nothing while loading from storage
  if (!isReady) {
    return <View style={[styles.container, { paddingTop: insets.top }]} />;
  }

  // Show welcome screen if no profile (hasn't done onboarding)
  if (!profile) {
    return (
      <WelcomeView
        onGetStarted={() => {
          if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/onboarding' as any);
        }}
        onSignIn={() => {
          if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      />
    );
  }

  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const hasPlan = plan && plan.days && plan.days.length > 0;
  const currentDay: PlanDay | null = hasPlan ? plan.days[selectedDayIndex] : null;
  const session = currentDay && !currentDay.isRest ? currentDay : null;

  const FALLBACK_DRILLS = [
    { name: 'Dynamic warmup', time: '5 min', type: 'warmup' as const, detail: 'Light jog, high knees, butt kicks, arm circles' },
    { name: 'Stationary combo dribbles', time: '8 min', type: 'skill' as const, detail: 'Crossover, between legs, behind back — 30 sec each' },
    { name: 'Full court attack dribbles', time: '10 min', type: 'skill' as const, detail: 'Speed dribble, hesitation, in-and-out — full court and back' },
    { name: 'Pressure handling drill', time: '10 min', type: 'skill' as const, detail: 'Dribble in a tight space with cones' },
    { name: 'Free throw shooting', time: '7 min', type: 'shooting' as const, detail: '3 sets of 10' },
    { name: 'Lane slides', time: '5 min', type: 'conditioning' as const, detail: 'Defensive slides baseline to baseline' },
  ];

  const drills = session?.drills || FALLBACK_DRILLS;
  const sessionFocus = session?.focus || 'Ball Handling';
  const sessionDuration = session?.duration || '45 min';

  const handleDrillPress = (index: number) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedDrill(expandedDrill === index ? null : index);
  };

  const handleDrillComplete = (index: number) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleDrill(selectedDayIndex, index);
  };

  const handleDaySelect = (index: number) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDayIndex(index);
    setExpandedDrill(null);
  };

  const isDrillDone = (index: number) => completedDrills[`${selectedDayIndex}-${index}`] || false;
  const completedCount = drills.filter((_, i) => isDrillDone(i)).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <View style={styles.header}>
          <View>
            <Text style={styles.headerDate}>{todayDate}</Text>
            <Text style={styles.headerTitle}>
              {hasPlan ? plan.weekTitle : 'Today\'s Session'}
            </Text>
          </View>
          {currentStreak > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>{currentStreak} day streak</Text>
            </View>
          )}
        </View>

        {hasPlan && plan.aiInsight && (
          <View style={styles.insightCard}>
            <View style={styles.insightDot} />
            <Text style={styles.insightText}>{plan.aiInsight}</Text>
          </View>
        )}

        {hasPlan && (
          <View style={styles.weekBar}>
            {plan.days.map((day, i) => {
              const isSelected = i === selectedDayIndex;
              const isRest = day.isRest;
              const dayDrills = day.drills || [];
              const dayCompleted = dayDrills.filter((_, di) => completedDrills[`${i}-${di}`]).length;
              const allDone = dayDrills.length > 0 && dayCompleted === dayDrills.length;

              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.weekDay, isSelected && styles.weekDaySelected]}
                  onPress={() => handleDaySelect(i)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.weekDayLabel, isSelected && styles.weekDayLabelActive]}>
                    {day.day}
                  </Text>
                  <View style={[
                    styles.weekDot,
                    allDone && styles.weekDotDone,
                    isSelected && !allDone && styles.weekDotToday,
                    isRest && styles.weekDotRest,
                  ]}>
                    {allDone && <Text style={styles.weekCheck}>✓</Text>}
                    {isSelected && !allDone && !isRest && <View style={styles.weekTodayInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {currentDay?.isRest && (
          <View style={styles.restCard}>
            <Text style={styles.restTitle}>Recovery Day</Text>
            <Text style={styles.restSubtitle}>
              Your body builds muscle during rest, not during training. Stretch, hydrate, and get good sleep tonight.
            </Text>
          </View>
        )}

        {!currentDay?.isRest && (
          <View style={styles.sessionCard}>
            <View style={styles.sessionHeader}>
              <View>
                <Text style={styles.sessionFocus}>{sessionFocus}</Text>
                <Text style={styles.sessionMeta}>
                  {sessionDuration} · {drills.length} drills
                  {completedCount > 0 && ` · ${completedCount}/${drills.length} done`}
                </Text>
              </View>
              <View style={styles.durationBadge}>
                <Text style={styles.durationBadgeText}>{sessionDuration}</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(completedCount / Math.max(drills.length, 1)) * 100}%` }]} />
            </View>

            {drills.map((drill, index) => {
              const isDone = isDrillDone(index);
              const isExpanded = expandedDrill === index;
              const typeColor = TYPE_COLORS[drill.type] || Colors.textMuted;
              const typeLabel = TYPE_LABELS[drill.type] || drill.type?.toUpperCase() || '';

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
                    {isExpanded && drill.detail && (
                      <Text style={styles.drillDetail}>{drill.detail}</Text>
                    )}
                  </View>

                  <Text style={styles.expandArrow}>{isExpanded ? '−' : '+'}</Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.startButton}
              activeOpacity={0.85}
              onPress={() => router.push('/session' as any)}
            >
              <Text style={styles.startButtonText}>
                {completedCount > 0 && completedCount < drills.length
                  ? 'CONTINUE SESSION'
                  : completedCount === drills.length
                  ? 'SESSION COMPLETE'
                  : 'START SESSION'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalSessions}</Text>
            <Text style={styles.statLabel}>Total{'\n'}sessions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{currentStreak}</Text>
            <Text style={styles.statLabel}>Day{'\n'}streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: Colors.accent }]}>W1</Text>
            <Text style={styles.statLabel}>Current{'\n'}week</Text>
          </View>
        </View>

        {hasPlan && (() => {
          const nextIdx = plan.days.findIndex((d, i) => i > selectedDayIndex && !d.isRest);
          const nextDay = nextIdx >= 0 ? plan.days[nextIdx] : null;
          if (!nextDay) return null;
          return (
            <TouchableOpacity
              style={styles.upNextCard}
              activeOpacity={0.8}
              onPress={() => handleDaySelect(nextIdx)}
            >
              <View style={styles.upNextContent}>
                <Text style={styles.upNextLabel}>NEXT SESSION — {nextDay.day.toUpperCase()}</Text>
                <Text style={styles.upNextFocus}>{nextDay.focus}</Text>
                <Text style={styles.upNextMeta}>{nextDay.duration} · {nextDay.drills.length} drills</Text>
              </View>
              <ChevronRight size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          );
        })()}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

// ─── WELCOME STYLES ───
const welcomeStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20 },
  header: { paddingTop: 16, paddingBottom: 24, alignItems: 'center' },
  headerLogo: { width: 180, height: 50 },
  previewCard: {
    backgroundColor: '#141414', borderRadius: 20,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 20, marginBottom: 28,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  cardGreeting: {
    fontSize: 13, color: Colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 4,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  cardBadge: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  cardBadgeText: { fontSize: 12, fontWeight: '800', color: Colors.black, letterSpacing: 1 },
  drillItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1E1E1E', gap: 12,
  },
  drillDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.textMuted },
  drillDotActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  drillContent: { flex: 1 },
  drillName: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, marginBottom: 2 },
  drillNameActive: { color: Colors.textPrimary },
  drillMeta: { fontSize: 12, color: Colors.textMuted },
  drillCheck: { fontSize: 14, color: Colors.accent },
  drillArrow: { fontSize: 16, color: Colors.primary, fontWeight: '700' },
  insightBox: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#1A1A1A',
    borderRadius: 12, padding: 14, marginTop: 16, gap: 10,
    borderWidth: 1, borderColor: '#252525',
  },
  insightIcon: { fontSize: 16 },
  insightText: { fontSize: 13, color: Colors.primary, lineHeight: 18, flex: 1, fontWeight: '500' },
  headline: {
    fontSize: 26, fontWeight: '800', color: Colors.textPrimary,
    textAlign: 'center', lineHeight: 34, marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: Colors.primary, borderRadius: 16,
    paddingVertical: 20, alignItems: 'center', width: '100%',
  },
  primaryButtonText: { fontSize: 15, fontWeight: '900', color: Colors.black, letterSpacing: 2 },
  signInButton: { marginTop: 18, paddingVertical: 8 },
  signInText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  signInLink: { color: Colors.primary, fontWeight: '600' },
});

// ─── TODAY STYLES ───
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 20 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 16, paddingBottom: 16,
  },
  headerDate: { fontSize: 13, color: Colors.textMuted, marginBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  streakBadge: {
    backgroundColor: Colors.surface, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  streakText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  insightCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16, marginBottom: 16,
  },
  insightDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 4 },
  insightText: { fontSize: 13, color: Colors.primary, lineHeight: 19, flex: 1, fontWeight: '500' },
  weekBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 12, marginBottom: 16,
  },
  weekDay: { alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingVertical: 4, borderRadius: 8 },
  weekDaySelected: { backgroundColor: '#1A1708' },
  weekDayLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  weekDayLabelActive: { color: Colors.primary },
  weekDot: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1.5, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  weekDotDone: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  weekDotToday: { borderColor: Colors.primary, borderWidth: 2 },
  weekDotRest: { borderStyle: 'dashed' as any },
  weekCheck: { fontSize: 11, color: Colors.black, fontWeight: '800' },
  weekTodayInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },
  restCard: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 28, alignItems: 'center', marginBottom: 16,
  },
  restTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  restSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
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
