import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const headerFade = useRef(new Animated.Value(0)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(40)).current;
  const bottomFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(headerFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(cardFade, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(cardSlide, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(bottomFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleGetStarted = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/onboarding' as any);
  };

  const handleSignIn = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — small logo at top */}
        <Animated.View style={[styles.header, { opacity: headerFade }]}>
          <View style={styles.headerRow}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Product preview card */}
        <Animated.View
          style={[
            styles.previewContainer,
            {
              opacity: cardFade,
              transform: [{ translateY: cardSlide }],
            },
          ]}
        >
          <View style={styles.previewCard}>
            {/* Card header */}
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardGreeting}>Today's Session</Text>
                <Text style={styles.cardTitle}>Left Hand Focus</Text>
              </View>
              <View style={styles.cardBadge}>
                <Text style={styles.cardBadgeText}>45 MIN</Text>
              </View>
            </View>

            {/* Drill items */}
            <View style={styles.drillItem}>
              <View style={styles.drillDot} />
              <View style={styles.drillContent}>
                <Text style={styles.drillName}>Dynamic warmup + ball handling</Text>
                <Text style={styles.drillMeta}>5 min · 3 drills</Text>
              </View>
              <Text style={styles.drillCheck}>✓</Text>
            </View>

            <View style={styles.drillItem}>
              <View style={[styles.drillDot, styles.drillDotActive]} />
              <View style={styles.drillContent}>
                <Text style={[styles.drillName, styles.drillNameActive]}>Left hand finishing package</Text>
                <Text style={styles.drillMeta}>20 min · Mikan drill, reverse layups, floaters</Text>
              </View>
              <Text style={styles.drillArrow}>→</Text>
            </View>

            <View style={styles.drillItem}>
              <View style={styles.drillDot} />
              <View style={styles.drillContent}>
                <Text style={styles.drillName}>Catch & shoot from weak spots</Text>
                <Text style={styles.drillMeta}>15 min · Left wing, top of key, left corner</Text>
              </View>
            </View>

            <View style={[styles.drillItem, { borderBottomWidth: 0 }]}>
              <View style={styles.drillDot} />
              <View style={styles.drillContent}>
                <Text style={styles.drillName}>Game-speed suicides</Text>
                <Text style={styles.drillMeta}>5 min · Conditioning finisher</Text>
              </View>
            </View>

            {/* AI insight */}
            <View style={styles.insightBox}>
              <Text style={styles.insightIcon}>⚡</Text>
              <Text style={styles.insightText}>
                Based on your last game: your left hand finishing was 2/8. Today's plan targets that.
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Headline */}
        <Animated.View style={[styles.bottomContent, { opacity: bottomFade }]}>
          <Text style={styles.headline}>
            Training plans that know{'\n'}how you play.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleGetStarted}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>GET STARTED — IT'S FREE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSignIn}
            activeOpacity={0.7}
            style={styles.signInButton}
          >
            <Text style={styles.signInText}>
              Already have an account? <Text style={styles.signInLink}>Sign in</Text>
            </Text>
          </TouchableOpacity>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 180,
    height: 50,
  },
  previewContainer: {
    marginBottom: 28,
  },
  previewCard: {
    backgroundColor: '#141414',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  cardGreeting: {
    fontSize: 13,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  cardBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cardBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: 1,
  },
  drillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
    gap: 12,
  },
  drillDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
  },
  drillDotActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  drillContent: {
    flex: 1,
  },
  drillName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  drillNameActive: {
    color: Colors.textPrimary,
  },
  drillMeta: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  drillCheck: {
    fontSize: 14,
    color: Colors.accent,
  },
  drillArrow: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '700',
  },
  insightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#252525',
  },
  insightIcon: {
    fontSize: 16,
  },
  insightText: {
    fontSize: 13,
    color: Colors.primary,
    lineHeight: 18,
    flex: 1,
    fontWeight: '500',
  },
  bottomContent: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.black,
    letterSpacing: 2,
  },
  signInButton: {
    marginTop: 18,
    paddingVertical: 8,
  },
  signInText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  signInLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
