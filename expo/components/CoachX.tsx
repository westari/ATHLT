import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Send } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function CoachX() {
  const insets = useSafeAreaInsets();
  const { profile, plan } = usePlanStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isOpen && messages.length === 0 && profile) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isOpen, messages.length, profile]);

  if (!profile) return null;

  const openChat = () => {
    setIsOpen(true);
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "What's up? I'm Coach X. Ask me anything about your training, drills, or game. I know your profile and your plan \u2014 let's work.",
      }]);
    }
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const closeChat = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setIsOpen(false));
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText.trim();
    setInputText('');

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await fetch('https://collectiq-xi.vercel.app/api/coach-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          profile: profile,
          plan: plan ? { weekTitle: plan.weekTitle, aiInsight: plan.aiInsight } : null,
          chatHistory: newMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();

      if (response.ok && data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "My bad, I'm having trouble right now. Try again in a sec." }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Can't connect right now. Check your connection and try again." }]);
    }

    setIsLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <>
      {!isOpen && (
        <Animated.View style={[s.fabWrap, { transform: [{ scale: pulseAnim }], bottom: 95 + insets.bottom }]}>
         <TouchableOpacity style={s.fab} onPress={openChat} activeOpacity={0.85}>
            <View style={s.fabInner}><Text style={s.fabText}>X</Text></View>
          </TouchableOpacity>
                   </Animated.View>
      )}

      {isOpen && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeChat} activeOpacity={1} />
          </Animated.View>

          <Animated.View style={[s.chatPanel, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
              <View style={s.chatHeader}>
                <Image source={require('@/assets/images/coach-x.png')} style={s.chatAvatar} resizeMode="cover" />
                <View style={s.chatHeaderInfo}>
                  <Text style={s.chatHeaderName}>Coach X</Text>
                  <Text style={s.chatHeaderStatus}>Your AI Training Coach</Text>
                </View>
                <TouchableOpacity onPress={closeChat} style={s.chatClose} activeOpacity={0.7}>
                  <X size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {messages.length <= 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.quickActions} contentContainerStyle={s.quickActionsContent}>
                  {[
                    "What should I work on today?",
                    "Explain my training plan",
                    "I only have 20 minutes",
                    "How do I improve my left hand?",
                    "My ankle is sore",
                  ].map((q, i) => (
                    <TouchableOpacity key={i} style={s.quickAction} onPress={() => { setInputText(q); }} activeOpacity={0.7}>
                      <Text style={s.quickActionText}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <ScrollView
                ref={scrollRef}
                style={s.messageList}
                contentContainerStyle={s.messageListContent}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              >
                {messages.map((msg, i) => (
                  <View key={i} style={[s.messageBubble, msg.role === 'user' ? s.userBubble : s.coachBubble]}>
                    {msg.role === 'assistant' && (
                      <Image source={require('@/assets/images/coach-x.png')} style={s.msgAvatar} resizeMode="cover" />
                    )}
                    <View style={[s.msgContent, msg.role === 'user' ? s.userContent : s.coachContent]}>
                      <Text style={[s.msgText, msg.role === 'user' ? s.userText : s.coachText]}>{msg.content}</Text>
                    </View>
                  </View>
                ))}
                {isLoading && (
                  <View style={[s.messageBubble, s.coachBubble]}>
                    <Image source={require('@/assets/images/coach-x.png')} style={s.msgAvatar} resizeMode="cover" />
                    <View style={[s.msgContent, s.coachContent]}>
                      <Text style={s.coachText}>...</Text>
                    </View>
                  </View>
                )}
              </ScrollView>

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
                  style={[s.sendBtn, (!inputText.trim() || isLoading) && s.sendBtnDisabled]}
                  onPress={sendMessage}
                  disabled={!inputText.trim() || isLoading}
                  activeOpacity={0.85}
                >
                  <Send size={18} color={inputText.trim() && !isLoading ? Colors.black : Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  fabWrap: { position: 'absolute', right: 20, zIndex: 999 },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  fabImage: { width: 48, height: 48, borderRadius: 24 },
fabInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1A1708', alignItems: 'center', justifyContent: 'center' },
  fabText: { fontSize: 26, fontWeight: '900', color: Colors.primary, letterSpacing: -1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  chatPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SCREEN_HEIGHT * 0.75,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: Colors.surfaceBorder, borderBottomWidth: 0,
  },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  chatAvatar: { width: 40, height: 40, borderRadius: 20 },
  chatHeaderInfo: { flex: 1 },
  chatHeaderName: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  chatHeaderStatus: { fontSize: 12, color: Colors.textMuted },
  chatClose: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  quickActions: { maxHeight: 50, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder },
  quickActionsContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  quickAction: {
    backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
  },
  quickActionText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  messageList: { flex: 1 },
  messageListContent: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  messageBubble: { flexDirection: 'row', gap: 8, maxWidth: '85%' },
  userBubble: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  coachBubble: { alignSelf: 'flex-start' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, marginTop: 4 },
  msgContent: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '90%' },
  userContent: { backgroundColor: Colors.primary },
  coachContent: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder },
  msgText: { fontSize: 14, lineHeight: 20 },
  userText: { color: Colors.black, fontWeight: '500' },
  coachText: { color: Colors.textPrimary },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  input: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 24,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: 18, paddingVertical: 12,
    fontSize: 14, color: Colors.textPrimary,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.surface },
});