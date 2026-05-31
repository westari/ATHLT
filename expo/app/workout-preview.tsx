/**
 * WorkoutPreview — drill list shown before starting a session.
 * Tapped from the home screen hero ring or plan card.
 *
 * Route: /workout-preview
 */

import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, Edit3, Play, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';

const TYPE_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  warmup:       { bg: Colors.primarySoft,  text: Colors.primaryPressed, label: 'WARMUP' },
  skill:        { bg: Colors.marineSoft,   text: Colors.marine,         label: 'SKILL WORK' },
  shooting:     { bg: Colors.primarySoft,  text: '#926000',             label: 'SHOOTING' },
  conditioning: { bg: Colors.courtSoft,    text: Colors.court,          label: 'CONDITIONING' },
};

function getTypeConfig(type?: string) {
  return TYPE_CONFIG[type ?? ''] ?? TYPE_CONFIG.skill;
}

export default function WorkoutPreviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, completedDrills, currentDayIndex } = usePlanStore();

  const day = plan?.days?.[currentDayIndex];

  const resolvedDrills = useMemo(
    () => (day?.drills || [])
      .map(d => resolvePlanDrill(d))
      .filter(Boolean) as NonNullable<ReturnType<typeof resolvePlanDrill>>[],
    [day],
  );

  const onBack = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const onEdit = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/edit-workout');
  };

  const onBegin = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/session');
  };

  if (!plan || !day) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <TouchableOpacity style={s.backRow} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <View style={s.emptyWrap}>
          <Text style={s.emptyTitle}>No workout today</Text>
          <Text style={s.emptyBody}>Create one from the + button on the home screen.</Text>
        </View>
      </View>
    );
  }

  const doneCount = resolvedDrills.filter((_, i) => completedDrills[`${currentDayIndex}-${i}`]).length;

  return (
    <View style={[s.container, { paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.headerBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{day.focus || "Today's Workout"}</Text>
          {day.duration ? <Text style={s.headerSub}>{day.duration}</Text> : null}
        </View>
        <TouchableOpacity style={s.headerBtn} onPress={onEdit} activeOpacity={0.7}>
          <Edit3 size={17} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Plan meta row */}
        <View style={s.metaRow}>
          <View style={s.metaPill}>
            <Text style={s.metaPillText}>{plan.weekTitle}</Text>
          </View>
          <View style={s.metaPill}>
            <Text style={s.metaPillText}>Day {currentDayIndex + 1} of {plan.days.length}</Text>
          </View>
          {resolvedDrills.length > 0 && (
            <View style={s.metaPill}>
              <Text style={s.metaPillText}>{resolvedDrills.length} drills</Text>
            </View>
          )}
        </View>

        {/* Why this plan — only show here, not on home screen */}
        {plan.aiInsight ? (
          <View style={s.whyCard}>
            <Text style={s.whyLabel}>WHY THIS WORKOUT</Text>
            <Text style={s.whyText}>"{plan.aiInsight}"</Text>
          </View>
        ) : null}

        {/* Progress bar if already started */}
        {doneCount > 0 && (
          <View style={s.progressSection}>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${(doneCount / resolvedDrills.length) * 100}%` }]} />
            </View>
            <Text style={s.progressLabel}>{doneCount} of {resolvedDrills.length} done</Text>
          </View>
        )}

        {/* Rest day */}
        {day.isRest ? (
          <View style={s.restCard}>
            <Text style={s.restTitle}>Rest Day</Text>
            <Text style={s.restBody}>
              Recovery is part of the plan. Light movement or stretching is fine — no heavy work today.
            </Text>
          </View>
        ) : resolvedDrills.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>No drills yet</Text>
            <Text style={s.emptyBody}>Tap Edit to add drills to this session.</Text>
          </View>
        ) : (
          <>
            {/* Drill list — same layout as session.tsx drill list modal */}
            <View style={s.drillCard}>
              {resolvedDrills.map((drill, i) => {
                const isDone = !!completedDrills[`${currentDayIndex}-${i}`];
                const tc = getTypeConfig(drill.type);
                const isLast = i === resolvedDrills.length - 1;
                return (
                  <TouchableOpacity
                    key={String(drill.id ?? drill.name) + i}
                    style={[s.drillRow, isLast && s.drillRowLast]}
                    onPress={() => router.push(`/drill/${(drill as any).id ?? (drill as any).drillId}` as any)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.drillNum, isDone && s.drillNumDone]}>
                      {isDone
                        ? <Check size={11} color={Colors.white} strokeWidth={3} />
                        : <Text style={s.drillNumText}>{i + 1}</Text>
                      }
                    </View>
                    <View style={s.drillInfo}>
                      <Text style={[s.drillName, isDone && s.drillNameDone]} numberOfLines={1}>
                        {drill.name}
                      </Text>
                      <Text style={s.drillMeta}>{drill.time || (drill.duration ? `${drill.duration} min` : '')}</Text>
                    </View>
                    <View style={[s.typeTag, { backgroundColor: tc.bg }]}>
                      <Text style={[s.typeTagText, { color: tc.text }]}>{tc.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Begin Workout — sticky dark button */}
      {!day.isRest && resolvedDrills.length > 0 && (
        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={s.beginBtn} onPress={onBegin} activeOpacity={0.85}>
            <Play size={16} color={Colors.buttonDarkText} fill={Colors.buttonDarkText} />
            <Text style={s.beginBtnText}>
              {doneCount > 0 ? 'Continue Workout' : 'Begin Workout'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  backRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backText: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, paddingHorizontal: 8 },
  headerTitle: {
    fontSize: 17, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.3,
  },
  headerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  metaRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4,
  },
  metaPill: {
    backgroundColor: Colors.surface, borderRadius: 100,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  metaPillText: { fontSize: 12, fontWeight: '500', color: Colors.textSecondary },

  whyCard: {
    backgroundColor: Colors.primarySoft,
    marginHorizontal: 20, marginTop: 16, marginBottom: 4,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(201,162,74,0.20)',
  },
  whyLabel: {
    fontSize: 9, fontWeight: '700', color: Colors.primary,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 5,
  },
  whyText: {
    fontSize: 13, fontStyle: 'italic', color: Colors.primaryPressed,
    lineHeight: 19, letterSpacing: -0.1,
  },

  progressSection: {
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 2,
  },
  progressBar: {
    height: 3, backgroundColor: Colors.surfaceBorder,
    borderRadius: 2, overflow: 'hidden', marginBottom: 5,
  },
  progressFill: { height: 3, backgroundColor: Colors.primary, borderRadius: 2 },
  progressLabel: { fontSize: 11, color: Colors.textMuted },

  // Drill card — matches completeDrillCard from session.tsx
  drillCard: {
    marginHorizontal: 20, marginTop: 16,
    backgroundColor: Colors.surface,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
  },

  // Drill row — matches listRow from session.tsx
  drillRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  drillRowLast: { borderBottomWidth: 0 },

  // Number circle — matches listNum from session.tsx
  drillNum: {
    width: 26, height: 26, borderRadius: 13, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  drillNumDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  drillNumText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },

  // Drill info — matches listInfo from session.tsx
  drillInfo: { flex: 1 },
  drillName: {
    fontSize: 14, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.2,
  },
  drillNameDone: { color: Colors.textMuted },
  drillMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  // Type tag — matches typeTag from session.tsx
  typeTag: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 100, alignSelf: 'flex-start',
  },
  typeTagText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  restCard: {
    backgroundColor: Colors.surface, margin: 20,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 24, alignItems: 'center',
  },
  restTitle: { fontSize: 20, fontWeight: '300', color: Colors.textPrimary, marginBottom: 8 },
  restBody: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '300', color: Colors.textPrimary, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Begin button — matches primaryBtn from session.tsx
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.background,
    borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
    paddingHorizontal: 20, paddingTop: 14,
  },
  beginBtn: {
    backgroundColor: Colors.buttonDark,
    borderRadius: 100, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  beginBtnText: {
    fontSize: 15, fontWeight: '700', color: Colors.buttonDarkText, letterSpacing: -0.2,
  },
});
