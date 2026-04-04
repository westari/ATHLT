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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const logoFade = useRef(new Animated.Value(0)).current;
  const logoSlide = useRef(new Animated.Value(20)).current;
  const headlineFade = useRef(new Animated.Value(0)).current;
  const subtextFade = useRef(new Animated.Value(0)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0.9)).current;
  const signInFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoFade, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(logoSlide, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(headlineFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(subtextFade, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(buttonFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(buttonScale, {
          toValue: 1,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(signInFade, {
        toValue: 1,
        duration: 300,
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
      {/* Logo — pushed up higher */}
      <View style={styles.logoSection}>
        <Animated.View
          style={{
            opacity: logoFade,
            transform: [{ translateY: logoSlide }],
          }}
        >
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* Headline + subtext + CTA — grouped tight in the lower half */}
      <View style={styles.contentSection}>
        <Animated.Text style={[styles.headline, { opacity: headlineFade }]}>
          TRAIN SMARTER.{'\n'}GET BETTER.
        </Animated.Text>

        <Animated.Text style={[styles.subtext, { opacity: subtextFade }]}>
          AI training plans built around your game,{'\n'}your schedule, and your goals.
        </Animated.Text>

        <Animated.View
          style={{
            opacity: buttonFade,
            transform: [{ scale: buttonScale }],
            width: '100%',
          }}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleGetStarted}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>GET STARTED</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{ opacity: signInFade }}>
          <TouchableOpacity
            onPress={handleSignIn}
            activeOpacity={0.7}
            style={styles.signInButton}
          >
            <Text style={styles.signInText}>Already have an account? <Text style={styles.signInLink}>Sign in</Text></Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  logoSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  logoImage: {
    width: SCREEN_WIDTH * 0.85,
    height: 200,
  },
  contentSection: {
    paddingHorizontal: 28,
    paddingBottom: 24,
    alignItems: 'center',
  },
  headline: {
    fontSize: 30,
    fontWeight: '900',
    fontStyle: 'italic',
    color: Colors.primary,
    textAlign: 'center',
    letterSpacing: 2,
    lineHeight: 38,
    marginBottom: 14,
  },
  subtext: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
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
    fontSize: 16,
    fontWeight: '900',
    color: Colors.black,
    letterSpacing: 3,
  },
  signInButton: {
    marginTop: 20,
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
