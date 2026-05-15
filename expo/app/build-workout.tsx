// expo/app/build-workout.tsx
// 5-step wizard for building a custom workout.
// Steps: Focus → Duration → Environment → Intensity → Notes → Preview
// On generate: POSTs to /api/build-workout, Haiku returns a workout plan.

import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView,
  TextInput, KeyboardAvoidingView, ActivityIndicator, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft, ArrowRight, Check, Sparkles, RotateCcw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';

// ===== Step config =====
const FOCUS_OPTIONS = [
  { id: 'shooting',     label: 'Shooting' },
  { id: 'handles',      label: 'Ball Handling' },
  { id: 'finishing',    label: 'Finishing' },
  { id: 'defense',      label: 'Defense' },
  { id: 'conditioning', label: 'Conditioning' },
  { id: 'mixed',        label: 'Mixed / Full Workout' },
];

const DURATION_OPTIONS = [
  { id: '15', label: '15 min' },
  { id: '30', label: '30 min' },
  { id: '45', label: '45 min' },
  { id: '60', label: '60 min' },
  { id: '90', label: '90 min' },
];

const ENVIRONMENT_OPTIONS = [
  { id: 'full_court',   label: 'Full court + hoop' },
  { id: 'driveway',     label: 'Driveway + hoop' },
  { id: 'ball_only',    label: 'Ball only, no hoop' },
  { id: 'no_equipment', label: 'No equipment' },
];

const INTENSITY_OPTIONS = [
  { id: 'light',    label: 'Light',    sub: 'Active recovery' },
  { id: 'standard', label: 'Standard', sub: 'Normal training day' },
  { id: 'hard',     label: 'Hard',     sub: 'Push the pace' },
];

const TOTAL_STEPS = 5;

// IMPORTANT: replace this with your real Vercel domain
const API_BASE = 'https://www.tryparlai.com';

type ProposedDrill = { name: string; time: string };

