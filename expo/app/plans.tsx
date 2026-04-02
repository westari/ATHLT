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
import { ArrowLeft, Check, Zap, Crown, Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { plans } from '@/mocks/parlays';
import { PlanTier } from '@/types/parlay';

function getTierIcon(tier: PlanTier) {
  switch (tier) {
    case 'free':
      return <Star size={20} color={Colors.textSecondary} />;
    case 'pro':
      return <Zap size={20} color={Colors.accent} />;
    case 'vip':
      return <Crown size={20} color={Colors.orange} />;
  }
}

function getTierGradient(tier: PlanTier): [string, string] {
  switch (tier) {
    case 'free':
      return [Colors.surfaceLight, Colors.surface];
    case 'pro':
      return [Colors.primary, '#6D28D9'];
    case 'vip':
      return ['#D97706', '#B45309'];
  }
}

export default function PlansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cardAnims = useRef(plans.map(() => new Animated.Value(0))).current;
  const cardSlides = useRef(plans.map(() => new Animated.Value(40))).current;

  useEffect(() => {
    Animated.stagger(
      120,
      plans.map((_, i) =>
        Animated.parallel([
          Animated.timing(cardAnims[i], {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(cardSlides[i], {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      )
    ).start();
  }, [cardAnims, cardSlides]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Your Plan</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Unlock the full power of AI-driven parlays
        </Text>

        {plans.map((plan, index) => (
          <Animated.View
            key={plan.tier}
            style={{
              opacity: cardAnims[index],
              transform: [{ translateY: cardSlides[index] }],
            }}
          >
            <View
              style={[
                styles.planCard,
                plan.highlighted && styles.planCardHighlighted,
              ]}
            >
              {plan.highlighted && (
                <LinearGradient
                  colors={[Colors.accent, Colors.accentBlue, Colors.primaryLight]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.highlightBorder}
                />
              )}

              <View style={styles.planHeader}>
                <View style={styles.planTierRow}>
                  {getTierIcon(plan.tier)}
                  <Text style={styles.planName}>{plan.name}</Text>
                  {plan.highlighted && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>POPULAR</Text>
                    </View>
                  )}
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.planPrice}>{plan.price}</Text>
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                </View>
              </View>

              <View style={styles.planFeatures}>
                {plan.features.map((feature, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Check size={14} color={plan.highlighted ? Colors.accent : Colors.green} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={styles.planCta}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={getTierGradient(plan.tier)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.planCtaGradient}
                >
                  <Text style={styles.planCtaText}>{plan.cta}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ))}

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Cancel anytime. All plans include a 7-day free trial.
          </Text>
        </View>

        <View style={{ height: insets.bottom + 30 }} />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  planCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 22,
    marginBottom: 16,
    overflow: 'hidden',
  },
  planCardHighlighted: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  highlightBorder: {
    height: 3,
    width: '120%',
    position: 'absolute' as const,
    top: 0,
    left: -10,
  },
  planHeader: {
    marginBottom: 18,
  },
  planTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  planName: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '800' as const,
  },
  popularBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 4,
  },
  popularBadgeText: {
    color: Colors.primaryLight,
    fontSize: 9,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  planPrice: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: '900' as const,
  },
  planPeriod: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  planFeatures: {
    gap: 12,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500' as const,
    flex: 1,
  },
  planCta: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  planCtaGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  planCtaText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  disclaimer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  disclaimerText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
