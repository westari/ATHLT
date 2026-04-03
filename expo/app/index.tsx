iimport React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const logoFade = useRef(new Animated.Value(0)).current;
  const logoSlide = useRef(new Animated.Value(-20)).current;
  const lineFade = useRef(new Animated.Value(0)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;
  const buttonsFade = useRef(new Animated.Value(0)).current;
  const buttonsSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.sequence([
      // Logo drops in
      Animated.parallel([
        Animated.timing(logoFade, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(logoSlide, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Line draws across
      Animated.parallel([
        Animated.timing(lineFade, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(lineWidth, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
      ]),
      // Tagline appears
      Animated.timing(taglineFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Subtitle
      Animated.timing(subtitleFade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      // Buttons slide up
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
    // TODO: sign in flow
  };

  const animatedLineStyle = {
    opacity: lineFade,
    width: lineWidth.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    }),
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Top section — logo and messaging */}
      <View style={styles.topSection}>
        <Animated.Text
          style={[
            styles.logo,
            {
              opacity: logoFade,
              transform: [{ translateY: logoSlide }],
            },
          ]}
        >
          ATHLT
        </Animated.Text>

        <View style={styles.lineContainer}>
          <Animated.View style={[styles.line, animatedLineStyle]} />
        </View>

        <Animated.Text style={[styles.tagline, { opacity: taglineFade }]}>
          Your AI trainer.
        </Animated.Text>

        <Animated.Text style={[styles.subtitle, { opacity: subtitleFade }]}>
          Tell us about your game. Get a training plan{'\n'}built for how you actually play.
        </Animated.Text>
      </View>

      {/* Bottom section — buttons */}
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
  logo: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 12,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  lineContainer: {
    width: 48,
    height: 3,
    marginTop: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  line: {
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  tagline: {
    fontSize: 20,
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
