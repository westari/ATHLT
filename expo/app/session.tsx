import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Animated,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, ChevronRight, ChevronLeft, Play, Pause, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { logDrillResult, logSession } from '@/lib/memorySync';

const TYPE_TO_SKILL_FALLBACK: Record<string, string> = {
  warmup: 'athleticism',
  shooting: 'shooting',
  skill: 'ballHandling',
  conditioning: 'athleticism',
};

export default function SessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { plan, completedDrills, toggleDrill, markDrillComplete, completeSession, currentDayIndex } = usePlanStore();

  const dayIndex = currentDayIndex;
  const currentDay = plan?.days?.[dayIndex];
  const drills = currentDay?.drills || [];

  const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [completedInSession, setCompletedInSession] = useState<Record<number, boolean>>({});

  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [pendingDrillIndex, setPendingDrillIndex] = useState<number | null>(null);
  const [skillsWorkedInSession, setSkillsWorkedInSession] = useState<Set<string>>(new Set());
  const [sessionStartTime] = useState<number>(Date.now());

  const timerRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const currentDrill = drills[currentDrillIndex];

  const parseDrillTime = (timeStr: string): number => {
    const match = timeStr?.match(/(\d+)/);
    if (match) return parseInt(match[1]) * 60;
    return 300;
  };

  const getSkillForDrill = (drill: any): string => {
    if (drill?.primarySkill) return drill.primarySkill;
    return TYPE_TO_SKILL_FALLBACK[drill?.type] || 'athleticism';
  };

  useEffect(() => {
    if (currentDrill) {
      setTimeRemaining(parseDrillTime(currentDrill.time));
      setIsTimerRunning(false);
    }
  }, [currentDrillIndex]);

  useEffect(() => {
    if (isTimerRunning && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsTimerRunning(false);
            if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTimerRunning]);

  useEffect(() => {
    if (isTimerRunning) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isTimerRunning]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins + ':' + secs.toString().padStart(2, '0');
  };

  const handleStartPause = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsTimerRunning(!isTimerRunning);
  };

  const handleCompleteDrill = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    clearInterval(timerRef.current);
    setIsTimerRunning(false);
    setPendingDrillIndex(currentDrillIndex);
    setFeedbackModalVisible(true);
  };

  const handleFeedbackSelected = async (feedback: 'too_easy' | 'right' | 'too_hard') => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const idx = pendingDrillIndex;
    setFeedbackModalVisible(false);
    setPendingDrillIndex(null);

    if (idx === null) return;

    const drill = drills[idx];
    const skill = getSkillForDrill(drill);

    setCompletedInSession(prev => ({ ...prev, [idx]: true }));
    // Use markDrillComplete to avoid toggle-off if already complete (prevents dup logs)
    markDrillComplete(dayIndex, idx);

    setSkillsWorkedInSession(prev => {
      const next = new Set(prev);
      next.add(skill);
      return next;
    });

    if (drill?.drillId) {
      logDrillResult({
        drillId: drill.drillId,
        primarySkill: skill,
        userFeedback: feedback,
      }).catch(e => console.error('logDrillResult failed:', e));
    }

    if (idx < drills.length - 1) {
      setCurrentDrillIndex(idx + 1);
    } else {
      const durationMin = Math.round((Date.now() - sessionStartTime) / 60000);
      const completedCount = Object.keys(completedInSession).length + 1;
      const skillsArray = Array.from(skillsWorkedInSession);
      skillsArray.push(skill);
      logSession({
        dayIndex,
        completedDrillsCount: completedCount,
        durationMinutes: durationMin,
        skillsWorked: Array.from(new Set(skillsArray)),
      }).catch(e => console.error('logSession failed:', e));

      // Actually increment the local streak + total sessions
      completeSession({
        date: new Date().toISOString(),
        focus: currentDay?.focus || '',
        duration: currentDay?.duration || '',
        drillsCompleted: completedCount,
        drillsTotal: drills.length,
      });

      setSessionComplete(true);
    }
  };

  const handleSkipDrill = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearInterval(timerRef.current);
    setIsTimerRunning(false);
    if (currentDrillIndex < drills.length - 1) {
      setCurrentDrillIndex(currentDrillIndex + 1);
    } else {
      // Session ended via skip — still count it
      const completedCount = Object.keys(completedInSession).length;
      if (completedCount > 0) {
        completeSession({
          date: new Date().toISOString(),
          focus: currentDay?.focus || '',
          duration: currentDay?.duration || '',
          drillsCompleted: completedCount,
          drillsTotal: drills.length,
        });
      }
      setSessionComplete(true);
    }
  };

  const handlePrevDrill = () => {
    if (currentDrillIndex > 0) {
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      clearInterval(timerRef.current);
      setIsTimerRunning(false);
      setCurrentDrillIndex(currentDrillIndex - 1);
    }
  };

  const handleClose = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearInterval(timerRef.current);
    router.back();
  };

  const handleResetTimer = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearInterval(timerRef.current);
    setIsTimerRunning(false);
    if (currentDrill) setTimeRemaining(parseDrillTime(currentDrill.time));
  };

  // Drill type badge colors — tuned for light theme
  const TC: Record<string, string> = {
    warmup: '#6F8A4B', // olive green
    skill: Colors.primary,
    shooting: '#A8733A', // bronze
    conditioning: '#B8503C', // brick
  };
  const TL: Record<string, string> = {
    warmup: 'WARMUP', skill: 'SKILL WORK', shooting: 'SHOOTING', conditioning: 'CONDITIONING',
  };

  if (sessionComplete) {
    const cc = Object.keys(completedInSession).length;
    return (
      <View style={[s.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.doneScreen}>
          <View style={s.doneCircle}><Check size={48} color={Colors.black} /></View>
          <Text style={s.doneTitle}>Session Complete!</Text>
          <Text style={s.doneSub}>You crushed {cc} out of {drills.length} drills.</Text>
          <View style={s.doneStats}>
            <View style={s.doneStat}>
              <Text style={s.doneVal}>{cc}/{drills.length}</Text>
              <Text style={s.doneLbl}>Drills</Text>
            </View>
            <View style={s.doneDiv} />
            <View style={s.doneStat}>
              <Text style={s.doneVal}>{currentDay?.duration || '—'}</Text>
              <Text style={s.doneLbl}>Duration</Text>
            </View>
          </View>
          <Text style={s.doneMot}>Consistency beats intensity. Show up again tomorrow.</Text>
          <TouchableOpacity style={s.doneBtn} onPress={handleClose} activeOpacity={0.85}>
            <Text style={s.doneBtnTxt}>DONE</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!currentDrill || drills.length === 0) {
    return (
      <View style={[s.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.doneScreen}>
          <Text style={s.doneTitle}>No drills for this day</Text>
          <Text style={s.doneSub}>This might be a rest day.</Text>
          <TouchableOpacity style={s.doneBtn} onPress={handleClose} activeOpacity={0.85}>
            <Text style={s.doneBtnTxt}>GO BACK</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const tc = TC[currentDrill.type] || Colors.textMuted;
  const tl = TL[currentDrill.type] || '';
  const tt = parseDrillTime(currentDrill.time);
  const dp = tt > 0 ? ((tt - timeRemaining) / tt) : 0;

  return (
    <View style={[s.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={handleClose} style={s.closeBtn} activeOpacity={0.7}>
          <X size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <View style={s.headerMid}>
          <Text style={s.headerFocus}>{currentDay?.focus || 'Session'}</Text>
          <Text style={s.headerProg}>Drill {currentDrillIndex + 1} of {drills.length}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={s.oTrack}>
        <View style={[s.oFill, { width: ((currentDrillIndex + 1) / drills.length * 100) + '%' }]} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={[s.tag, { backgroundColor: tc + '20', borderColor: tc + '60' }]}>
          <Text style={[s.tagTxt, { color: tc }]}>{tl}</Text>
        </View>
        <Text style={s.drillName}>{currentDrill.name}</Text>

        <Animated.View style={[s.timerWrap, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[s.timerCircle, isTimerRunning && { borderColor: tc }]}>
            <Text style={[s.timerTxt, isTimerRunning && { color: tc }]}>{formatTime(timeRemaining)}</Text>
            <Text style={s.timerLbl}>
              {timeRemaining === 0 ? 'DONE!' : isTimerRunning ? 'RUNNING' : 'READY'}
            </Text>
          </View>
        </Animated.View>

        <View style={s.dpTrack}>
          <View style={[s.dpFill, { width: (dp * 100) + '%', backgroundColor: tc }]} />
        </View>

        <View style={s.controls}>
          <TouchableOpacity onPress={handleResetTimer} style={s.ctrlBtn} activeOpacity={0.7}>
            <Text style={s.ctrlTxt}>RESET</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleStartPause} style={[s.playBtn, { backgroundColor: tc }]} activeOpacity={0.85}>
            {isTimerRunning ? <Pause size={28} color={Colors.white} /> : <Play size={28} color={Colors.white} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkipDrill} style={s.ctrlBtn} activeOpacity={0.7}>
            <Text style={s.ctrlTxt}>SKIP</Text>
          </TouchableOpacity>
        </View>

        {currentDrill.detail ? (
          <View style={s.detailCard}>
            <Text style={s.detailTitle}>INSTRUCTIONS</Text>
            <Text style={s.detailBody}>{currentDrill.detail}</Text>
          </View>
        ) : null}

        <View style={s.listCard}>
          <Text style={s.listTitle}>SESSION DRILLS</Text>
          {drills.map((d, i) => {
            const done = completedInSession[i] || completedDrills[dayIndex + '-' + i];
            const curr = i === currentDrillIndex;
            const dc = TC[d.type] || Colors.textMuted;
            return (
              <TouchableOpacity
                key={i}
                style={[s.listItem, curr && s.listItemCurr]}
                onPress={() => { clearInterval(timerRef.current); setIsTimerRunning(false); setCurrentDrillIndex(i); }}
                activeOpacity={0.7}
              >
                <View style={[s.listDot, done && { backgroundColor: dc, borderColor: dc }, curr && { borderColor: dc, borderWidth: 2.5 }]}>
                  {done && <Text style={{ fontSize: 9, color: Colors.white, fontWeight: '800' }}>✓</Text>}
                </View>
                <Text
                  style={[
                    s.listName,
                    done && { textDecorationLine: 'line-through', color: Colors.textMuted },
                    curr && { color: Colors.textPrimary },
                  ]}
                  numberOfLines={1}
                >
                  {d.name}
                </Text>
                <Text style={s.listTime}>{d.time}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={[s.bottom, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}>
        <View style={s.navRow}>
          <TouchableOpacity
            onPress={handlePrevDrill}
            style={[s.navBtn, currentDrillIndex === 0 && { opacity: 0.3 }]}
            disabled={currentDrillIndex === 0}
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.compBtn, { backgroundColor: tc }]}
            onPress={handleCompleteDrill}
            activeOpacity={0.85}
          >
            <Check size={18} color={Colors.white} />
            <Text style={s.compTxt}>
              {currentDrillIndex === drills.length - 1 ? 'FINISH SESSION' : 'COMPLETE & NEXT'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkipDrill} style={s.navBtn} activeOpacity={0.7}>
            <ChevronRight size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* FEEDBACK MODAL */}
      <Modal
        visible={feedbackModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFeedbackModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>How was that?</Text>
            <Text style={s.modalSub}>This helps Coach X tune your next session.</Text>

            <TouchableOpacity
              style={[s.fbBtn, { borderColor: Colors.success, backgroundColor: '#E8F2EB' }]}
              onPress={() => handleFeedbackSelected('too_easy')}
              activeOpacity={0.7}
            >
              <Text style={[s.fbTxt, { color: Colors.success }]}>TOO EASY</Text>
              <Text style={s.fbDesc}>I could have done more</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.fbBtn, { borderColor: Colors.primary, backgroundColor: '#FBF5E2' }]}
              onPress={() => handleFeedbackSelected('right')}
              activeOpacity={0.7}
            >
              <Text style={[s.fbTxt, { color: Colors.primary }]}>JUST RIGHT</Text>
              <Text style={s.fbDesc}>Felt challenging but doable</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.fbBtn, { borderColor: Colors.danger, backgroundColor: '#FBE9E9' }]}
              onPress={() => handleFeedbackSelected('too_hard')}
              activeOpacity={0.7}
            >
              <Text style={[s.fbTxt, { color: Colors.danger }]}>TOO HARD</Text>
              <Text style={s.fbDesc}>I struggled with this one</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  headerMid: { flex: 1, alignItems: 'center' },
  headerFocus: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  headerProg: { fontSize: 12, color: Colors.textMuted },
  oTrack: { height: 3, backgroundColor: Colors.surfaceBorder, marginHorizontal: 20 },
  oFill: { height: 3, backgroundColor: Colors.primary },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 120 },
  tag: {
    alignSelf: 'center', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6,
    marginBottom: 12, borderWidth: 1,
  },
  tagTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  drillName: {
    fontSize: 24, fontWeight: '800', color: Colors.textPrimary,
    textAlign: 'center', lineHeight: 32, marginBottom: 28,
  },
  timerWrap: { alignItems: 'center', marginBottom: 24 },
  timerCircle: {
    width: 180, height: 180, borderRadius: 90, borderWidth: 4,
    borderColor: Colors.surfaceBorder, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  timerTxt: { fontSize: 42, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  timerLbl: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5 },
  dpTrack: {
    height: 4, backgroundColor: Colors.surfaceBorder, borderRadius: 2,
    marginBottom: 24, overflow: 'hidden',
  },
  dpFill: { height: 4, borderRadius: 2 },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 24, marginBottom: 32,
  },
  ctrlBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  ctrlTxt: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1 },
  playBtn: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
  },
  detailCard: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 20, marginBottom: 20,
  },
  detailTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 10,
  },
  detailBody: { fontSize: 15, color: Colors.textSecondary, lineHeight: 23 },
  listCard: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 20,
  },
  listTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 14,
  },
  listItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  listItemCurr: {
    backgroundColor: '#FBF5E2',
    marginHorizontal: -12, paddingHorizontal: 12, borderRadius: 8,
  },
  listDot: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  listName: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary, flex: 1 },
  listTime: { fontSize: 11, color: Colors.textMuted },
  bottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 16, backgroundColor: Colors.background,
    borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  compBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 18,
  },
  compTxt: { fontSize: 13, fontWeight: '900', color: Colors.white, letterSpacing: 1.5 },
  doneScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  doneCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  doneTitle: {
    fontSize: 28, fontWeight: '800', color: Colors.textPrimary,
    marginBottom: 12, textAlign: 'center',
  },
  doneSub: {
    fontSize: 16, color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 24, marginBottom: 32,
  },
  doneStats: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 20, marginBottom: 24, alignItems: 'center', width: '100%',
  },
  doneStat: { flex: 1, alignItems: 'center' },
  doneVal: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  doneLbl: { fontSize: 11, color: Colors.textMuted },
  doneDiv: { width: 1, height: 30, backgroundColor: Colors.surfaceBorder },
  doneMot: {
    fontSize: 15, fontWeight: '600', color: Colors.primary,
    textAlign: 'center', fontStyle: 'italic', lineHeight: 22, marginBottom: 32,
  },
  doneBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 20, paddingHorizontal: 48, alignItems: 'center',
  },
  doneBtnTxt: { fontSize: 15, fontWeight: '900', color: Colors.black, letterSpacing: 2 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 24,
  },
  modalTitle: {
    fontSize: 22, fontWeight: '800', color: Colors.textPrimary,
    textAlign: 'center', marginBottom: 6,
  },
  modalSub: {
    fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginBottom: 20,
  },
  fbBtn: {
    borderRadius: 14, borderWidth: 2,
    paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center',
    marginBottom: 10,
  },
  fbTxt: { fontSize: 14, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
  fbDesc: { fontSize: 12, color: Colors.textSecondary },
});
