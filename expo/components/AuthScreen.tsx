import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/constants/supabase';

interface AuthScreenProps {
  onComplete: (isGuest: boolean) => void;
  onBack: () => void;
  mode?: 'signup' | 'signin';
}

/**
 * Sign up / sign in screen.
 * Guest mode removed — we need a real account for plan sync and memory system.
 */
export default function AuthScreen({ onComplete, onBack, mode: initialMode }: AuthScreenProps) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'signup' | 'signin'>(initialMode || 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          setLoading(false);
          return;
        }
      }
      onComplete(false);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <View style={[s.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require('@/assets/images/coach-x-small.png')}
          style={s.avatar}
          resizeMode="cover"
        />
        <Text style={s.title}>
          {mode === 'signup' ? 'Save your plan.' : 'Welcome back.'}
        </Text>
        <Text style={s.subtitle}>
          {mode === 'signup'
            ? 'Create an account so Coach X remembers your progress and your plan syncs across devices.'
            : 'Sign in to pick up where you left off.'}
        </Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <View style={s.inputGroup}>
          <TextInput
            style={s.input}
            placeholder="Email"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={s.input}
            placeholder="Password"
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          {mode === 'signup' && (
            <TextInput
              style={s.input}
              placeholder="Confirm password"
              placeholderTextColor={Colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          )}
        </View>

        <TouchableOpacity
          style={s.primaryBtn}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={s.primaryBtnTxt}>
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setMode(mode === 'signup' ? 'signin' : 'signup');
            setError('');
          }}
          style={s.switchBtn}
          activeOpacity={0.7}
        >
          <Text style={s.switchTxt}>
            {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={s.switchLink}>
              {mode === 'signup' ? 'Sign in' : 'Sign up'}
            </Text>
          </Text>
        </TouchableOpacity>

        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerTxt}>OR</Text>
          <View style={s.dividerLine} />
        </View>

        <TouchableOpacity style={s.socialBtn} activeOpacity={0.5}>
          <Text style={s.socialIcon}>G</Text>
          <Text style={s.socialTxt}>Continue with Google</Text>
          <Text style={s.comingSoon}>Coming soon</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.socialBtn} activeOpacity={0.5}>
          <Text style={s.socialIcon}></Text>
          <Text style={s.socialTxt}>Continue with Apple</Text>
          <Text style={s.comingSoon}>Coming soon</Text>
        </TouchableOpacity>

        <Text style={s.terms}>
          By signing up you agree to our Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 22, color: Colors.textSecondary },
  content: {
    paddingHorizontal: 28, paddingTop: 10, paddingBottom: 40, alignItems: 'center',
  },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 20 },
  title: {
    fontSize: 28, fontWeight: '700', color: Colors.textPrimary,
    textAlign: 'center', marginBottom: 8, letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 15, color: Colors.textSecondary,
    textAlign: 'center', marginBottom: 24, letterSpacing: -0.2,
  },
  error: {
    fontSize: 13, color: Colors.danger, textAlign: 'center', marginBottom: 16,
    backgroundColor: '#FBE9E9', borderRadius: 10, padding: 12, width: '100%',
  },
  inputGroup: { width: '100%', gap: 12, marginBottom: 20 },
  input: {
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: 18, paddingVertical: 16,
    fontSize: 15, color: Colors.textPrimary, width: '100%',
    letterSpacing: -0.2,
  },
  primaryBtn: {
    backgroundColor: '#1A1A1A', borderRadius: 100, paddingVertical: 18,
    alignItems: 'center', width: '100%', marginBottom: 16,
  },
  primaryBtnTxt: {
    fontSize: 16, fontWeight: '600', color: Colors.white, letterSpacing: 0.2,
  },
  switchBtn: { marginBottom: 24 },
  switchTxt: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  switchLink: { color: Colors.primary, fontWeight: '700' },
  divider: {
    flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.surfaceBorder },
  dividerTxt: {
    fontSize: 12, color: Colors.textMuted, paddingHorizontal: 16, fontWeight: '600',
  },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingVertical: 16, paddingHorizontal: 18,
    width: '100%', marginBottom: 10, opacity: 0.5,
  },
  socialIcon: {
    fontSize: 18, fontWeight: '700', color: Colors.textPrimary, width: 28,
  },
  socialTxt: {
    fontSize: 15, fontWeight: '500', color: Colors.textPrimary, flex: 1,
  },
  comingSoon: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
  terms: {
    fontSize: 11, color: Colors.textMuted, textAlign: 'center',
    marginTop: 20, lineHeight: 16, paddingHorizontal: 20,
  },
});