export default function BuildWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, currentDayIndex, updateDayDrills } = usePlanStore();

  const [step, setStep] = useState(0); // 0..4 = wizard, 5 = preview
  const [focus, setFocus] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<ProposedDrill[] | null>(null);
  const [coachMsg, setCoachMsg] = useState<string>('');

  const onBack = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 0) {
      router.back();
    } else {
      setStep(s => s - 1);
    }
  };

  const onNext = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(s => s + 1);
  };

  const canAdvance = () => {
    switch (step) {
      case 0: return !!focus;
      case 1: return !!duration;
      case 2: return !!environment;
      case 3: return !!intensity;
      case 4: return true; // notes are optional
      default: return false;
    }
  };

  const onGenerate = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGenerating(true);
    setGenError(null);

    try {
      const res = await fetch(`${API_BASE}/api/build-workout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focus,
          duration,
          environment,
          intensity,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();

      if (!Array.isArray(data.drills) || data.drills.length === 0) {
        throw new Error('Coach X returned no drills. Try again.');
      }

      setProposed(data.drills.slice(0, 10).map((d: any) => ({
        name: String(d.name || '').trim(),
        time: String(d.time || '5 min').trim(),
      })));
      setCoachMsg(String(data.message || '').trim());
      setStep(5); // preview
    } catch (err: any) {
      console.warn('build-workout error', err);
      setGenError(err?.message || 'Could not build the workout. Try again.');
    } finally {
      setGenerating(false);
    }
  };

  const onSaveToToday = () => {
    if (!proposed) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const resolved = proposed
      .map(d => resolvePlanDrill(d))
      .filter(Boolean) as NonNullable<ReturnType<typeof resolvePlanDrill>>[];
    updateDayDrills(currentDayIndex, resolved);
    router.replace('/');
  };

  const onRetry = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProposed(null);
    setCoachMsg('');
    setStep(4);
  };

  // ===== Render =====

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <ChoiceStep
            title="What's the focus?"
            subtitle="Pick the area you want to work on."
            options={FOCUS_OPTIONS}
            selected={focus}
            onSelect={setFocus}
          />
        );
      case 1:
        return (
          <ChoiceStep
            title="How long?"
            subtitle="Honest answer. Coach X will fill the time."
            options={DURATION_OPTIONS}
            selected={duration}
            onSelect={setDuration}
            twoCol
          />
        );
      case 2:
        return (
          <ChoiceStep
            title="Where are you training?"
            subtitle="Coach X will pick drills you can actually do."
            options={ENVIRONMENT_OPTIONS}
            selected={environment}
            onSelect={setEnvironment}
          />
        );
      case 3:
        return (
          <ChoiceStep
            title="How hard?"
            subtitle="Be real with yourself."
            options={INTENSITY_OPTIONS}
            selected={intensity}
            onSelect={setIntensity}
          />
        );
      case 4:
        return (
          <NotesStep
            value={notes}
            onChange={setNotes}
          />
        );
      case 5:
        return (
          <PreviewStep
            drills={proposed || []}
            coachMsg={coachMsg}
            onRetry={onRetry}
          />
        );
      default:
        return null;
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
          <Text style={styles.headerTitle}>Build a Workout</Text>
          <Text style={styles.headerSub}>
            {step < 5 ? `Step ${step + 1} of ${TOTAL_STEPS}` : 'Coach X built this'}
          </Text>
        </View>
        <View style={styles.iconBtn} />
      </View>

      {/* Progress bar */}
      {step < 5 && (
        <View style={styles.progressTrack}>
          <View style={[
            styles.progressFill,
            { width: `${((step + 1) / TOTAL_STEPS) * 100}%` },
          ]} />
        </View>
      )}

      {/* Step content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderStep()}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {step < 4 && (
            <TouchableOpacity
              style={[styles.primaryBtn, !canAdvance() && styles.primaryBtnDisabled]}
              onPress={onNext}
              disabled={!canAdvance()}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
              <ArrowRight size={18} color={Colors.white} />
            </TouchableOpacity>
          )}

          {step === 4 && (
            <TouchableOpacity
              style={[styles.primaryBtn, generating && { opacity: 0.6 }]}
              onPress={onGenerate}
              disabled={generating}
              activeOpacity={0.85}
            >
              {generating ? (
                <>
                  <ActivityIndicator color={Colors.white} size="small" />
                  <Text style={styles.primaryBtnText}>Building...</Text>
                </>
              ) : (
                <>
                  <Sparkles size={18} color={Colors.white} />
                  <Text style={styles.primaryBtnText}>Build the workout</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {step === 5 && proposed && (
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={onSaveToToday}
                activeOpacity={0.85}
              >
                <Check size={18} color={Colors.white} strokeWidth={3} />
                <Text style={styles.primaryBtnText}>Use as today's workout</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={onRetry}
                activeOpacity={0.7}
              >
                <RotateCcw size={14} color={Colors.textMuted} />
                <Text style={styles.secondaryBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          {genError && (
            <Text style={styles.errorText}>{genError}</Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ===== Sub-components =====

function ChoiceStep({
  title, subtitle, options, selected, onSelect, twoCol,
}: {
  title: string;
  subtitle: string;
  options: { id: string; label: string; sub?: string }[];
  selected: string | null;
  onSelect: (id: string) => void;
  twoCol?: boolean;
}) {
  return (
    <View>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepSubtitle}>{subtitle}</Text>

      <View style={[styles.choices, twoCol && styles.choicesGrid]}>
        {options.map(opt => {
          const isSelected = selected === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.choice,
                twoCol && styles.choiceGrid,
                isSelected && styles.choiceSelected,
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(opt.id);
              }}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.choiceLabel, isSelected && styles.choiceLabelSelected]}>
                  {opt.label}
                </Text>
                {opt.sub && (
                  <Text style={[styles.choiceSub, isSelected && styles.choiceSubSelected]}>
                    {opt.sub}
                  </Text>
                )}
              </View>
              <View style={[styles.choiceRadio, isSelected && styles.choiceRadioSelected]}>
                {isSelected && <Check size={12} color={Colors.white} strokeWidth={3} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function NotesStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View>
      <Text style={styles.stepTitle}>Anything else?</Text>
      <Text style={styles.stepSubtitle}>
        Tell Coach X anything specific — injuries, focus areas, what you're working on. Or skip.
      </Text>

      <TextInput
        style={styles.notesInput}
        value={value}
        onChangeText={onChange}
        placeholder="e.g. weak hand needs work, wrist still healing, want more game-speed stuff..."
        placeholderTextColor={Colors.textMuted}
        multiline
        maxLength={500}
        textAlignVertical="top"
      />

      <Text style={styles.notesHint}>Optional. Coach X reads this before building.</Text>
    </View>
  );
}

function PreviewStep({
  drills, coachMsg, onRetry,
}: {
  drills: ProposedDrill[];
  coachMsg: string;
  onRetry: () => void;
}) {
  const totalMin = drills.reduce((acc, d) => {
    const n = parseInt(d.time, 10);
    return acc + (isNaN(n) ? 0 : n);
  }, 0);

  return (
    <View>
      <View style={styles.previewBadge}>
        <Sparkles size={12} color={Colors.primary} />
        <Text style={styles.previewBadgeText}>COACH X BUILT THIS</Text>
      </View>

      <Text style={styles.previewTitle}>
        Your workout
      </Text>
      <Text style={styles.previewMeta}>
        {drills.length} drills · {totalMin} min
      </Text>

      {coachMsg.length > 0 && (
        <View style={styles.coachReadCard}>
          <Text style={styles.coachReadText}>{coachMsg}</Text>
        </View>
      )}

      <View style={styles.drillList}>
        {drills.map((d, i) => (
          <View key={i} style={styles.drillRow}>
            <View style={styles.drillIndex}>
              <Text style={styles.drillIndexText}>{i + 1}</Text>
            </View>
            <Text style={styles.drillName} numberOfLines={2}>{d.name}</Text>
            <Text style={styles.drillTime}>{d.time}</Text>
          </View>
        ))}
      </View>
    </View>
  );
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

  progressTrack: {
    height: 3,
    backgroundColor: Colors.surfaceBorder,
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.primary,
  },

  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textMuted,
    marginBottom: 24,
    lineHeight: 20,
  },

  choices: {
    gap: 10,
  },
  choicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  choiceGrid: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  choiceSelected: {
    backgroundColor: 'rgba(212, 160, 23, 0.08)',
    borderColor: Colors.primary,
  },
  choiceLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  choiceLabelSelected: {
    color: Colors.textPrimary,
  },
  choiceSub: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textMuted,
    marginTop: 2,
  },
  choiceSubSelected: {
    color: Colors.textSecondary,
  },
  choiceRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceRadioSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },

  notesInput: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 16,
    minHeight: 140,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
    lineHeight: 20,
  },
  notesHint: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
    marginTop: 8,
    paddingHorizontal: 4,
  },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
  },
  primaryBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 100,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.35,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
  },

  // Preview step
  previewBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 160, 23, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 23, 0.25)',
  },
  previewBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.2,
  },
  previewTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  previewMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 16,
  },
  coachReadCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 23, 0.3)',
  },
  coachReadText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  drillList: {
    gap: 8,
  },
  drillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  drillIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 160, 23, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  drillIndexText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  drillName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  drillTime: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
    flexShrink: 0,
  },
});
