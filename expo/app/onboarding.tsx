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
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Question {
  id: string;
  question: string;
  subtitle?: string;
  type: 'select' | 'multiselect';
  options: { label: string; subtitle?: string }[];
}

const BASKETBALL_QUESTIONS: Question[] = [
  {
    id: 'sport',
    question: 'What sport do you play?',
    subtitle: 'We\'ll tailor everything to your game.',
    type: 'select',
    options: [
      { label: 'Basketball', subtitle: 'Courts, handles, buckets' },
      { label: 'Soccer', subtitle: 'Coming soon' },
      { label: 'Baseball', subtitle: 'Coming soon' },
      { label: 'Football', subtitle: 'Coming soon' },
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
    id: 'level',
    question: 'What level are you at?',
    subtitle: 'So we match the right intensity.',
    type: 'select',
    options: [
      { label: 'Just starting out' },
      { label: 'Rec league' },
      { label: 'School team' },
      { label: 'Travel / AAU' },
      { label: 'Varsity' },
      { label: 'College' },
    ],
  },
  {
    id: 'goal',
    question: 'What\'s your #1 goal?',
    subtitle: 'Pick the one that matters most right now.',
    type: 'select',
    options: [
      { label: 'Make the team' },
      { label: 'Become a starter' },
      { label: 'Get a scholarship' },
      { label: 'Improve a specific skill' },
      { label: 'Overall development' },
    ],
  },
  {
    id: 'weakness',
    question: 'What needs the most work?',
    subtitle: 'We\'ll focus 60% of your plan here.',
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
    id: 'days',
    question: 'How many days can you train?',
    subtitle: 'Outside of team practice.',
    type: 'select',
    options: [
      { label: '2 days' },
      { label: '3 days' },
      { label: '4 days' },
      { label: '5 days' },
      { label: '6+ days' },
    ],
  },
  {
    id: 'duration',
    question: 'How long per session?',
    subtitle: 'We\'ll build around your time.',
    type: 'select',
    options: [
      { label: '30 minutes' },
      { label: '45 minutes' },
      { label: '60 minutes' },
      { label: '90 minutes' },
    ],
  },
  {
    id: 'access',
    question: 'What do you have access to?',
    subtitle: 'So we only give you drills you can actually do.',
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

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const currentQuestion = BASKETBALL_QUESTIONS[currentStep];
  const totalSteps = BASKETBALL_QUESTIONS.length;
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

      // Auto-advance on single select after brief delay
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

  const handleFinish = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    // TODO: pass answers to training plan generator
    router.push('/home' as any);
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
              const isComingSoon = option.subtitle === 'Coming soon';

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.optionCard,
                    selected && styles.optionCardSelected,
                    isComingSoon && styles.optionCardDisabled,
                  ]}
                  onPress={() => !isComingSoon && handleSelect(option.label)}
                  activeOpacity={isComingSoon ? 1 : 0.7}
                >
                  <View style={styles.optionContent}>
                    <Text
                      style={[
                        styles.optionLabel,
                        selected && styles.optionLabelSelected,
                        isComingSoon && styles.optionLabelDisabled,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {option.subtitle && (
                      <Text
                        style={[
                          styles.optionSubtitle,
                          isComingSoon && styles.optionSubtitleDisabled,
                        ]}
                      >
                        {option.subtitle}
                      </Text>
                    )}
                  </View>

                  {/* Selection indicator */}
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

      {/* Bottom button for multiselect */}
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
});
