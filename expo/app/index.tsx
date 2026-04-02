import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, Zap, Crown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import ParlayCard from '@/components/ParlayCard';
import { sampleParlay } from '@/mocks/parlays';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(40)).current;
  const badgeFade = useRef(new Animated.Value(0)).current;
  const buttonsFade = useRef(new Animated.Value(0)).current;
  const buttonsSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.timing(badgeFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(heroFade, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(heroSlide, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(buttonsFade, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(buttonsSlide, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [badgeFade, heroFade, heroSlide, buttonsFade, buttonsSlide]);

  const handlePress = (route: string) => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push(route as any);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <LinearGradient
              colors={[Colors.primary, Colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoIcon}
            >
              <Text style={styles.logoLetter}>P</Text>
            </LinearGradient>
            <Text style={styles.logoText}>
              PARL<Text style={styles.logoAccent}>AI</Text>
            </Text>
          </View>
          <TouchableOpacity
            style={styles.getStartedBtn}
            onPress={() => handlePress('/plans')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.getStartedGradient}
            >
              <Crown size={14} color={Colors.white} />
              <Text style={styles.getStartedText}>PRO</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.heroSection}>
          <Animated.View style={[styles.badge, { opacity: badgeFade }]}>
            <Sparkles size={12} color={Colors.accent} />
            <Text style={styles.badgeText}>AI-POWERED PARLAY INTELLIGENCE</Text>
          </Animated.View>

          <Animated.View
            style={{
              opacity: heroFade,
              transform: [{ translateY: heroSlide }],
            }}
          >
            <Text style={styles.heroTitle}>AI BUILDS YOUR</Text>
            <LinearGradient
              colors={[Colors.gradientPurple, Colors.gradientCyan, Colors.gradientGreen]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.heroGradientTextContainer}
            >
              <Text style={styles.heroGradientText}>PERFECT PARLAY</Text>
            </LinearGradient>

            <Text style={styles.heroSubtitle}>
              Upload tonight's games. ParlAI analyzes every matchup, finds the best legs, and builds you a high-confidence parlay with full reasoning.
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.buttonsRow,
              {
                opacity: buttonsFade,
                transform: [{ translateY: buttonsSlide }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.buildButton}
              onPress={() => handlePress('/build-parlay')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.primary, '#6D28D9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buildButtonGradient}
              >
                <Zap size={16} color={Colors.white} />
                <Text style={styles.buildButtonText}>BUILD MY PARLAY</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.analyzeButton}
              onPress={() => handlePress('/analyze-pick')}
              activeOpacity={0.85}
            >
              <Text style={styles.analyzeButtonText}>ANALYZE A PICK</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={styles.cardSection}>
          <ParlayCard parlay={sampleParlay} />
        </View>

        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>WHY PARLAI?</Text>
          <View style={styles.featuresList}>
            {[
              { icon: '🧠', title: 'Deep AI Analysis', desc: 'Every leg backed by data-driven confidence scores' },
              { icon: '⚡', title: 'Instant Builds', desc: 'Get your optimized parlay in under 10 seconds' },
              { icon: '📊', title: 'Full Reasoning', desc: 'Understand why each pick was selected' },
              { icon: '🎯', title: 'Multi-Sport', desc: 'NBA, NFL, MLB, NHL, Soccer and more' },
            ].map((feature, i) => (
              <View key={i} style={styles.featureItem}>
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDesc}>{feature.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.plansPromo}
          onPress={() => handlePress('/plans')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['rgba(124, 58, 237, 0.15)', 'rgba(0, 229, 204, 0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.plansPromoGradient}
          >
            <Text style={styles.plansPromoTitle}>Unlock Unlimited Parlays</Text>
            <Text style={styles.plansPromoDesc}>
              Go Pro for deep analysis, multi-sport support, and up to 6-leg parlays.
            </Text>
            <View style={styles.plansPromoCta}>
              <Text style={styles.plansPromoCtaText}>View Plans →</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '900' as const,
  },
  logoText: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '900' as const,
    letterSpacing: 2,
  },
  logoAccent: {
    color: Colors.accent,
  },
  getStartedBtn: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  getStartedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  getStartedText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 30,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 28,
  },
  badgeText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: 34,
    fontWeight: '900' as const,
    textAlign: 'center',
    letterSpacing: 1,
    lineHeight: 40,
  },
  heroGradientTextContainer: {
    borderRadius: 4,
    marginTop: 4,
    marginBottom: 20,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  heroGradientText: {
    fontSize: 34,
    fontWeight: '900' as const,
    textAlign: 'center',
    letterSpacing: 1,
    color: 'transparent',
    ...(Platform.OS === 'web'
      ? {
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundImage: `linear-gradient(90deg, ${Colors.gradientPurple}, ${Colors.gradientCyan}, ${Colors.gradientGreen})`,
        }
      : {
          color: Colors.gradientPurple,
        }) as any,
  },
  heroSubtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 30,
    width: '100%',
  },
  buildButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buildButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buildButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  analyzeButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    backgroundColor: Colors.surface,
  },
  analyzeButtonText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  cardSection: {
    paddingBottom: 36,
  },
  featuresSection: {
    paddingBottom: 30,
  },
  featuresTitle: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 2,
    marginBottom: 18,
  },
  featuresList: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700' as const,
    marginBottom: 3,
  },
  featureDesc: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  plansPromo: {
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  plansPromoGradient: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 22,
    alignItems: 'center',
  },
  plansPromoTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800' as const,
    marginBottom: 8,
  },
  plansPromoDesc: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  plansPromoCta: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  plansPromoCtaText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700' as const,
  },
});
