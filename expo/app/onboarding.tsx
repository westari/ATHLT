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
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface QuestionOption {
  label: string;
  subtitle?: string;
  disabled?: boolean;
}

interface OnboardingStep {
  type: 'question' | 'info';
  // Question fields
  id?: string;
  question?: string;
  subtitle?: string;
  selectType?: 'select' | 'multiselect';
  options?: QuestionOption[];
  section?: string;
  // Info screen fields
  infoTitle?: string;
  infoBody?: string;
  infoIcon?: string;
}

const STEPS: OnboardingStep[] = [
  // ── SECTION 1: ABOUT YOU ──
  { type: 'question', id: 'sport', section: 'About You',
    question: 'What sport do you play?',
    subtitle: 'We\'ll tailor everything to your game.',
    selectType: 'select',
    options: [
      { label: 'Basketball' },
      { label: 'Soccer', subtitle: 'Coming soon', disabled: true },
      { label: 'Baseball', subtitle: 'Coming soon', disabled: true },
      { label: 'Football', subtitle: 'Coming soon', disabled: true },
    ],
  },
  { type: 'question', id: 'position', section: 'About You',
    question: 'What position do you play?',
    subtitle: 'This shapes your skill priorities.',
    selectType: 'select',
    options: [
      { label: 'Point Guard' },
      { label: 'Shooting Guard' },
      { label: 'Small Forward' },
      { label: 'Power Forward' },
      { label: 'Center' },
    ],
  },
  { type: 'question', id: 'experience', section: 'About You',
    question: 'How long have you been playing?',
    subtitle: 'So we match the right intensity.',
    selectType: 'select',
    options: [
      { label: 'Less than a year', subtitle: 'Just getting started' },
      { label: '1-2 years', subtitle: 'Learning the fundamentals' },
      { label: '3-5 years', subtitle: 'Most school team players' },
      { label: '6-10 years', subtitle: 'Most varsity / travel players' },
      { label: '10+ years', subtitle: 'College level and beyond' },
    ],
  },
  { type: 'info',
    infoIcon: '🏀',
    infoTitle: 'Great — we know who you are.',
    infoBody: 'Now let\'s figure out what to work on. The best players don\'t just practice what they\'re good at — they attack their weaknesses.',
  },

  // ── SECTION 2: YOUR GOALS ──
  { type: 'question', id: 'goal', section: 'Your Goals',
    question: 'What do you want to improve most?',
    subtitle: 'Pick the one that matters most right now.',
    selectType: 'select',
    options: [
      { label: 'Become a better scorer' },
      { label: 'Improve my defense' },
      { label: 'Get faster and more athletic' },
      { label: 'Become a more complete player' },
      { label: 'Get recruited / play at the next level' },
    ],
  },
  { type: 'question', id: 'weakness', section: 'Your Goals',
    question: 'What part of your game needs the most work?',
    subtitle: 'We\'ll focus most of your plan here.',
    selectType: 'select',
    options: [
      { label: 'Shooting' },
      { label: 'Ball handling' },
      { label: 'Defense' },
      { label: 'Finishing at the rim' },
      { label: 'Speed & agility' },
      { label: 'Basketball IQ' },
    ],
  },
  { type: 'info',
    infoIcon: '📈',
    infoTitle: 'Players who train their weaknesses improve 2x faster.',
    infoBody: 'Most players only practice what they\'re already good at. Your plan will be different — we\'ll push you where it matters most.',
  },

  // ── SECTION 3: HOW YOU PLAY ──
  { type: 'question', id: 'driving', section: 'How You Play',
    question: 'When you drive to the basket, what usually happens?',
    subtitle: 'Be honest — this helps us build the right drills.',
    selectType: 'select',
    options: [
      { label: 'I usually score' },
      { label: 'I get blocked or altered' },
      { label: 'I pass it out' },
      { label: 'I lose the ball' },
      { label: 'I don\'t really drive' },
    ],
  },
  { type: 'question', id: 'leftHand', section: 'How You Play',
    question: 'How\'s your left hand?',
    subtitle: 'Your weak hand tells us a lot about your game.',
    selectType: 'select',
    options: [
      { label: 'Strong — I finish with both hands' },
      { label: 'Getting there — I use it sometimes' },
      { label: 'Weak — I avoid it' },
      { label: 'I only use my right hand' },
    ],
  },
  { type: 'question', id: 'pressure', section: 'How You Play',
    question: 'What happens when you\'re guarded tight?',
    subtitle: 'This tells us how you handle pressure.',
    selectType: 'select',
    options: [
      { label: 'I can still create my shot' },
      { label: 'I struggle but I fight through it' },
      { label: 'I usually pass it away' },
      { label: 'I turn it over' },
    ],
  },
  { type: 'question', id: 'goToMove', section: 'How You Play',
    question: 'What\'s your go-to move?',
    subtitle: 'Every player needs one. We\'ll help you build on it.',
    selectType: 'select',
    options: [
      { label: 'Pull-up jumper' },
      { label: 'Drive right' },
      { label: 'Drive left' },
      { label: 'Three pointer' },
      { label: 'Post up' },
      { label: 'I don\'t have one yet' },
    ],
  },
  { type: 'question', id: 'threeConfidence', section: 'How You Play',
    question: 'How confident are you shooting threes?',
    selectType: 'select',
    options: [
      { label: 'Very — I\'m a shooter' },
      { label: 'Somewhat — I\'ll take open ones' },
      { label: 'Not really — I prefer mid-range' },
      { label: 'I don\'t shoot them' },
    ],
  },
  { type: 'question', id: 'freeThrow', section: 'How You Play',
    question: 'What\'s your free throw percentage?',
    subtitle: 'Your best guess is fine.',
    selectType: 'select',
    options: [
      { label: '80% or higher' },
      { label: '60-80%' },
      { label: '40-60%' },
      { label: 'Below 40%' },
      { label: 'No idea' },
    ],
  },
  { type: 'info',
    infoIcon: '🧠',
    infoTitle: 'This is what makes ATHLT different.',
    infoBody: 'Most apps give everyone the same generic plan. We just learned how you actually play — your plan will be built around YOUR game, not someone else\'s.',
  },

  // ── SECTION 4: YOUR SCHEDULE ──
  { type: 'question', id: 'frequency', section: 'Your Schedule',
    question: 'How often can you train?',
    subtitle: 'Outside of team practice. You can always adjust later.',
    selectType: 'select',
    options: [
      { label: 'Once or twice a week' },
      { label: '3-4 times a week' },
      { label: '5-6 times a week' },
      { label: 'Every day' },
    ],
  },
  { type: 'question', id: 'duration', section: 'Your Schedule',
    question: 'How long do you want each session?',
    subtitle: 'You can change this before every session.',
    selectType: 'select',
    options: [
      { label: '20-30 minutes', subtitle: 'Quick and focused' },
      { label: '30-45 minutes', subtitle: 'Solid session' },
      { label: '45-60 minutes', subtitle: 'Full workout' },
      { label: '60-90 minutes', subtitle: 'Intensive training' },
    ],
  },
  { type: 'question', id: 'access', section: 'Your Schedule',
    question: 'Where do you usually train?',
    subtitle: 'Pick all that apply — we\'ll only give you drills that work for your setup.',
    selectType: 'multiselect',
    options: [
      { label: 'Full court with hoop' },
      { label: 'Half court with hoop' },
      { label: 'Driveway with hoop' },
      { label: 'Gym with weights' },
      { label: 'Open space (no hoop)' },
    ],
  },
];

