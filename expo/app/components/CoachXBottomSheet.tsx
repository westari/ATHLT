import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
  Modal,
  Pressable,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { supabase } from '@/constants/supabase';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CoachXBottomSheetProps {
  visible: boolean;
  onClose: () => void;
}

// Pull a smart memory-aware opening greeting based on the user's recent activity.
async function buildOpeningGreeting(): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return "What's good. I'm Coach X — your AI trainer. Sign in so I can pull up your training history.";
    }

    const [sessionsRes, skillsRes] = await Promise.all([
      supabase
        .from('sessions')
        .select('date, completed_drills_count, skills_worked, overall_feedback')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1),
      supabase
        .from('skill_state')
        .select('skill_category, current_level')
        .eq('user_id', user.id)
        .order('current_level', { ascending: true })
        .limit(1),
    ]);

    const lastSession = sessionsRes.data?.[0];
    const weakestSkill = skillsRes.data?.[0];

    const SKILL_LABELS: Record<string, string> = {
      ballHandling: 'ball handling', shooting: 'shooting', shotForm: 'shot form',
      finishing: 'finishing', weakHand: 'weak hand', defense: 'defense',
      iq: 'basketball IQ', athleticism: 'athleticism', creativity: 'creativity',
      touch: 'touch', courtVision: 'court vision', decisionMaking: 'decision making',
    };

    if (lastSession && weakestSkill) {
      const skillName = SKILL_LABELS[weakestSkill.skill_category] || weakestSkill.skill_category;
      const level = Number(weakestSkill.current_level).toFixed(1);
      return `What's good. Your ${skillName} is sitting at ${level}/10 — that's the lowest. We'll keep hammering it. What's on your mind?`;
    }

    if (weakestSkill) {
      const skillName = SKILL_LABELS[weakestSkill.skill_category] || weakestSkill.skill_category;
      const level = Number(weakestSkill.current_level).toFixed(1);
      return `What's good. ${skillName.charAt(0).toUpperCase() + skillName.slice(1)} is your weakest area at ${level}/10 — that's where we lock in. What's up?`;
    }

    return "What's good. I built your plan based on what you told me. Run a session and I'll start tracking everything. What you wanna ask?";
  } catch (e) {
    console.error('buildOpeningGreeting failed:', e);
    return "What's good. I'm Coach X — your AI trainer. Ask me anything about your game.";
  }
}

export default function CoachXBottomSheet({ visible, onClose }: CoachXBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('window').height;
  const sheetHeight = screenHeight * 0.7; // 70% of screen
  const { profile, plan } = usePlanStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  // Animate the sheet sliding up when it becomes visible
  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start();

      // Build opening greeting only on first open with empty messages
      if (messages.length === 0) {
        buildOpeningGreeting().then(greeting => {
          setMessages([{ role: 'assistant', content: greeting }]);
        });
      }
    } else {
      Animated.timing(slideAnim, {
        toValue: screenHeight,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMsg = inputText.trim();
    setInputText('');
    Keyboard.dismiss();

    const newMsgs: ChatMessage[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMsgs);
    setIsLoading(true);
    scrollToBottom();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || '';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch('https://collectiq-xi.vercel.app/api/coach-chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMsg,
          profile: profile,
          plan: plan ? { weekTitle: plan.weekTitle, aiInsight: plan.aiInsight } : null,
          chatHistory: newMsgs.slice(-10),
        }),
      });

      const data = await response.json();

      if (response.ok && data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "My bad, having trouble right now. Try again." }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Can't connect right now. Check your connection." }]);
    }

    setIsLoading(false);
    scrollToBottom();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dimmed background — tap to close */}
      <Pressable style={s.backdrop} onPress={onClose} />

      {/* Animated sheet */}
      <Animated.View
        style={[
          s.sheet,
          {
            height: sheetHeight,
            transform: [{ translateY: slideAnim }],
            paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
          },
        ]}
      >
        {/* Drag handle */}
        <View style={s.handleWrap}>
          <View style={s.handle} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <Image source={require('@/assets/images/coach-x-small.png')} style={s.headerAvatar} resizeMode="cover" />
          <View style={s.headerInfo}>
            <Text style={s.headerName}>Coach X</Text>
            <Text style={s.headerStatus}>Your AI Training Coach</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
            <X size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Quick replies (only shown before any user message) */}
        {messages.length <= 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.quickScroll}
            contentContainerStyle={s.quickContent}
          >
            {[
              "What should I work on?",
              "Explain my plan",
              "How's my left hand?",
              "What's my weakest skill?",
            ].map((q, i) => (
              <TouchableOpacity
                key={i}
                style={s.quickBtn}
                onPress={() => setInputText(q)}
                activeOpacity={0.7}
              >
                <Text style={s.quickTxt}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Messages + input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={20}
        >
          <ScrollView
            ref={scrollRef}
            style={s.messageList}
            contentContainerStyle={s.messageContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
          >
            {messages.map((msg, i) => (
              <View
                key={i}
                style={[s.msgRow, msg.role === 'user' ? s.msgRowUser : s.msgRowCoach]}
              >
                {msg.role === 'assistant' && (
                  <Image
                    source={require('@/assets/images/coach-x-small.png')}
                    style={s.msgAvatar}
                    resizeMode="cover"
                  />
                )}
                <View
                  style={[
                    s.msgBubble,
                    msg.role === 'user' ? s.msgBubbleUser : s.msgBubbleCoach,
                  ]}
                >
                  <Text
                    style={[
                      s.msgText,
                      msg.role === 'user' ? s.msgTextUser : s.msgTextCoach,
                    ]}
                  >
                    {msg.content}
                  </Text>
                </View>
              </View>
            ))}
            {isLoading && (
              <View style={[s.msgRow, s.msgRowCoach]}>
                <Image
                  source={require('@/assets/images/coach-x-small.png')}
                  style={s.msgAvatar}
                  resizeMode="cover"
                />
                <View style={[s.msgBubble, s.msgBubbleCoach]}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input bar */}
          <View style={s.inputBar}>
            <TextInput
              style={s.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask Coach X anything..."
              placeholderTextColor={Colors.textMuted}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
              multiline={false}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!inputText.trim() || isLoading) && s.sendBtnOff]}
              onPress={sendMessage}
              disabled={!inputText.trim() || isLoading}
              activeOpacity={0.85}
            >
              <Send
                size={18}
                color={inputText.trim() && !isLoading ? Colors.black : Colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceBorder,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  headerStatus: { fontSize: 12, color: Colors.textMuted },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  // Quick replies
  quickScroll: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  quickContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  quickBtn: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  quickTxt: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  // Messages
  messageList: { flex: 1 },
  messageContent: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  msgRow: { flexDirection: 'row', gap: 8, maxWidth: '88%' },
  msgRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  msgRowCoach: { alignSelf: 'flex-start' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, marginTop: 4 },
  msgBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '90%',
  },
  msgBubbleUser: { backgroundColor: Colors.primary },
  msgBubbleCoach: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextUser: { color: Colors.black, fontWeight: '500' },
  msgTextCoach: { color: Colors.textPrimary },
  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { backgroundColor: Colors.surface },
});
