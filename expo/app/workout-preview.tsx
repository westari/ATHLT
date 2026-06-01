/**
 * WorkoutPreview — full-screen drill list shown before starting a session.
 * Tapped from the home screen hero ring. Matches the Today card design exactly.
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

export default function WorkoutPreviewScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
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
      <View style={[s.container, { paddingTop: insets.top + 8 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <TouchableOpacity style={s.navRow} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={s.emptyWrap}>
          <Text style={s.emptyTitle}>No workout today</Text>
          <Text style={s.emptyBody}>Create one from the + button on the home screen.</Text>
        </View>
      </View>
    );
  }

  const doneCount  = resolvedDrills.filter((_, i) => !!completedDrills[`${currentDayIndex}-${i}`]).length;
  const dayProgress = ((currentDayIndex + 1) / plan.days.length) * 100;
  const subtitle   = `Day ${currentDayIndex + 1} of ${plan.days.length} · ${plan.weekTitle || (day.focus ? `${day.focus} build` : 'Training plan')}`;

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Minimal nav row — back + edit */}
      <View style={[s.navRow, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.navBtn} onPress={onBack} activeOpacity={0.7}>
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={s.navBtn} onPress={onEdit} activeOpacity={0.7}>
          <Edit3 size={17} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero section ── */}
        <View style={s.hero}>

          {/* ASSIGNED tag */}
          <View style={s.assignedTag}>
            <Text style={s.assignedTagText}>ASSIGNED</Text>
          </View>

          {/* TODAY'S WORKOUT + duration */}
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>TODAY'S WORKOUT</Text>
            {day.duration ? <Text style={s.metaDuration}>{day.duration}</Text> : null}
          </View>

          {/* Big focus name */}
          <Text style={s.focusName}>{day.focus || 'Workout'}</Text>

          {/* Gold italic subtitle */}
          <Text style={s.subtitle}>{subtitle}</Text>

          {/* Day progress bar */}
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${dayProgress}%` as any }]} />
          </View>
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* ── Drill list ── */}
        {day.isRest ? (
          <View style={s.restWrap}>
            <Text style={s.restTitle}>Rest Day</Text>
            <Text style={s.restBody}>
              Recovery is part of the plan. Light movement or stretching is fine.
            </Text>
          </View>
        ) : resolvedDrills.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>No drills yet</Text>
            <Text style={s.emptyBody}>Tap Edit to add drills to this session.</Text>
          </View>
        ) : (
          resolvedDrills.map((drill, i) => {
            const isDone = !!completedDrills[`${currentDayIndex}-${i}`];
            const isLast = i === resolvedDrills.length - 1;
            return (
              <View
                key={String((drill as any).id ?? (drill as any).drillId ?? drill.name) + i}
                style={[s.drillRow, !isLast && s.drillRowBorder]}
              >
                <View style={[s.circle, isDone && s.circleDone]}>
                  {isDone && <Check size={14} color={Colors.white} strokeWidth={2.5} />}
                </View>
                <Text
                  style={[s.drillName, isDone && s.drillNameDone]}
                  numberOfLines={1}
                >
                  {drill.name}
                </Text>
                <Text style={s.drillDuration}>
                  {drill.time || (drill.duration ? `${drill.duration} min` : '')}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Sticky Start session button ── */}
      {!day.isRest && resolvedDrills.length > 0 && (
        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={s.startBtn} onPress={onBegin} activeOpacity={0.85}>
            <Play size={16} color={Colors.buttonDarkText} fill={Colors.buttonDarkText} />
            <Text style={s.startBtnText}>
              {doneCount > 0 ? 'Continue session' : 'Start session'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Nav row
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },

  // Hero section
  hero: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 20,
  },
  assignedTag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1, borderColor: 'rgba(201,162,74,0.25)',
    marginBottom: 14,
  },
  assignedTagText: {
    fontSize: 9, fontWeight: '600', color: Colors.primary,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: 12, fontWeight: '500', color: Colors.textMuted,
    letterSpacing: 0.96, textTransform: 'uppercase',
  },
  metaDuration: {
    fontSize: 13, color: Colors.textMuted, fontVariant: ['tabular-nums'],
  },
  focusName: {
    fontSize: 28, fontWeight: '700', color: Colors.textPrimary,
    letterSpacing: -0.7, marginBottom: 4,
  },
  subtitle: {
    fontSize: 14, fontStyle: 'italic', color: Colors.primary,
    letterSpacing: -0.1, marginBottom: 16,
  },
  progressTrack: {
    height: 4, backgroundColor: Colors.surfaceBorder,
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: {
    height: 4, backgroundColor: Colors.primary, borderRadius: 2,
  },

  // Divider
  divider: {
    height: 1, backgroundColor: Colors.surfaceBorder,
  },

  // Drill rows
  drillRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 24,
  },
  drillRowBorder: {
    borderBottomWidth: 1, borderBottomColor: Colors.hairline,
  },
  circle: {
    width: 28, height: 28, borderRadius: 14, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.surfaceBorder,
  },
  circleDone: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  drillName: {
    flex: 1,
    fontSize: 15, fontWeight: '500', color: Colors.textPrimary, letterSpacing: -0.2,
  },
  drillNameDone: {
    color: Colors.textMuted, textDecorationLine: 'line-through',
  },
  drillDuration: {
    fontSize: 13, color: Colors.textMuted, fontVariant: ['tabular-nums'],
  },

  // Rest / empty
  restWrap: {
    padding: 32, alignItems: 'center',
  },
  restTitle: {
    fontSize: 20, fontWeight: '300', color: Colors.textPrimary, marginBottom: 8,
  },
  restBody: {
    fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20,
  },
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  emptyTitle: {
    fontSize: 18, fontWeight: '300', color: Colors.textPrimary, marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20,
  },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },
  startBtn: {
    backgroundColor: Colors.buttonDark,
    height: 56, borderRadius: 28,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  startBtnText: {
    fontSize: 15, fontWeight: '700', color: Colors.buttonDarkText, letterSpacing: -0.2,
  },
});