const LOADING_STEPS = [
  'Analyzing your player profile',
  'Selecting drills for your position',
  'Focusing on your weakness areas',
  'Building daily sessions',
  'Optimizing your schedule',
  'Finalizing your training plan',
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setPlan, setProfile } = usePlanStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentLoadingStep, setCurrentLoadingStep] = useState(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const step = STEPS[currentStep];
  const totalSteps = STEPS.length;
  const questionSteps = STEPS.filter(s => s.type === 'question');
  const currentQuestionIndex = STEPS.slice(0, currentStep + 1).filter(s => s.type === 'question').length;
  const totalQuestionCount = questionSteps.length;
  const overallProgress = (currentStep + 1) / totalSteps;

  // Smooth progress bar animation for loading
  useEffect(() => {
    if (isLoading) {
      Animated.timing(progressAnim, {
        toValue: loadingProgress,
        duration: 800,
        useNativeDriver: false,
      }).start();
    }
  }, [loadingProgress, isLoading]);

  const animateTransition = (direction: 'forward' | 'back', callback: () => void) => {
    const slideOut = direction === 'forward' ? -30 : 30;
    const slideIn = direction === 'forward' ? 30 : -30;

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: slideOut, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      callback();
      slideAnim.setValue(slideIn);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]).start();
    });
  };

  const goNext = () => {
    if (currentStep < totalSteps - 1) {
      animateTransition('forward', () => setCurrentStep(currentStep + 1));
    } else {
      handleFinish();
    }
  };

  const handleSelect = (option: string) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!step.id) return;

    if (step.selectType === 'multiselect') {
      const current = (answers[step.id] as string[]) || [];
      const updated = current.includes(option)
        ? current.filter(o => o !== option)
        : [...current, option];
      setAnswers({ ...answers, [step.id]: updated });
    } else {
      setAnswers({ ...answers, [step.id]: option });
      setTimeout(() => goNext(), 300);
    }
  };

  const handleContinue = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    goNext();
  };

  const handleBack = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep > 0) {
      animateTransition('back', () => setCurrentStep(currentStep - 1));
    } else {
      router.back();
    }
  };

  const handleFinish = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    setIsLoading(true);
    setLoadingProgress(0);
    setCurrentLoadingStep(0);

    // Smooth progress animation
    let step = 0;
    const stepInterval = setInterval(() => {
      step++;
      if (step <= LOADING_STEPS.length) {
        setCurrentLoadingStep(step);
        setLoadingProgress(Math.round((step / LOADING_STEPS.length) * 95));
      }
    }, 2000);

    try {
      const response = await fetch('https://collectiq-xi.vercel.app/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport: answers.sport,
          position: answers.position,
          experience: answers.experience,
          goal: answers.goal,
          weakness: answers.weakness,
          driving: answers.driving,
          leftHand: answers.leftHand,
          pressure: answers.pressure,
          goToMove: answers.goToMove,
          threeConfidence: answers.threeConfidence,
          freeThrow: answers.freeThrow,
          frequency: answers.frequency,
          duration: answers.duration,
          access: answers.access,
        }),
      });

      clearInterval(stepInterval);
      setLoadingProgress(100);
      setCurrentLoadingStep(LOADING_STEPS.length);

      const plan = await response.json();

      await new Promise(resolve => setTimeout(resolve, 1000));

      if (response.ok && plan.days) {
        setPlan(plan);
        setProfile({
          sport: answers.sport as string,
          position: answers.position as string,
          experience: answers.experience as string,
          goal: answers.goal as string,
          weakness: answers.weakness as string,
          driving: answers.driving as string,
          leftHand: answers.leftHand as string,
          pressure: answers.pressure as string,
          goToMove: answers.goToMove as string,
          threeConfidence: answers.threeConfidence as string,
          freeThrow: answers.freeThrow as string,
          frequency: answers.frequency as string,
          duration: answers.duration as string,
          access: answers.access,
        });
        router.replace('/(tabs)/today' as any);
      } else {
        router.replace('/(tabs)/today' as any);
      }
    } catch (error) {
      console.error('Network error:', error);
      clearInterval(stepInterval);
      setIsLoading(false);
      router.replace('/(tabs)/today' as any);
    }
  };

  const isSelected = (option: string) => {
    if (!step.id) return false;
    const answer = answers[step.id];
    if (Array.isArray(answer)) return answer.includes(option);
    return answer === option;
  };

  const canProceed = () => {
    if (!step.id) return true;
    const answer = answers[step.id];
    if (!answer) return false;
    if (Array.isArray(answer) && answer.length === 0) return false;
    return true;
  };

  // ── LOADING SCREEN ──
  if (isLoading) {
    const progressWidth = progressAnim.interpolate({
      inputRange: [0, 100],
      outputRange: ['0%', '100%'],
    });

    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingScreen}>
          <Text style={styles.loadingPercent}>{loadingProgress}%</Text>
          <Text style={styles.loadingTitle}>We're building your plan</Text>

          <View style={styles.loadingBarTrack}>
            <Animated.View style={[styles.loadingBarFill, { width: progressWidth }]} />
          </View>

          <Text style={styles.loadingSubtext}>
            {currentLoadingStep < LOADING_STEPS.length
              ? `${LOADING_STEPS[currentLoadingStep]}...`
              : 'Your plan is ready!'}
          </Text>

          <View style={styles.loadingChecklist}>
            <Text style={styles.loadingChecklistTitle}>Your personalized plan includes</Text>
            {LOADING_STEPS.map((s, i) => {
              const isDone = i < currentLoadingStep;
              return (
                <View key={i} style={styles.loadingCheckItem}>
                  <View style={[styles.loadingCheckCircle, isDone && styles.loadingCheckCircleDone]}>
                    {isDone && <Text style={styles.loadingCheckMark}>✓</Text>}
                  </View>
                  <Text style={[styles.loadingCheckText, isDone && styles.loadingCheckTextDone]}>
                    {s}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  // ── INFO SCREEN ──
  if (step.type === 'info') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${overallProgress * 100}%` }]} />
            </View>
          </View>
          <View style={{ width: 60 }} />
        </View>

        <Animated.View
          style={[styles.infoScreen, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}
        >
          <Text style={styles.infoIcon}>{step.infoIcon}</Text>
          <Text style={styles.infoTitle}>{step.infoTitle}</Text>
          <Text style={styles.infoBody}>{step.infoBody}</Text>
        </Animated.View>

        <View style={styles.bottomButton}>
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.continueButtonText}>CONTINUE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── QUESTION SCREEN ──
  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${overallProgress * 100}%` }]} />
          </View>
        </View>
        <Text style={styles.stepText}>{currentQuestionIndex}/{totalQuestionCount}</Text>
      </View>

      {step.section && (
        <Animated.Text
          style={[styles.sectionLabel, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}
        >
          {step.section}
        </Animated.Text>
      )}

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
          <Text style={styles.question}>{step.question}</Text>
          {step.subtitle && <Text style={styles.subtitle}>{step.subtitle}</Text>}

          <View style={styles.optionsContainer}>
            {step.options?.map((option, index) => {
              const selected = isSelected(option.label);
              const isDisabled = option.disabled === true;

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.optionCard,
                    selected && styles.optionCardSelected,
                    isDisabled && styles.optionCardDisabled,
                  ]}
                  onPress={() => !isDisabled && handleSelect(option.label)}
                  activeOpacity={isDisabled ? 1 : 0.7}
                >
                  <View style={styles.optionContent}>
                    <Text style={[
                      styles.optionLabel,
                      selected && styles.optionLabelSelected,
                      isDisabled && styles.optionLabelDisabled,
                    ]}>
                      {option.label}
                    </Text>
                    {option.subtitle && (
                      <Text style={[styles.optionSubtitle, isDisabled && styles.optionSubtitleDisabled]}>
                        {option.subtitle}
                      </Text>
                    )}
                  </View>
                  <View style={[
                    step.selectType === 'multiselect' ? styles.checkbox : styles.radio,
                    selected && (step.selectType === 'multiselect' ? styles.checkboxSelected : styles.radioSelected),
                  ]}>
                    {selected && (
                      <View style={step.selectType === 'multiselect' ? styles.checkboxInner : styles.radioInner} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>

      {(step.selectType === 'multiselect' || currentStep === totalSteps - 1) && (
        <View style={styles.bottomButton}>
          <TouchableOpacity
            style={[styles.continueButton, !canProceed() && styles.continueButtonDisabled]}
            onPress={handleContinue}
            activeOpacity={0.85}
            disabled={!canProceed()}
          >
            <Text style={[styles.continueButtonText, !canProceed() && styles.continueButtonTextDisabled]}>
              {currentStep === totalSteps - 1 ? 'BUILD MY PLAN' : 'NEXT'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, gap: 14,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 22, color: Colors.textSecondary },
  progressContainer: { flex: 1 },
  progressTrack: { height: 4, backgroundColor: Colors.surface, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  stepText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600', minWidth: 36, textAlign: 'right' },
  // Section label
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.primary,
    textTransform: 'uppercase', letterSpacing: 1.5,
    paddingHorizontal: 24, marginBottom: 4,
  },
  // Content
  contentContainer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  question: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, lineHeight: 34, marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: 28, lineHeight: 21 },
  optionsContainer: { gap: 10 },
  // Option cards
  optionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.surfaceBorder,
    paddingVertical: 18, paddingHorizontal: 20,
  },
  optionCardSelected: { borderColor: Colors.primary, backgroundColor: '#1A1708' },
  optionCardDisabled: { opacity: 0.4 },
  optionContent: { flex: 1 },
  optionLabel: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  optionLabelSelected: { color: Colors.primary },
  optionLabelDisabled: { color: Colors.textMuted },
  optionSubtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  optionSubtitleDisabled: { fontStyle: 'italic' },
  // Radio & checkbox
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  checkboxInner: { width: 12, height: 12, borderRadius: 2, backgroundColor: Colors.black },
  // Bottom button
  bottomButton: { paddingHorizontal: 24, paddingBottom: 16 },
  continueButton: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  continueButtonText: { fontSize: 15, fontWeight: '800', color: Colors.black, letterSpacing: 2 },
  continueButtonTextDisabled: { color: Colors.textMuted },
  // Info screen
  infoScreen: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 36,
  },
  infoIcon: { fontSize: 48, marginBottom: 24 },
  infoTitle: {
    fontSize: 24, fontWeight: '800', color: Colors.textPrimary,
    textAlign: 'center', lineHeight: 32, marginBottom: 16,
  },
  infoBody: {
    fontSize: 16, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 24,
  },
  // Loading screen
  loadingScreen: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  loadingPercent: { fontSize: 52, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  loadingTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 24 },
  loadingBarTrack: {
    width: '100%', height: 8, backgroundColor: Colors.surface,
    borderRadius: 4, overflow: 'hidden', marginBottom: 16,
  },
  loadingBarFill: { height: 8, backgroundColor: Colors.primary, borderRadius: 4 },
  loadingSubtext: { fontSize: 14, color: Colors.textSecondary, marginBottom: 36 },
  loadingChecklist: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 20,
  },
  loadingChecklistTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },
  loadingCheckItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  loadingCheckCircle: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  loadingCheckCircleDone: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  loadingCheckMark: { fontSize: 12, color: Colors.black, fontWeight: '800' },
  loadingCheckText: { fontSize: 14, color: Colors.textMuted },
  loadingCheckTextDone: { color: Colors.textPrimary },
});
