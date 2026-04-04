import React, { useState, useRef } from 'react';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface QuestionOption {
  label: string;
  subtitle?: string;
  disabled?: boolean;
}

interface Question {
  id: string;
  question: string;
  subtitle?: string;
  type: 'select' | 'multiselect';
  options: QuestionOption[];
}

const QUESTIONS: Question[] = [
  {
    id: 'sport',
    question: 'What sport do you play?',
    subtitle: 'We\'ll tailor everything to your game.',
    type: 'select',
    options: [
      { label: 'Basketball' },
      { label: 'Soccer', subtitle: 'Coming soon', disabled: true },
      { label: 'Baseball', subtitle: 'Coming soon', disabled: true },
      { label: 'Football', subtitle: 'Coming soon', disabled: true },
    ],
  },
  {
    id: 'position',
    question: 'What position do you play?',
    subtitle: 'This shapes your skill priorities.',
    type: 'select',
    options: [
      { label: 'Point Guard' },
      { label: 'Shooting Guard' },
      { label: 'Small Forward' },
      { label: 'Power Forward' },
      { label: 'Center' },
    ],
  },
  {
    id: 'experience',
    question: 'How long have you been playing?',
    subtitle: 'So we match the right intensity and complexity.',
    type: 'select',
    options: [
      { label: 'Less than a year', subtitle: 'Just getting started' },
      { label: '1-2 years', subtitle: 'Learning the fundamentals' },
      { label: '3-5 years', subtitle: 'Most school team players' },
      { label: '6-10 years', subtitle: 'Most varsity / travel players' },
      { label: '10+ years', subtitle: 'College level and beyond' },
    ],
  },
  {
    id: 'goal',
    question: 'What do you want to improve most?',
    subtitle: 'Pick the one that matters most right now.',
    type: 'select',
    options: [
      { label: 'Become a better scorer' },
      { label: 'Improve my defense' },
      { label: 'Get faster and more athletic' },
      { label: 'Become a more complete player' },
      { label: 'Get recruited / play at the next level' },
    ],
  },
  {
    id: 'weakness',
    question: 'What part of your game needs the most work?',
    subtitle: 'We\'ll focus most of your plan here.',
    type: 'select',
    options: [
      { label: 'Shooting' },
      { label: 'Ball handling' },
      { label: 'Defense' },
      { label: 'Finishing at the rim' },
      { label: 'Speed & agility' },
      { label: 'Basketball IQ' },
    ],
  },
  {
    id: 'frequency',
    question: 'How often can you train?',
    subtitle: 'Outside of team practice. You can always adjust this later.',
    type: 'select',
    options: [
      { label: 'Once or twice a week' },
      { label: '3-4 times a week' },
      { label: '5-6 times a week' },
      { label: 'Every day' },
    ],
  },
  {
    id: 'duration',
    question: 'How long do you want each session to be?',
    subtitle: 'You can change this before every session.',
    type: 'select',
    options: [
      { label: '20-30 minutes', subtitle: 'Quick and focused' },
      { label: '30-45 minutes', subtitle: 'Solid session' },
      { label: '45-60 minutes', subtitle: 'Full workout' },
      { label: '60-90 minutes', subtitle: 'Intensive training' },
    ],
  },
  {
    id: 'access',
    question: 'Where do you usually train?',
    subtitle: 'Pick all that apply — we\'ll only give you drills that work for your setup.',
    type: 'multiselect',
    options: [
      { label: 'Full court with hoop' },
      { label: 'Half court with hoop' },
      { label: 'Driveway with hoop' },
      { label: 'Gym with weights' },
      { label: 'Open space (no hoop)' },
    ],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const currentQuestion = QUESTIONS[currentStep];
  const totalSteps = QUESTIONS.length;
  const progress = (currentStep + 1) / totalSteps;

  const animateTransition = (direction: 'forward' | 'back', callback: () => void) => {
    const slideOut = direction === 'forward' ? -30 : 30;
    const slideIn = direction === 'forward' ? 30 : -30;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: slideOut,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
      slideAnim.setValue(slideIn);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleSelect = (option: string) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (currentQuestion.type === 'multiselect') {
      const current = (answers[currentQuestion.id] as string[]) || [];
      const updated = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      setAnswers({ ...answers, [currentQuestion.id]: updated });
    } else {
      setAnswers({ ...answers, [currentQuestion.id]: option });

      setTimeout(() => {
        if (currentStep < totalSteps - 1) {
          animateTransition('forward', () => setCurrentStep(currentStep + 1));
        } else {
          handleFinish();
        }
      }, 300);
    }
  };

  const handleNext = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (currentStep < totalSteps - 1) {
      animateTransition('forward', () => setCurrentStep(currentStep + 1));
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (currentStep > 0) {
      animateTransition('back', () => setCurrentStep(currentStep - 1));
    } else {
      router.back();
    }
  };

  const LOADING_STEPS = [
    'Analyzing your player profile',
    'Selecting drills for your position',
    'Focusing on your weakness areas',
    'Building daily sessions',
    'Optimizing your schedule',
    'Finalizing your training plan',
  ];

  const handleFinish = async () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    setIsLoading(true);
    setLoadingProgress(0);
    setLoadingMessage(LOADING_STEPS[0]);
    setCompletedSteps([]);

    // Animate progress steps
    let stepIndex = 0;
    const stepInterval = setInterval(() => {
      stepIndex++;
      if (stepIndex < LOADING_STEPS.length) {
        setLoadingMessage(LOADING_STEPS[stepIndex]);
        setLoadingProgress(Math.round((stepIndex / LOADING_STEPS.length) * 100));
        setCompletedSteps(prev => [...prev, stepIndex - 1]);
      }
    }, 1800);

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
          frequency: answers.frequency,
          duration: answers.duration,
          access: answers.access,
        }),
      });

      const plan = await response.json();
      clearInterval(stepInterval);

      // Show 100% briefly
      setLoadingProgress(100);
      setCompletedSteps([0, 1, 2, 3, 4, 5]);
      setLoadingMessage('Your plan is ready!');

      await new Promise(resolve => setTimeout(resolve, 800));

      if (response.ok && plan.days) {
        // TODO: save plan to local storage
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
    const answer = answers[currentQuestion.id];
    if (Array.isArray(answer)) {
      return answer.includes(option);
    }
    return answer === option;
  };

  const canProceed = () => {
    const answer = answers[currentQuestion.id];
    if (!answer) return false;
    if (Array.isArray(answer) && answer.length === 0) return false;
    return true;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingScreen}>
          <Text style={styles.loadingPercent}>{loadingProgress}%</Text>
          <Text style={styles.loadingTitle}>We're building your plan</Text>

          {/* Progress bar */}
          <View style={styles.loadingBarTrack}>
            <View style={[styles.loadingBarFill, { width: `${loadingProgress}%` }]} />
          </View>

          <Text style={styles.loadingMessage}>{loadingMessage}...</Text>

          {/* Checklist */}
          <View style={styles.loadingChecklist}>
            <Text style={styles.loadingChecklistTitle}>Your personalized plan includes</Text>
            {LOADING_STEPS.map((step, i) => {
              const isDone = completedSteps.includes(i);
              return (
                <View key={i} style={styles.loadingCheckItem}>
                  <View style={[styles.loadingCheckCircle, isDone && styles.loadingCheckCircleDone]}>
                    {isDone && <Text style={styles.loadingCheckMark}>✓</Text>}
                  </View>
                  <Text style={[styles.loadingCheckText, isDone && styles.loadingCheckTextDone]}>
                    {step}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        <Text style={styles.stepText}>{currentStep + 1}/{totalSteps}</Text>
      </View>

      {/* Question content */}
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          }}
        >
          <Text style={styles.question}>{currentQuestion.question}</Text>
          {currentQuestion.subtitle && (
            <Text style={styles.subtitle}>{currentQuestion.subtitle}</Text>
          )}

          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option, index) => {
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
                    <Text
                      style={[
                        styles.optionLabel,
                        selected && styles.optionLabelSelected,
                        isDisabled && styles.optionLabelDisabled,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {option.subtitle && (
                      <Text
                        style={[
                          styles.optionSubtitle,
                          isDisabled && styles.optionSubtitleDisabled,
                        ]}
                      >
                        {option.subtitle}
                      </Text>
                    )}
                  </View>

                  <View
                    style={[
                      currentQuestion.type === 'multiselect'
                        ? styles.checkbox
                        : styles.radio,
                      selected && (currentQuestion.type === 'multiselect'
                        ? styles.checkboxSelected
                        : styles.radioSelected),
                    ]}
                  >
                    {selected && (
                      <View
                        style={
                          currentQuestion.type === 'multiselect'
                            ? styles.checkboxInner
                            : styles.radioInner
                        }
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Bottom button for multiselect or final step */}
      {currentQuestion.type === 'multiselect' && (
        <View style={styles.bottomButton}>
          <TouchableOpacity
            style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
            onPress={handleNext}
            activeOpacity={0.85}
            disabled={!canProceed()}
          >
            <Text
              style={[
                styles.nextButtonText,
                !canProceed() && styles.nextButtonTextDisabled,
              ]}
            >
              {currentStep === totalSteps - 1 ? 'BUILD MY PLAN' : 'NEXT'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 22,
    color: Colors.textSecondary,
  },
  progressContainer: {
    flex: 1,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  stepText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'right',
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  question: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 36,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 32,
    lineHeight: 21,
  },
  optionsContainer: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#1A1708',
  },
  optionCardDisabled: {
    opacity: 0.4,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  optionLabelSelected: {
    color: Colors.primary,
  },
  optionLabelDisabled: {
    color: Colors.textMuted,
  },
  optionSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  optionSubtitleDisabled: {
    fontStyle: 'italic',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  checkboxInner: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: Colors.black,
  },
  bottomButton: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  nextButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: 2,
  },
  nextButtonTextDisabled: {
    color: Colors.textMuted,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingPercent: {
    fontSize: 56,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 24,
    textAlign: 'center',
  },
  loadingBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  loadingBarFill: {
    height: 8,
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  loadingMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 36,
  },
  loadingChecklist: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 20,
  },
  loadingChecklistTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  loadingCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  loadingCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCheckCircleDone: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  loadingCheckMark: {
    fontSize: 12,
    color: Colors.black,
    fontWeight: '800',
  },
  loadingCheckText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  loadingCheckTextDone: {
    color: Colors.textPrimary,
  },
});
