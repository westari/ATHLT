import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Pause, Play, SkipForward, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SESSION_DRILLS = [
  { name: 'Dynamic warmup + form shots', time: 5, type: 'warmup', detail: 'Light jog around the court for 1 minute. Then high knees, butt kicks, and arm circles. Finish with 10 form shots from 5 feet — focus on perfect arc and follow through.' },
  { name: 'Spot shooting — 5 spots', time: 12, type: 'shooting', detail: 'Set up at 5 spots: both corners, both wings, top of key. Shoot until you make 10 from each spot. Focus on catching with your feet set, knees bent, and snapping your release. Move quickly between spots.' },
  { name: 'Off-dribble pull-ups', time: 10, type: 'skill', detail: 'Start at the wing. Jab step right, take one hard dribble left, pull up for a mid-range jumper. Then switch — jab left, dribble right, pull up. Do 10 reps each direction. Focus on a quick stop and high release point.' },
  { name: 'Catch & shoot off screens', time: 10, type: 'shooting', detail: 'Place a cone or chair at the elbow to simulate a screen. Start on the block, curl around the screen, catch an imaginary pass, and shoot. Alternate sides. 15 shots from each side. Quick feet and a fast release.' },
  { name: 'Free throws under fatigue', time: 5, type: 'shooting', detail: 'Sprint from baseline to baseline as fast as you can. Immediately step to the free throw line and shoot 2 free throws. Focus on slowing your breathing and keeping your routine consistent. Repeat 5 times.' },
  { name: 'Core circuit', time: 5, type: 'conditioning', detail: '3 rounds of: 30 seconds plank, 30 seconds Russian twists, 30 seconds leg raises. Rest 15 seconds between exercises. Keep your core tight and breathe steadily throughout.' },
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

export default function SessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentDrill, setCurrentDrill] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(SESSION_DRILLS[0].time * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [totalElapsed, setTotalElapsed] = useState(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const drill = SESSION_DRILLS[currentDrill];
  const totalDrills = SESSION_DRILLS.length;
  const progress = (currentDrill) / totalDrills;
  const typeColor = TYPE_COLORS[drill?.type] || Colors.primary;

  // Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((t) => t - 1);
        setTotalElapsed((t) => t + 1);
      }, 1000);
    } else if (isRunning && timeRemaining === 0) {
      // Drill complete
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeRemaining]);

  // Pulse animation for timer when running
  useEffect(() => {
    if (isRunning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRunning]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTotalTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  const handlePlayPause = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRunning(!isRunning);
  };

  const handleNext = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (currentDrill >= totalDrills - 1) {
      setIsComplete(true);
      setIsRunning(false);
      return;
    }

    // Animate transition
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      const nextDrill = currentDrill + 1;
      setCurrentDrill(nextDrill);
      setTimeRemaining(SESSION_DRILLS[nextDrill].time * 60);
      setIsRunning(false);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleClose = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleFinish = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.back();
  };

  // Completion screen
  if (isComplete) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.completeScreen}>
          <View style={styles.completeIconWrap}>
            <Text style={styles.completeIcon}>✓</Text>
          </View>
          <Text style={styles.completeTitle}>Session Complete</Text>
          <Text style={styles.completeSubtitle}>Shooting — {formatTotalTime(totalElapsed)} total</Text>

          <View style={styles.completeStats}>
            <View style={styles.completeStat}>
              <Text style={styles.completeStatValue}>{totalDrills}</Text>
              <Text style={styles.completeStatLabel}>Drills done</Text>
            </View>
            <View style={styles.completeStatDivider} />
            <View style={styles.completeStat}>
              <Text style={styles.completeStatValue}>{formatTotalTime(totalElapsed)}</Text>
              <Text style={styles.completeStatLabel}>Time trained</Text>
            </View>
            <View style={styles.completeStatDivider} />
            <View style={styles.completeStat}>
              <Text style={[styles.completeStatValue, { color: Colors.accent }]}>4</Text>
              <Text style={styles.completeStatLabel}>Day streak</Text>
            </View>
          </View>

          <View style={styles.completeInsight}>
            <View style={styles.completeInsightDot} />
            <Text style={styles.completeInsightText}>
              Great work. Tomorrow's session focuses on Defense & Agility to keep your training balanced.
            </Text>
          </View>

          <TouchableOpacity style={styles.finishButton} onPress={handleFinish} activeOpacity={0.85}>
            <Text style={styles.finishButtonText}>DONE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton} activeOpacity={0.7}>
          <X size={22} color={Colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerDrill}>Drill {currentDrill + 1} of {totalDrills}</Text>
        </View>

        <TouchableOpacity onPress={handleNext} style={styles.skipButton} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
          <SkipForward size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((currentDrill + (1 - timeRemaining / (drill.time * 60))) / totalDrills) * 100}%` }]} />
      </View>

      {/* Drill content */}
      <Animated.View
        style={[
          styles.drillContent,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {/* Type badge */}
        <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
          <Text style={[styles.typeBadgeText, { color: typeColor }]}>{TYPE_LABELS[drill.type]}</Text>
        </View>

        {/* Drill name */}
        <Text style={styles.drillName}>{drill.name}</Text>

        {/* Timer */}
        <Animated.View style={[styles.timerWrap, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={[styles.timer, isRunning && { color: Colors.primary }]}>
            {formatTime(timeRemaining)}
          </Text>
          <Text style={styles.timerLabel}>
            {timeRemaining === 0 ? 'Time\'s up!' : isRunning ? 'In progress' : 'Tap play to start'}
          </Text>
        </Animated.View>

        {/* Instructions */}
        <View style={styles.instructionCard}>
          <Text style={styles.instructionTitle}>How to do it</Text>
          <Text style={styles.instructionText}>{drill.detail}</Text>
        </View>
      </Animated.View>

      {/* Bottom controls */}
      <View style={styles.controls}>
        {timeRemaining === 0 ? (
          <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.nextButtonText}>
              {currentDrill >= totalDrills - 1 ? 'FINISH SESSION' : 'NEXT DRILL'}
            </Text>
            <ChevronRight size={18} color={Colors.black} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.playButton, isRunning && styles.pauseButton]}
            onPress={handlePlayPause}
            activeOpacity={0.85}
          >
            {isRunning ? (
              <>
                <Pause size={22} color={Colors.black} />
                <Text style={styles.playButtonText}>PAUSE</Text>
              </>
            ) : (
              <>
                <Play size={22} color={Colors.black} />
                <Text style={styles.playButtonText}>
                  {timeRemaining === drill.time * 60 ? 'START DRILL' : 'RESUME'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center' },
  headerDrill: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  skipButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4 },
  skipText: { fontSize: 13, color: Colors.textMuted },
  progressBar: {
    height: 3,
    backgroundColor: '#1A1A1A',
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 30,
  },
  progressFill: { height: 3, backgroundColor: Colors.primary, borderRadius: 2 },
  drillContent: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  typeBadge: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  drillName: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 36,
  },
  timerWrap: { alignItems: 'center', marginBottom: 40 },
  timer: {
    fontSize: 64,
    fontWeight: '200',
    color: Colors.textPrimary,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  timerLabel: { fontSize: 13, color: Colors.textMuted, marginTop: 8 },
  instructionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 20,
    width: '100%',
  },
  instructionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  controls: {
    paddingHorizontal: 28,
    paddingBottom: 16,
  },
  playButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pauseButton: {
    backgroundColor: '#3A3528',
  },
  playButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.black,
    letterSpacing: 2,
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.black,
    letterSpacing: 2,
  },
  // Completion screen
  completeScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  completeIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  completeIcon: { fontSize: 32, color: Colors.black, fontWeight: '800' },
  completeTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  completeSubtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: 36 },
  completeStats: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 24,
    width: '100%',
    marginBottom: 20,
  },
  completeStat: { flex: 1, alignItems: 'center' },
  completeStatValue: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  completeStatLabel: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
  completeStatDivider: { width: 1, backgroundColor: Colors.surfaceBorder },
  completeInsight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 18,
    width: '100%',
    gap: 10,
    marginBottom: 36,
  },
  completeInsightDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 4 },
  completeInsightText: { fontSize: 13, color: Colors.primary, lineHeight: 19, flex: 1, fontWeight: '500' },
  finishButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    width: '100%',
  },
  finishButtonText: { fontSize: 15, fontWeight: '900', color: Colors.black, letterSpacing: 2 },
});
