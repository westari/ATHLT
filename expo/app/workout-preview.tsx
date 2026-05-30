/**
 * WorkoutPreview — shown when user taps the hero ring or plan card on the home screen.
 * Displays the full drill list for today's plan, explains why it was assigned,
 * and offers a single "Begin Workout" button to start the session.
 *
 * Route: /workout-preview
 */

import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft, Edit3, Play, Zap, Target, Flame, Brain, Shield, Wind,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';

const TYPE_CONFIG: Record<string, { bg: string; text: string; label: string; Icon: any }> = {
  warmup:       { bg: Colors.primarySoft,  text: Colors.primaryPressed, label: 'WARMUP',       Icon: Wind },
  skill:        { bg: Colors.marineSoft,   text: Colors.marine,         label: 'SKILL',        Icon: Target },
  shooting:     { bg: Colors.primarySoft,  text: '#926000',             label: 'SHOOTING',     Icon: Zap },
  conditioning: { bg: Colors.courtSoft,    text: Colors.court,          label: 'CONDITIONING', Icon: Flame },
  other:        { bg: Colors.inkA8,        text: Colors.textSecondary,  label: 'DRILL',        Icon: Brain },
};

function getTypeConfig(type?: string) {
  return TYPE_CONFIG[type ?? 'other'] ?? TYPE_CONFIG.other;
}

export default function WorkoutPreviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, currentDayIndex } = usePlanStore();

  const day = plan?.days?.[currentDayIndex];
  const planDrills = day?.drills || [];

  const resolvedDrills = useMemo(
    () => planDrills.map(d => resolvePlanDrill(d)).filter((d): d is NonNullable<typeof d> => d !== null),
    [planDrills],
  );

  const totalTime = resolvedDrills.reduce((acc, d) => {
    const mins = parseInt(String(d.duration ?? d.time ?? '0')) || 0;
    return acc + mins;
  }, 0);

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
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No workout today</Text>
          <Text style={styles.emptyBody}>Head back and create one from the + button.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.headerBack} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{day.focus || 'Today\'s Workout'}</Text>
          <Text style={styles.headerSub}>
            {resolvedDrills.length} drill{resolvedDrills.length !== 1 ? 's' : ''}
            {totalTime > 0 ? ` · ${totalTime} min` : ''}
            {day.duration ? ` · ${day.duration}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerEdit} onPress={onEdit} activeOpacity={0.7}>
          <Edit3 size={17} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Why this workout */}
        {plan.aiInsight ? (
          <View style={styles.whyCard}>
            <Text style={styles.whyLabel}>WHY THIS WORKOUT</Text>
            <Text style={styles.whyText}>"{plan.aiInsight}"</Text>
          </View>
        ) : null}

        {/* Day info */}
        <View style={styles.dayInfo}>
          <View style={styles.dayInfoPill}>
            <Text style={styles.dayInfoText}>{plan.weekTitle}</Text>
          </View>
          {day.isRest && (
            <View style={[styles.dayInfoPill, { backgroundColor: Colors.surfaceBorder }]}>
              <Text style={styles.dayInfoText}>Rest Day</Text>
            </View>
          )}
        </View>

        {/* Rest day state */}
        {day.isRest ? (
          <View style={styles.restCard}>
            <Text style={styles.restTitle}>Recovery Day</Text>
            <Text style={styles.restBody}>
              Rest and recovery are part of the plan. Light stretching or a few easy dribbles — no heavy work today.
            </Text>
          </View>
        ) : resolvedDrills.length === 0 ? (
          <View style={styles.emptyDrills}>
            <Text style={styles.emptyTitle}>No drills assigned</Text>
            <Text style={styles.emptyBody}>Tap Edit to add some drills to today's session.</Text>
          </View>
        ) : (
          <>
            {/* Drill list */}
            <Text style={styles.drillsLabel}>DRILLS</Text>
            {resolvedDrills.map((drill, i) => {
              const cfg = getTypeConfig(drill.type);
              const IconComp = cfg.Icon;
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.drillRow}
                  onPress={() => router.push(`/drill/${drill.id ?? drill.drillId}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.drillNumWrap}>
                    <Text style={styles.drillNum}>{i + 1}</Text>
                  </View>
                  <View style={[styles.drillTypeTag, { backgroundColor: cfg.bg }]}>
                    <IconComp size={12} color={cfg.text} />
                  </View>
                  <View style={styles.drillInfo}>
                    <Text style={styles.drillName}>{drill.name}</Text>
                    <Text style={styles.drillMeta}>
                      {drill.duration ? `${drill.duration} min` : drill.time}
                      {drill.sets ? ` · ${drill.sets} sets` : ''}
                      {drill.reps ? ` · ${drill.reps} reps` : ''}
                    </Text>
                  </View>
                  <View style={[styles.drillTypePill, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.drillTypePillText, { color: cfg.text }]}>{cfg.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Begin Workout sticky footer */}
      {!day.isRest && resolvedDrills.length > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.beginBtn} onPress={onBegin} activeOpacity={0.85}>
            <Play size={18} color={Colors.black} fill={Colors.black} />
            <Text style={styles.beginBtnText}>Begin Workout</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.hairline,
    backgroundColor: Colors.background,
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, paddingHorizontal: 8 },
  headerTitle: {
    fontSize: 17, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.3,
  },
  headerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  headerEdit: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },

  whyCard: {
    backgroundColor: Colors.primarySoft,
    marginHorizontal: 24, marginTop: 20, marginBottom: 16,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(201,162,74,0.20)',
  },
  whyLabel: {
    fontSize: 10, fontWeight: '600', color: Colors.primary,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6,
  },
  whyText: {
    fontSize: 14, fontStyle: 'italic', color: Colors.primaryPressed,
    lineHeight: 20, letterSpacing: -0.1,
  },

  dayInfo: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 16, flexWrap: 'wrap',
  },
  dayInfoPill: {
    backgroundColor: Colors.inkA8,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
  },
  dayInfoText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  drillsLabel: {
    fontSize: 11, fontWeight: '500', color: Colors.textMuted,
    letterSpacing: 0.96, textTransform: 'uppercase',
    paddingHorizontal: 24, marginBottom: 8,
  },
  drillRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface,
    marginHorizontal: 24, marginBottom: 8,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Colors.hairline,
  },
  drillNumWrap: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.inkA8,
    alignItems: 'center', justifyContent: 'center',
  },
  drillNum: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
  drillTypeTag: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  drillInfo: { flex: 1 },
  drillName: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary, letterSpacing: -0.2 },
  drillMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  drillTypePill: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100,
  },
  drillTypePillText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },

  restCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 24, borderRadius: 22,
    borderWidth: 1, borderColor: Colors.hairline,
    padding: 24, alignItems: 'center',
  },
  restTitle: { fontSize: 20, fontWeight: '300', color: Colors.textPrimary, marginBottom: 8 },
  restBody: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  emptyDrills: { paddingHorizontal: 24, paddingTop: 20, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '300', color: Colors.textPrimary, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  backBtn: {
    marginTop: 16, backgroundColor: Colors.textPrimary,
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: 100,
  },
  backBtnText: { fontSize: 15, fontWeight: '500', color: Colors.white },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.background,
    borderTopWidth: 1, borderTopColor: Colors.hairline,
    paddingHorizontal: 24, paddingTop: 16,
  },
  beginBtn: {
    backgroundColor: Colors.primary, borderRadius: 100,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  beginBtnText: {
    fontSize: 16, fontWeight: '700', color: Colors.black, letterSpacing: -0.3,
  },
});
