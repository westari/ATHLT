import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Animated,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

/**
 * CoachXClimax — the dramatic onboarding finale.
 *
 * Shown AFTER plan generation, BEFORE the plan view.
 * 4 swipeable cards: Greeting, Assessment, Plan Overview, Motivation.
 * Coach X portrait sits dominant in the bottom-right corner like he's leaning in.
 *
 * Props:
 *   coachSummary — object with { greeting, assessment, planOverview, motivation }
 *   onComplete — fires when user finishes the carousel and taps "See My Plan"
 */

interface CoachSummary {
  greeting?: string;
  assessment?: string;
  planOverview?: string;
  motivation?: string;
}

interface Props {
  coachSummary: CoachSummary;
  onComplete: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CARDS = [
  { key: 'greeting', label: 'WELCOME', heading: "Coach X has finished your scouting report" },
  { key: 'assessment', label: 'WHAT I SEE', heading: "Here's what I see in your game" },
  { key: 'planOverview', label: 'YOUR PLAN', heading: "Here's how we attack it" },
  { key: 'motivation', label: 'LOCK IN', heading: "Time to put in the work" },
];

export default function CoachXClimax({ coachSummary, onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [pageIndex, setPageIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (newIndex !== pageIndex) {
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPageIndex(newIndex);
    }
  };

  const goToNext = () => {
    if (pageIndex < CARDS.length - 1) {
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      scrollRef.current?.scrollTo({ x: (pageIndex + 1) * SCREEN_WIDTH, animated: true });
    } else {
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      onComplete();
    }
  };

  const isLastPage = pageIndex === CARDS.length - 1;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Top — progress dots */}
      <View style={s.dotRow}>
        {CARDS.map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              i === pageIndex && s.dotActive,
              i < pageIndex && s.dotDone,
            ]}
          />
        ))}
      </View>

      {/* Swipeable carousel */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {CARDS.map((card, i) => {
          const content = coachSummary[card.key as keyof CoachSummary] || '';
          return (
            <View key={card.key} style={[s.page, { width: SCREEN_WIDTH }]}>
              <View style={s.cardContent}>
                <Text style={s.cardLabel}>{card.label}</Text>
                <Text style={s.cardHeading}>{card.heading}</Text>
                <Text style={s.cardBody}>{content || 'Coach X is putting together your notes...'}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Coach X portrait — bottom right, leaning into frame */}
      <View style={[s.coachPortraitWrap, { bottom: insets.bottom + 100 }]} pointerEvents="none">
        <Image
          source={require('@/assets/images/coach-x-small.png')}
          style={s.coachPortrait}
          resizeMode="contain"
        />
      </View>

      {/* CTA — next or finish */}
      <View style={[s.btnWrap, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[s.btn, isLastPage && s.btnPrimary]}
          onPress={goToNext}
          activeOpacity={0.85}
        >
          <Text style={[s.btnText, isLastPage && s.btnTextPrimary]}>
            {isLastPage ? 'See My Plan' : 'Continue'}
          </Text>
          {!isLastPage && <ChevronRight size={18} color={Colors.textPrimary} />}
        </TouchableOpacity>

        {/* Skip — only on first 3 cards, lets user bail to plan if they want */}
        {!isLastPage && (
          <TouchableOpacity onPress={onComplete} activeOpacity={0.6} style={s.skipBtn}>
            <Text style={s.skipText}>Skip to plan</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Progress dots
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceBorder,
  },
  dotActive: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  dotDone: {
    backgroundColor: Colors.primary,
    opacity: 0.4,
  },
  // Page (each carousel slide)
  page: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 200, // leaves space for portrait + button
  },
  cardContent: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.8,
    marginBottom: 14,
  },
  cardHeading: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 36,
    letterSpacing: -0.8,
    marginBottom: 24,
  },
  cardBody: {
    fontSize: 17,
    color: Colors.textSecondary,
    lineHeight: 26,
    letterSpacing: -0.2,
  },

  // Coach X portrait — bottom right, big presence
  coachPortraitWrap: {
    position: 'absolute',
    right: -40,           // bleeds slightly off the right edge for drama
    width: 280,
    height: 320,
    opacity: 0.92,
  },
  coachPortrait: {
    width: '100%',
    height: '100%',
  },

  // Bottom button
  btnWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: Colors.background,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 100,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  btnPrimary: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  btnTextPrimary: {
    color: Colors.white,
  },
  skipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 13,
    color: Colors.textMuted,
    letterSpacing: -0.2,
  },
});
