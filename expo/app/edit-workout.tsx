import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView,
  TextInput, KeyboardAvoidingView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft, Plus, Trash2, GripVertical, Send, Sparkles,
  Check, X, RotateCcw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';

type EditMode = 'manual' | 'coachx';

type ChatMessage = {
  id: string;
  role: 'user' | 'coach';
  text: string;
  proposedDrills?: any[];
  status?: 'pending' | 'applied' | 'rejected';
};

export default function EditWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, currentDayIndex, updateDayDrills } = usePlanStore();

  const [mode, setMode] = useState<EditMode>('manual');

  const day = plan?.days?.[currentDayIndex];
  const initialDrills = useMemo(
    () => (day?.drills || []).map(d => resolvePlanDrill(d)).filter(Boolean) as NonNullable<ReturnType<typeof resolvePlanDrill>>[],
    [day]
  );

  // Local editable copy of drills (for manual edits)
  const [editedDrills, setEditedDrills] = useState(initialDrills);

  // Chat state for Coach X mode
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'coach',
      text: `Tell me what you want changed about today's ${day?.focus || 'workout'}. I'll rebuild it for you.`,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  if (!plan || !day) return null;

  const onBack = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const onToggleMode = (next: EditMode) => {
    if (next === mode) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode(next);
  };

  // ===== MANUAL MODE HANDLERS =====
  const onRemoveDrill = (idx: number) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditedDrills(prev => prev.filter((_, i) => i !== idx));
  };

  const onAddDrill = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Coming soon', 'Drill picker will be added when the library screen gets add-to-workout support.');
  };

  const onSaveManual = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateDayDrills(currentDayIndex, editedDrills);
    router.back();
  };

  // ===== COACH X MODE HANDLERS =====
  const onSendChat = async () => {
    const text = chatInput.trim();
    if (!text || isThinking) return;

    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: ChatMessage = {
      id: Date.now() + '-u',
      role: 'user',
      text,
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsThinking(true);

    try {
      const res = await fetch('https://www.tryparlai.com/api/coach-x-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentWorkout: {
            focus: day.focus,
            duration: day.duration,
            drills: editedDrills.map(d => ({ name: d.name, time: d.time, id: d.id })),
          },
          dayContext: {
            dayIndex: currentDayIndex,
            totalDays: plan.days.length,
            isRest: day.isRest,
          },
          userRequest: text,
          recentMessages: chatMessages.slice(-6),
        }),
      });

      if (!res.ok) throw new Error('Edit request failed');
      const data = await res.json();

      const coachMsg: ChatMessage = {
        id: Date.now() + '-c',
        role: 'coach',
        text: data.message || 'Here is the updated workout.',
        proposedDrills: data.proposedDrills,
        status: 'pending',
      };
      setChatMessages(prev => [...prev, coachMsg]);
    } catch (err) {
      console.warn('coach-x-edit error', err);
      const errMsg: ChatMessage = {
        id: Date.now() + '-e',
        role: 'coach',
        text: "Couldn't reach Coach X right now. Try again in a sec.",
      };
      setChatMessages(prev => [...prev, errMsg]);
    } finally {
      setIsThinking(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const onApplyProposed = (msgId: string, proposedDrills: any[]) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const resolved = proposedDrills
      .map(d => resolvePlanDrill(d))
      .filter(Boolean) as NonNullable<ReturnType<typeof resolvePlanDrill>>[];
    setEditedDrills(resolved);
    setChatMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, status: 'applied' as const } : m
    ));
    updateDayDrills(currentDayIndex, resolved);
  };

  const onRejectProposed = (msgId: string) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChatMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, status: 'rejected' as const } : m
    ));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Edit Workout</Text>
          <Text style={styles.headerSub}>{day.focus} · {day.duration}</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* Toggle at top — Manual / Coach X */}
      <View style={styles.toggleWrap}>
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'manual' && styles.toggleBtnActive]}
            onPress={() => onToggleMode('manual')}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, mode === 'manual' && styles.toggleTextActive]}>
              Manual
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'coachx' && styles.toggleBtnActive]}
            onPress={() => onToggleMode('coachx')}
            activeOpacity={0.8}
          >
            <Sparkles
              size={13}
              color={mode === 'coachx' ? Colors.white : Colors.textMuted}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.toggleText, mode === 'coachx' && styles.toggleTextActive]}>
              Ask Coach X
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {mode === 'manual' ? (
        // ===== MANUAL EDIT VIEW =====
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 8 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>DRILLS</Text>

            {editedDrills.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No drills yet</Text>
                <Text style={styles.emptyHint}>Tap "Add drill" below to start building.</Text>
              </View>
            ) : (
              editedDrills.map((d, i) => (
                <View key={d.id + '-' + i} style={styles.drillCard}>
                  <GripVertical size={16} color={Colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.drillCardName} numberOfLines={1}>{d.name}</Text>
                    <Text style={styles.drillCardTime}>{d.time}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onRemoveDrill(i)}
                    style={styles.removeBtn}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))
            )}

            <TouchableOpacity style={styles.addDrillBtn} onPress={onAddDrill} activeOpacity={0.8}>
              <Plus size={16} color={Colors.primary} />
              <Text style={styles.addDrillTxt}>Add drill</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity style={styles.saveBtn} onPress={onSaveManual} activeOpacity={0.85}>
              <Text style={styles.saveBtnTxt}>Save workout</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // ===== COACH X CHAT VIEW =====
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {/* Suggestion chips */}
            <View style={styles.suggestionRow}>
              {[
                'No hoop today',
                'Shorter, 30 min',
                'More ball handling',
                'Harder',
              ].map(s => (
                <TouchableOpacity
                  key={s}
                  style={styles.suggestionChip}
                  onPress={() => setChatInput(s)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionChipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {chatMessages.map(msg => (
              <View key={msg.id}>
                <View
                  style={[
                    styles.msgBubble,
                    msg.role === 'user' ? styles.msgUser : styles.msgCoach,
                  ]}
                >
                  <Text
                    style={[
                      styles.msgText,
                      msg.role === 'user' ? styles.msgTextUser : styles.msgTextCoach,
                    ]}
                  >
                    {msg.text}
                  </Text>
                </View>

                {/* Proposed changes card */}
                {msg.proposedDrills && msg.proposedDrills.length > 0 && (
                  <View style={styles.proposedCard}>
                    <View style={styles.proposedHeader}>
                      <Sparkles size={14} color={Colors.primary} />
                      <Text style={styles.proposedHeaderText}>PROPOSED WORKOUT</Text>
                    </View>

                    <View style={styles.proposedList}>
                      {msg.proposedDrills.map((d: any, i: number) => (
                        <View key={i} style={styles.proposedRow}>
                          <Text style={styles.proposedDrillName} numberOfLines={1}>
                            {d.name}
                          </Text>
                          <Text style={styles.proposedDrillTime}>{d.time}</Text>
                        </View>
                      ))}
                    </View>

                    {msg.status === 'pending' && (
                      <View style={styles.proposedActions}>
                        <TouchableOpacity
                          style={styles.tryAgainBtn}
                          onPress={() => onRejectProposed(msg.id)}
                          activeOpacity={0.8}
                        >
                          <RotateCcw size={14} color={Colors.textMuted} />
                          <Text style={styles.tryAgainTxt}>Try again</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.applyBtn}
                          onPress={() => onApplyProposed(msg.id, msg.proposedDrills!)}
                          activeOpacity={0.85}
                        >
                          <Check size={14} color={Colors.white} strokeWidth={3} />
                          <Text style={styles.applyTxt}>Apply</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {msg.status === 'applied' && (
                      <View style={styles.statusBanner}>
                        <Check size={14} color={Colors.primary} strokeWidth={3} />
                        <Text style={styles.statusBannerText}>Applied to today's workout</Text>
                      </View>
                    )}

                    {msg.status === 'rejected' && (
                      <View style={styles.statusBanner}>
                        <X size={14} color={Colors.textMuted} strokeWidth={3} />
                        <Text style={[styles.statusBannerText, { color: Colors.textMuted }]}>
                          Discarded — tell me what to change
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}

            {isThinking && (
              <View style={[styles.msgBubble, styles.msgCoach, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={[styles.msgText, styles.msgTextCoach]}>Coach X is thinking...</Text>
              </View>
            )}
          </ScrollView>

          <View style={[styles.chatInputBar, { paddingBottom: insets.bottom + 8 }]}>
            <TextInput
              style={styles.chatInput}
              placeholder="Tell Coach X what to change..."
              placeholderTextColor={Colors.textMuted}
              value={chatInput}
              onChangeText={setChatInput}
              multiline
              maxLength={300}
              editable={!isThinking}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!chatInput.trim() || isThinking) && { opacity: 0.4 }]}
              onPress={onSendChat}
              disabled={!chatInput.trim() || isThinking}
              activeOpacity={0.85}
            >
              <Send size={16} color={Colors.white} fill={Colors.white} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerBtn: {
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

  // Toggle
  toggleWrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 100,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 100,
  },
  toggleBtnActive: {
    backgroundColor: '#1A1A1A',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: -0.1,
  },
  toggleTextActive: {
    color: Colors.white,
  },

  // Manual edit
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginTop: 4,
    marginBottom: 12,
  },
  drillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  drillCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  drillCardTime: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  removeBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDrillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    borderStyle: 'dashed',
  },
  addDrillTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyHint: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
  },
  saveBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },

  // Coach X chat
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  msgBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  msgUser: {
    backgroundColor: '#1A1A1A',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  msgCoach: {
    backgroundColor: Colors.surface,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
  },
  msgTextUser: {
    color: Colors.white,
  },
  msgTextCoach: {
    color: Colors.textPrimary,
  },

  // Proposed card
  proposedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  proposedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  proposedHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.2,
  },
  proposedList: {
    gap: 6,
    marginBottom: 12,
  },
  proposedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  proposedDrillName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginRight: 8,
  },
  proposedDrillTime: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  proposedActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  tryAgainBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    backgroundColor: 'transparent',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  tryAgainTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  applyBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 100,
  },
  applyTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  statusBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Chat input
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
  },
  chatInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: 22,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
