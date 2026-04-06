import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Play, Flame, Clock, Target, Dumbbell, Zap, Wind, Activity } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { profile, plan, currentDayIndex, completedDrills, totalSessions, currentStreak, isGenerating } = usePlanStore();

  if (isGenerating) {
    return (
      <View style={[s.container, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={s.loadingText}>Coach X is building your plan...</Text>
      </View>
    );
  }

  if (!plan || !profile) {
    return (
      <View style={[s.container, s.center, { paddingTop: insets.top }]}>
        <Text style={s.emptyText}>Complete onboarding to start training.</Text>
      </View>
    );
  }

  var todayDay = plan.days[currentDayIndex];
  var todayDrills = todayDay?.drills || [];
  var totalMinutes = todayDrills.reduce(function(sum, d) { return sum + (d.duration || 5); }, 0);
  var doneCount = todayDrills.filter(function(_, i) { return completedDrills[currentDayIndex + '-' + i]; }).length;

  var firstName = (profile.name || 'Player').split(' ')[0];

  var handleStart = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/session');
  };

  var getDrillIcon = (type: string) => {
    switch (type) {
      case 'warmup': return Wind;
      case 'shooting': return Target;
      case 'skill': return Dumbbell;
      case 'conditioning': return Activity;
      default: return Zap;
    }
  };

  var getDrillColor = (type: string) => {
    switch (type) {
      case 'warmup': return '#8B9A6B';
      case 'shooting': return '#B08D57';
      case 'skill': return Colors.primary;
      case 'conditioning': return '#C47A6C';
      default: return Colors.textMuted;
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Greeting */}
        <View style={s.topRow}>
          <View>
            <Text style={s.greeting}>Hey {firstName}</Text>
            <Text style={s.date}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
          </View>
          <View style={s.streakBadge}>
            <Flame size={14} color="#C47A6C" />
            <Text style={s.streakNum}>{currentStreak}</Text>
          </View>
        </View>

        {/* Days strip */}
        <View style={s.daysStrip}>
          {plan.days.map(function(d, i) {
            var isToday = i === currentDayIndex;
            var dayDrills = d.drills || [];
            var dayDone = dayDrills.filter(function(_, di) { return completedDrills[i + '-' + di]; }).length;
            var isComplete = dayDrills.length > 0 && dayDone === dayDrills.length;

            return (
              <View key={i} style={s.dayCol}>
                <Text style={[s.dayLetter, isToday && s.dayLetterToday]}>{DAYS_SHORT[i]}</Text>
                <View style={[
                  s.dayDot,
                  isToday && s.dayDotToday,
                  isComplete && s.dayDotComplete,
                  d.isRest && s.dayDotRest,
                ]}>
                  {isComplete && <View style={s.dayDotInner} />}
                </View>
              </View>
            );
          })}
        </View>

        {/* Today's session card */}
        {todayDay?.isRest ? (
          <View style={s.restCard}>
            <Text style={s.restTitle}>REST DAY</Text>
            <Text style={s.restBody}>Recovery is part of the work. Get some sleep.</Text>
          </View>
        ) : (
          <View style={s.sessionCard}>
            <View style={s.sessionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.sessionLabel}>TODAY'S FOCUS</Text>
                <Text style={s.sessionFocus}>{todayDay?.focus || 'Training'}</Text>
              </View>
              <View style={s.sessionStats}>
                <View style={s.statRow}>
                  <Clock size={12} color={Colors.textMuted} />
                  <Text style={s.statTxt}>{totalMinutes}m</Text>
                </View>
                <View style={s.statRow}>
                  <Dumbbell size={12} color={Colors.textMuted} />
                  <Text style={s.statTxt}>{todayDrills.length}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={s.startBtn} onPress={handleStart} activeOpacity={0.85}>
              <Play size={16} color={Colors.black} fill={Colors.black} />
              <Text style={s.startTxt}>{doneCount > 0 ? 'CONTINUE SESSION' : 'START SESSION'}</Text>
              {doneCount > 0 && <Text style={s.startProgress}>{doneCount}/{todayDrills.length}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Drill list - compact */}
        {!todayDay?.isRest && (
          <View style={s.drillList}>
            {todayDrills.map(function(drill, i) {
              var done = completedDrills[currentDayIndex + '-' + i];
              var Icon = getDrillIcon(drill.type);
              var color = getDrillColor(drill.type);

              return (
                <View key={i} style={[s.drillRow, done && s.drillRowDone]}>
                  <View style={[s.drillIcon, { backgroundColor: color + '20', borderColor: color }]}>
                    <Icon size={14} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.drillName, done && s.drillNameDone]} numberOfLines={1}>{drill.name}</Text>
                    <Text style={s.drillMeta}>{drill.duration || 5}min · {drill.sets || ''}{drill.sets && drill.reps ? ' × ' : ''}{drill.reps || ''}</Text>
                  </View>
                  {done && <View style={s.checkmark}><Text style={s.checkTxt}>✓</Text></View>}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, color: Colors.textSecondary, fontSize: 14 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20 },

  // Top greeting row
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  greeting: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  date: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1A1210', borderRadius: 12, borderWidth: 1, borderColor: '#3A2018',
    paddingHorizontal: 10, paddingVertical: 6,
  },
  streakNum: { fontSize: 13, fontWeight: '800', color: '#C47A6C' },

  // Days strip
  daysStrip: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },
  dayCol: { alignItems: 'center', gap: 6, flex: 1 },
  dayLetter: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  dayLetterToday: { color: Colors.primary },
  dayDot: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  dayDotToday: { borderColor: Colors.primary, borderWidth: 2 },
  dayDotComplete: { backgroundColor: '#8B9A6B', borderColor: '#8B9A6B' },
  dayDotRest: { borderColor: '#2A2A2A', borderStyle: 'dashed' },
  dayDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.black },

  // Session card
  sessionCard: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16, marginBottom: 14,
  },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sessionLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 4 },
  sessionFocus: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  sessionStats: { gap: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statTxt: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13,
  },
  startTxt: { fontSize: 14, fontWeight: '800', color: Colors.black, letterSpacing: 0.5 },
  startProgress: { fontSize: 12, fontWeight: '700', color: '#000', opacity: 0.6, marginLeft: 4 },

  // Rest card
  restCard: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 20, alignItems: 'center', marginBottom: 14,
  },
  restTitle: { fontSize: 13, fontWeight: '800', color: Colors.primary, letterSpacing: 1.5, marginBottom: 6 },
  restBody: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },

  // Drill list
  drillList: { gap: 8 },
  drillRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  drillRowDone: { opacity: 0.5 },
  drillIcon: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  drillName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  drillNameDone: { textDecorationLine: 'line-through' },
  drillMeta: { fontSize: 11, color: Colors.textMuted },
  checkmark: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#8B9A6B',
    alignItems: 'center', justifyContent: 'center',
  },
  checkTxt: { fontSize: 12, fontWeight: '900', color: Colors.black },
});
