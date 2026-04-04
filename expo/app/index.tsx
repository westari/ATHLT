import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Logo animation
  const logoSlide = useRef(new Animated.Value(-60)).current;
  const logoFade = useRef(new Animated.Value(0)).current;

  // Text animation
  const textSlide = useRef(new Animated.Value(30)).current;
  const textFade = useRef(new Animated.Value(0)).current;

  // Tagline
  const taglineFade = useRef(new Animated.Value(0)).current;

  // Subtitle
  const subtitleFade = useRef(new Animated.Value(0)).current;

  // Buttons
  const buttonsFade = useRef(new Animated.Value(0)).current;
  const buttonsSlide = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.sequence([
      // Sprinter slides in from left fast
      Animated.parallel([
        Animated.spring(logoSlide, {
          toValue: 0,
          friction: 7,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(logoFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // ATHLT text appears
      Animated.parallel([
        Animated.timing(textFade, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(textSlide, {
          toValue: 0,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        }),
      ]),
      // Tagline
      Animated.timing(taglineFade, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      // Subtitle
      Animated.timing(subtitleFade, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      // Buttons
      Animated.parallel([
        Animated.timing(buttonsFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(buttonsSlide, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
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
      <View style={styles.topSection}>
        {/* Logo lockup: sprinter + ATHLT */}
        <View style={styles.logoLockup}>
          <Animated.View
            style={{
              opacity: logoFade,
              transform: [{ translateX: logoSlide }],
            }}
          >
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.Text
            style={[
              styles.logoText,
              {
                opacity: textFade,
                transform: [{ translateX: textSlide }],
              },
            ]}
          >
            ATHLT
          </Animated.Text>
        </View>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, { opacity: taglineFade }]}>
          Your AI trainer.
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text style={[styles.subtitle, { opacity: subtitleFade }]}>
          Tell us about your game.{'\n'}Get a plan built for how you play.
        </Animated.Text>
      </View>

      {/* Buttons */}
      <Animated.View
        style={[
          styles.bottomSection,
          {
            opacity: buttonsFade,
            transform: [{ translateY: buttonsSlide }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleGetStarted}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>GET STARTED</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleSignIn}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>I HAVE AN ACCOUNT</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          2 minutes to set up · Free to start
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '900',
    fontStyle: 'italic',
    color: Colors.primary,
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomSection: {
    paddingBottom: 20,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.black,
    letterSpacing: 2,
  },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1.5,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
});
