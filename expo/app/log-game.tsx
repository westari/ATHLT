// expo/app/log-game.tsx
// Quick game log: opponent, W/L, score, key stats, optional notes.
// Saves to Supabase `games` table. No AI feedback in v1.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView,
  TextInput, KeyboardAvoidingView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/constants/supabase';

type Result = 'W' | 'L' | null;

export default function LogGameScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [opponent, setOpponent] = useState('');
  const [result, setResult] = useState<Result>(null);
  const [yourScore, setYourScore] = useState('');
  const [oppScore, setOppScore] = useState('');
  const [points, setPoints] = useState('');
  const [rebounds, setRebounds] = useState('');
  const [assists, setAssists] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const onBack = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const onPickResult = (r: Result) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResult(r);
  };

  const canSave = !!opponent.trim() && result !== null;

  const onSave = async () => {
    if (!canSave || saving) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setSaving(true);
    setSaveError(null);

    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userData?.user?.id;
      if (!userId) {
        // Not signed in — save locally? For now, just allow with null user.
        // You may want to require auth here later.
      }

      const payload = {
        user_id: userId || null,
        opponent: opponent.trim(),
        result, // 'W' or 'L'
        your_score: parseIntOrNull(yourScore),
        opp_score:  parseIntOrNull(oppScore),
        points:     parseIntOrNull(points),
        rebounds:   parseIntOrNull(rebounds),
        assists:    parseIntOrNull(assists),
        notes:      notes.trim() || null,
        played_at:  new Date().toISOString(),
      };

      const { error } = await supabase.from('games').insert(payload);
      if (error) throw error;

      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      console.warn('log-game save error', err);
      setSaveError(err?.message || 'Could not save the game. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Log a Game</Text>
          <Text style={styles.headerSub}>Quick stats from your last game</Text>
        </View>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Section: The Game */}
          <Text style={styles.sectionLabel}>THE GAME</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Opponent</Text>
            <TextInput
              style={styles.input}
              value={opponent}
              onChangeText={setOpponent}
              placeholder="Who did you play?"
              placeholderTextColor={Colors.textMuted}
              maxLength={80}
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Result</Text>
            <View style={styles.resultRow}>
              <TouchableOpacity
                style={[
                  styles.resultBtn,
                  result === 'W' && styles.resultBtnWin,
                ]}
                onPress={() => onPickResult('W')}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.resultBtnText,
                  result === 'W' && styles.resultBtnTextActive,
                ]}>
                  Win
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.resultBtn,
                  result === 'L' && styles.resultBtnLoss,
                ]}
                onPress={() => onPickResult('L')}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.resultBtnText,
                  result === 'L' && styles.resultBtnTextActive,
                ]}>
                  Loss
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Score (optional)</Text>
            <View style={styles.scoreRow}>
              <View style={styles.scoreCol}>
                <Text style={styles.scoreColLabel}>You</Text>
                <TextInput
                  style={styles.scoreInput}
                  value={yourScore}
                  onChangeText={setYourScore}
                  placeholder="—"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
              <Text style={styles.scoreDash}>—</Text>
              <View style={styles.scoreCol}>
                <Text style={styles.scoreColLabel}>Them</Text>
                <TextInput
                  style={styles.scoreInput}
                  value={oppScore}
                  onChangeText={setOppScore}
                  placeholder="—"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
            </View>
          </View>

          {/* Section: Your Stat Line */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>YOUR STAT LINE</Text>

          <View style={styles.statsGrid}>
            <StatField label="Points"   value={points}   onChange={setPoints} />
            <StatField label="Rebounds" value={rebounds} onChange={setRebounds} />
            <StatField label="Assists"  value={assists}  onChange={setAssists} />
          </View>

          {/* Section: Notes */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>NOTES (OPTIONAL)</Text>

          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="What went well? What's bugging you? Anything to remember..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />

          {saveError && (
            <Text style={styles.errorText}>{saveError}</Text>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
            onPress={onSave}
            disabled={!canSave || saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <>
                <ActivityIndicator color={Colors.white} size="small" />
                <Text style={styles.saveBtnText}>Saving...</Text>
              </>
            ) : (
              <>
                <Check size={18} color={Colors.white} strokeWidth={3} />
                <Text style={styles.saveBtnText}>Save game</Text>
              </>
            )}
          </TouchableOpacity>

          {!canSave && (
            <Text style={styles.footerHint}>
              Opponent and result required.
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ===== Helpers =====

function StatField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statColLabel}>{label}</Text>
      <TextInput
        style={styles.statInput}
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={Colors.textMuted}
        keyboardType="number-pad"
        maxLength={3}
      />
    </View>
  );
}

function parseIntOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return isNaN(n) ? null : n;
}

// ===== Styles =====

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 12,
    paddingHorizontal: 4,
  },

  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },

  resultRow: {
    flexDirection: 'row',
    gap: 10,
  },
  resultBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultBtnWin: {
    backgroundColor: 'rgba(61, 154, 92, 0.12)',
    borderColor: Colors.success,
  },
  resultBtnLoss: {
    backgroundColor: 'rgba(196, 69, 69, 0.12)',
    borderColor: Colors.danger,
  },
  resultBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: -0.2,
  },
  resultBtnTextActive: {
    color: Colors.textPrimary,
  },

  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoreCol: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scoreColLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  scoreInput: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    padding: 0,
  },
  scoreDash: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textMuted,
  },

  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCol: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statColLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  statInput: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.6,
    padding: 0,
  },

  notesInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 14,
    minHeight: 100,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
    lineHeight: 20,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
  },
  saveBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 100,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnDisabled: {
    opacity: 0.35,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.2,
  },
  footerHint: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
});
