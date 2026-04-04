import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MOCK_WEEK = [
  {
    day: 'Mon',
    date: 'Apr 7',
    focus: 'Ball Handling',
    duration: '45 min',
    drills: [
      { name: 'Dynamic warmup', time: '5 min', type: 'warmup', done: false },
      { name: 'Stationary combo dribbles', time: '8 min', type: 'skill', done: false, detail: 'Crossover, between legs, behind back — 30 sec each, both hands' },
      { name: 'Full court attack dribbles', time: '10 min', type: 'skill', done: false, detail: 'Speed dribble, hesitation, in-and-out — full court and back' },
      { name: 'Pressure handling drill', time: '10 min', type: 'skill', done: false, detail: 'Dribble in a tight space with cones, react to visual cues' },
      { name: 'Free throw shooting', time: '7 min', type: 'shooting', done: false, detail: '3 sets of 10 — focus on routine consistency' },
      { name: 'Conditioning: lane slides', time: '5 min', type: 'conditioning', done: false },
    ],
  },
  {
    day: 'Tue',
    date: 'Apr 8',
    focus: 'Left Hand Finishing',
    duration: '45 min',
    drills: [
      { name: 'Dynamic warmup', time: '5 min', type: 'warmup', done: false },
      { name: 'Mikan drill (left only)', time: '8 min', type: 'skill', done: false, detail: 'Continuous left hand layups, both sides of the rim' },
      { name: 'Reverse layups — left hand', time: '8 min', type: 'skill', done: false, detail: 'Drive baseline, finish reverse with left' },
      { name: 'Left hand floaters', time: '8 min', type: 'skill', done: false, detail: 'From the lane, one dribble pull-up floater — left hand only' },
      { name: 'Catch & shoot — weak spots', time: '10 min', type: 'shooting', done: false, detail: 'Left wing, top of key, left corner — 15 shots each' },
      { name: 'Suicide sprints', time: '5 min', type: 'conditioning', done: false },
    ],
  },
  {
    day: 'Wed',
    date: 'Apr 9',
    focus: 'Rest Day',
    duration: '—',
    drills: [],
    isRest: true,
  },
  {
    day: 'Thu',
    date: 'Apr 10',
    focus: 'Shooting',
    duration: '45 min',
    drills: [
      { name: 'Dynamic warmup + form shots', time: '5 min', type: 'warmup', done: false },
      { name: 'Spot shooting — 5 spots', time: '12 min', type: 'shooting', done: false, detail: 'Corners, wings, top of key — 10 makes from each spot' },
      { name: 'Off-dribble pull-ups', time: '10 min', type: 'skill', done: false, detail: 'Jab step, one dribble pull-up from mid-range — both directions' },
      { name: 'Catch & shoot off screens', time: '10 min', type: 'shooting', done: false, detail: 'Simulate coming off a screen, catch and shoot — quick release' },
      { name: 'Free throws under fatigue', time: '5 min', type: 'shooting', done: false, detail: 'Sprint baseline to baseline, then shoot 2 FTs — repeat 5x' },
      { name: 'Core circuit', time: '5 min', type: 'conditioning', done: false },
    ],
  },
  {
    day: 'Fri',
    date: 'Apr 11',
    focus: 'Defense & Agility',
    duration: '45 min',
    drills: [
      { name: 'Dynamic warmup', time: '5 min', type: 'warmup', done: false },
      { name: 'Defensive slide ladder', time: '8 min', type: 'skill', done: false, detail: 'Lateral slides through cones — low stance, quick feet' },
      { name: 'Closeout drill', time: '8 min', type: 'skill', done: false, detail: 'Sprint to closeout, chop feet, slide with imaginary ball handler' },
      { name: 'Help & recover drill', time: '8 min', type: 'skill', done: false, detail: 'Start help side, sprint to contest, recover to your man' },
      { name: 'Spot shooting — cooldown', time: '8 min', type: 'shooting', done: false },
      { name: 'Sprint intervals', time: '5 min', type: 'conditioning', done: false },
    ],
  },
  {
    day: 'Sat',
    date: 'Apr 12',
    focus: 'Full Game Skills',
    duration: '60 min',
    drills: [
      { name: 'Extended warmup', time: '8 min', type: 'warmup', done: false },
      { name: 'Pick & roll reads', time: '12 min', type: 'skill', done: false, detail: 'Ball handler reads — pull up, drive, kick, lob — walk through each' },
      { name: 'ISO moves package', time: '10 min', type: 'skill', done: false, detail: 'Jab series, triple threat, go-to move + counter' },
      { name: 'Transition finishing', time: '10 min', type: 'skill', done: false, detail: 'Full court layup lines — right hand, left hand, euro, floater' },
      { name: 'Game shooting — 100 shots', time: '12 min', type: 'shooting', done: false, detail: 'Move to a new spot after every make — game speed' },
      { name: 'Full court sprints', time: '5 min', type: 'conditioning', done: false },
    ],
  },
  {
    day: 'Sun',
    date: 'Apr 13',
    focus: 'Rest Day',
    duration: '—',
    drills: [],
    isRest: true,
  },
];

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

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedDay, setSelectedDay] = useState(0);
  const [expandedDrill, setExpandedDrill] = useState<number | null>(null);
  const [completedDrills, setCompletedDrills] = useState<Record<string, boolean>>({});

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const headerFade = useRef(new Animated.Value(0)).current;

  const today = MOCK_WEEK[selectedDay];

  useEffect(() => {
    Animated.timing(headerFade, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleDaySelect = (index: number) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const direction = index > selectedDay ? -20 : 20;

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: direction, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setSelectedDay(index);
      setExpandedDrill(null);
      slideAnim.setValue(-direction);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleDrillPress = (index: number) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpandedDrill(expandedDrill === index ? null : index);
  };

  const handleDrillComplete = (drillKey: string) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setCompletedDrills({ ...completedDrills, [drillKey]: !completedDrills[drillKey] });
  };

  const completedCount = today.drills.filter(
    (_, i) => completedDrills[`${selectedDay}-${i}`]
  ).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerFade }]}>
          <View>
            <Text style={styles.headerGreeting}>Your week</Text>
            <Text style={styles.headerTitle}>Week 1 Training Plan</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>PG</Text>
          </View>
        </Animated.View>

        {/* AI insight banner */}
        <Animated.View style={[styles.insightBanner, { opacity: headerFade }]}>
          <Text style={styles.insightIcon}>⚡</Text>
          <Text style={styles.insightText}>
            Your plan focuses on ball handling and left hand finishing — your two biggest areas for growth based on your profile.
          </Text>
        </Animated.View>

        {/* Day selector */}
        <View style={styles.daySelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daySelectorContent}>
            {MOCK_WEEK.map((day, index) => {
              const isSelected = index === selectedDay;
              const isRest = day.isRest;
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayPill,
                    isSelected && styles.dayPillSelected,
                  ]}
                  onPress={() => handleDaySelect(index)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayPillLabel, isSelected && styles.dayPillLabelSelected]}>
                    {day.day}
                  </Text>
                  <Text style={[styles.dayPillDate, isSelected && styles.dayPillDateSelected]}>
                    {day.date}
                  </Text>
                  {isRest && (
                    <View style={styles.restDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Day content */}
        <Animated.View
          style={[
            styles.dayContent,
            {
              opacity: fadeAnim,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Day header */}
          <View style={styles.dayHeader}>
            <View>
              <Text style={styles.dayFocus}>{today.focus}</Text>
              {!today.isRest && (
                <Text style={styles.dayMeta}>
                  {today.duration} · {today.drills.length} drills
                  {completedCount > 0 && ` · ${completedCount}/${today.drills.length} done`}
                </Text>
              )}
            </View>
            {!today.isRest && (
              <View style={styles.durationBadge}>
                <Text style={styles.durationBadgeText}>{today.duration}</Text>
              </View>
            )}
          </View>

          {/* Rest day */}
          {today.isRest && (
            <View style={styles.restCard}>
              <Text style={styles.restEmoji}>😴</Text>
              <Text style={styles.restTitle}>Recovery day</Text>
              <Text style={styles.restSubtitle}>
                Your body builds muscle during rest, not during training. Stretch, hydrate, and get good sleep tonight.
              </Text>
            </View>
          )}

          {/* Drill list */}
          {today.drills.map((drill, index) => {
            const drillKey = `${selectedDay}-${index}`;
            const isDone = completedDrills[drillKey];
            const isExpanded = expandedDrill === index;
            const typeColor = TYPE_COLORS[drill.type] || Colors.textMuted;
            const typeLabel = TYPE_LABELS[drill.type] || '';

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.drillCard,
                  isDone && styles.drillCardDone,
                ]}
                onPress={() => handleDrillPress(index)}
                activeOpacity={0.7}
              >
                <View style={styles.drillTop}>
                  {/* Completion circle */}
                  <TouchableOpacity
                    style={[
                      styles.completeCircle,
                      isDone && [styles.completeCircleDone, { borderColor: typeColor, backgroundColor: typeColor }],
                    ]}
                    onPress={() => handleDrillComplete(drillKey)}
                    activeOpacity={0.7}
                  >
                    {isDone && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>

                  <View style={styles.drillInfo}>
                    <View style={styles.drillNameRow}>
                      <Text style={[styles.drillName, isDone && styles.drillNameDone]}>
                        {drill.name}
                      </Text>
                    </View>
                    <View style={styles.drillMetaRow}>
                      <View style={[styles.typeTag, { backgroundColor: typeColor + '20' }]}>
                        <Text style={[styles.typeTagText, { color: typeColor }]}>{typeLabel}</Text>
                      </View>
                      <Text style={styles.drillTime}>{drill.time}</Text>
                    </View>
                  </View>

                  <Text style={styles.expandArrow}>{isExpanded ? '−' : '+'}</Text>
                </View>

                {/* Expanded detail */}
                {isExpanded && drill.detail && (
                  <View style={styles.drillDetail}>
                    <Text style={styles.drillDetailText}>{drill.detail}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Start session button */}
          {!today.isRest && (
            <TouchableOpacity style={styles.startButton} activeOpacity={0.85}>
              <Text style={styles.startButtonText}>
                {completedCount > 0 ? 'CONTINUE SESSION' : 'START SESSION'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerGreeting: {
    fontSize: 13,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  insightBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#141210',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#2A2518',
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
  daySelector: {
    marginBottom: 20,
  },
  daySelectorContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  dayPill: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    minWidth: 56,
  },
  dayPillSelected: {
    backgroundColor: '#1A1708',
    borderColor: Colors.primary,
  },
  dayPillLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  dayPillLabelSelected: {
    color: Colors.primary,
  },
  dayPillDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  dayPillDateSelected: {
    color: Colors.textSecondary,
  },
  restDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textMuted,
    marginTop: 6,
  },
  dayContent: {
    paddingHorizontal: 24,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  dayFocus: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  dayMeta: {
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
    letterSpacing: 0.5,
  },
  restCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 28,
    alignItems: 'center',
    marginTop: 8,
  },
  restEmoji: {
    fontSize: 36,
    marginBottom: 14,
  },
  restTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  restSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  drillCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 16,
    marginBottom: 10,
  },
  drillCardDone: {
    opacity: 0.5,
  },
  drillTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  completeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeCircleDone: {
    borderWidth: 0,
  },
  checkmark: {
    fontSize: 14,
    color: Colors.black,
    fontWeight: '800',
  },
  drillInfo: {
    flex: 1,
  },
  drillNameRow: {
    marginBottom: 6,
  },
  drillName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  drillNameDone: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  drillMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeTag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  drillTime: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  expandArrow: {
    fontSize: 20,
    color: Colors.textMuted,
    fontWeight: '300',
  },
  drillDetail: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#252525',
    marginLeft: 42,
  },
  drillDetailText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  startButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  startButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.black,
    letterSpacing: 2,
  },
});
