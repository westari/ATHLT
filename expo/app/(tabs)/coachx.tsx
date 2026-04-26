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
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, Film, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { supabase } from '@/constants/supabase';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'film-result';
  filmData?: any;
}

// Pull a smart opening greeting based on the user's recent activity.
// Falls back to a default if there's no memory yet (e.g., new user).
async function buildOpeningGreeting(): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return "What's good. I'm Coach X — your AI trainer. Sign in so I can pull up your training history.";
    }

    // Pull last session + weakest skill in parallel
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

    // Best case: we have both session history AND skill data
    if (lastSession && weakestSkill) {
      const skillName = SKILL_LABELS[weakestSkill.skill_category] || weakestSkill.skill_category;
      const level = Number(weakestSkill.current_level).toFixed(1);
      return `What's good. I just pulled up your training history — your ${skillName} is sitting at ${level}/10, that's the lowest. We'll keep hammering it. What's on your mind?`;
    }

    // Have skill data but no session history yet
    if (weakestSkill) {
      const skillName = SKILL_LABELS[weakestSkill.skill_category] || weakestSkill.skill_category;
      const level = Number(weakestSkill.current_level).toFixed(1);
      return `What's good. Based on your profile, ${skillName} is your weakest area at ${level}/10 — that's where we lock in. What's up?`;
    }

    // Have a plan but no memory yet (new user post-onboarding)
    return "What's good. I built your plan based on what you told me. Run a session and I'll start tracking everything. What you wanna ask?";
  } catch (e) {
    console.error('buildOpeningGreeting failed:', e);
    return "What's good. I'm Coach X — your AI trainer. Ask me anything about your game, or upload film and I'll break it down for you.";
  }
}

export default function CoachXScreen() {
  const insets = useSafeAreaInsets();
  const { profile, plan } = usePlanStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Build a smart memory-aware opening greeting on first mount
  useEffect(() => {
    if (messages.length === 0) {
      buildOpeningGreeting().then(greeting => {
        setMessages([{
          role: 'assistant',
          content: greeting,
          type: 'text',
        }]);
      });
    }
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMsg = inputText.trim();
    setInputText('');
    Keyboard.dismiss();

    const newMsgs: ChatMessage[] = [...messages, { role: 'user', content: userMsg, type: 'text' }];
    setMessages(newMsgs);
    setIsLoading(true);
    scrollToBottom();

    try {
      // Get the user's Supabase JWT so the backend can identify them and pull memory
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
          chatHistory: newMsgs.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();

      if (response.ok && data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply, type: 'text' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "My bad, having trouble right now. Try again.", type: 'text' }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Can't connect right now. Check your connection.", type: 'text' }]);
    }

    setIsLoading(false);
    scrollToBottom();
  };

  const handleFilmUpload = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your camera roll.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      videoMaxDuration: 60,
      quality: 0.3,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    setIsUploading(true);
    setMessages(prev => [...prev, { role: 'user', content: '🎬 Uploaded a film clip', type: 'text' }]);
    setMessages(prev => [...prev, { role: 'assistant', content: 'Let me watch this...', type: 'text' }]);
    scrollToBottom();

    try {
      const fileName = 'film_' + Date.now() + '.mp4';

      const formData = new FormData();
      formData.append('file', {
        uri: result.assets[0].uri,
        type: 'video/mp4',
        name: fileName,
      } as any);

      const supabaseUrl = 'https://tvtojlwdpipntkktguck.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2dG9qbHdkcGlwbnRra3RndWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODMxNDYsImV4cCI6MjA5MTA1OTE0Nn0.9GiDMwjhdZNotoJT_mFlxvxgns0I0pgjVNmM1oyPqFY';

      const uploadRes = await fetch(
        supabaseUrl + '/storage/v1/object/films/' + fileName,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + supabaseKey,
            'apikey': supabaseKey,
          },
          body: formData,
        }
      );

      if (!uploadRes.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: "Couldn't upload that clip. Try a shorter one.", type: 'text' }]);
        setIsUploading(false);
        scrollToBottom();
        return;
      }

      const videoUrl = supabaseUrl + '/storage/v1/object/public/films/' + fileName;

      // Update the "watching" message
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Watching your film... this takes about a minute.', type: 'text' };
        return updated;
      });
      scrollToBottom();

      const analysisRes = await fetch('https://collectiq-xi.vercel.app/api/analyze-film', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: videoUrl, profile: profile }),
      });

      const analysisData = await analysisRes.json();

      if (analysisRes.ok && analysisData.overallGrade) {
        // Remove the "watching" message and add the result
        setMessages(prev => {
          const updated = prev.slice(0, -1);
          updated.push({
            role: 'assistant',
            content: '',
            type: 'film-result',
            filmData: analysisData,
          });
          return updated;
        });
      } else {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: "Had trouble analyzing that clip. Try a shorter one or better lighting.", type: 'text' };
          return updated;
        });
      }
    } catch (e) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: "Something went wrong. Try again.", type: 'text' };
        return updated;
      });
    }

    setIsUploading(false);
    scrollToBottom();
  };

  const GRADE_COLORS: Record<string, string> = {
    'A': '#8B9A6B', 'B': Colors.primary, 'C': '#B08D57', 'D': '#C47A6C', 'F': '#C44A4A',
  };

  const renderFilmResult = (data: any) => {
    const gc = GRADE_COLORS[data.overallGrade] || Colors.primary;
    return (
      <View style={s.filmResult}>
        <View style={s.filmGradeRow}>
          <View style={[s.filmGradeCircle, { borderColor: gc }]}>
            <Text style={[s.filmGradeText, { color: gc }]}>{data.overallGrade}</Text>
          </View>
          <Text style={s.filmSummary}>{data.summary}</Text>
        </View>

        {data.coachNote && (
          <Text style={s.filmCoachNote}>{data.coachNote}</Text>
        )}

        {data.strengths && data.strengths.length > 0 && (
          <View style={s.filmSection}>
            <Text style={s.filmSectionTitle}>STRENGTHS</Text>
            {data.strengths.map((item: any, i: number) => (
              <View key={i} style={s.filmItem}>
                <View style={[s.filmDot, { backgroundColor: '#8B9A6B' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.filmSkill}>{item.skill}</Text>
                  <Text style={s.filmDetail}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {data.weaknesses && data.weaknesses.length > 0 && (
          <View style={s.filmSection}>
            <Text style={s.filmSectionTitle}>WORK ON</Text>
            {data.weaknesses.map((item: any, i: number) => (
              <View key={i} style={s.filmItem}>
                <View style={[s.filmDot, { backgroundColor: '#C47A6C' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.filmSkill}>{item.skill}</Text>
                  <Text style={s.filmDetail}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {data.drillRecommendations && data.drillRecommendations.length > 0 && (
          <View style={s.filmSection}>
            <Text style={s.filmSectionTitle}>DRILLS I'D ADD</Text>
            {data.drillRecommendations.map((item: any, i: number) => (
              <View key={i} style={s.filmItem}>
                <View style={[s.filmDot, { backgroundColor: Colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.filmSkill}>{item.name}</Text>
                  <Text style={s.filmDetail}>{item.reason}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Image source={require('@/assets/images/coach-x-small.png')} style={s.headerAvatar} resizeMode="cover" />
        <View style={s.headerInfo}>
          <Text style={s.headerName}>Coach X</Text>
          <Text style={s.headerStatus}>Your AI Training Coach</Text>
        </View>
      </View>

      {/* Quick actions */}
      {messages.length <= 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.quickScroll} contentContainerStyle={s.quickContent}>
          {[
            "What should I work on?",
            "Explain my plan",
            "I only have 20 min",
            "How's my left hand?",
          ].map((q, i) => (
            <TouchableOpacity key={i} style={s.quickBtn} onPress={() => setInputText(q)} activeOpacity={0.7}>
              <Text style={s.quickTxt}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Messages */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={insets.top + 60}>
        <ScrollView
          ref={scrollRef}
          style={s.messageList}
          contentContainerStyle={s.messageContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        >
          {messages.map((msg, i) => (
            <View key={i} style={[s.msgRow, msg.role === 'user' ? s.msgRowUser : s.msgRowCoach]}>
              {msg.role === 'assistant' && (
                <Image source={require('@/assets/images/coach-x-small.png')} style={s.msgAvatar} resizeMode="cover" />
              )}
              {msg.type === 'film-result' && msg.filmData ? (
                renderFilmResult(msg.filmData)
              ) : (
                <View style={[s.msgBubble, msg.role === 'user' ? s.msgBubbleUser : s.msgBubbleCoach]}>
                  <Text style={[s.msgText, msg.role === 'user' ? s.msgTextUser : s.msgTextCoach]}>{msg.content}</Text>
                </View>
              )}
            </View>
          ))}
          {isLoading && (
            <View style={[s.msgRow, s.msgRowCoach]}>
              <Image source={require('@/assets/images/coach-x-small.png')} style={s.msgAvatar} resizeMode="cover" />
              <View style={[s.msgBubble, s.msgBubbleCoach]}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input bar */}
        <View style={[s.inputBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
          <TouchableOpacity style={s.filmBtn} onPress={handleFilmUpload} activeOpacity={0.7} disabled={isUploading}>
            {isUploading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Film size={20} color={Colors.primary} />
            )}
          </TouchableOpacity>
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
            <Send size={18} color={inputText.trim() && !isLoading ? Colors.black : Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
  },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  headerStatus: { fontSize: 12, color: Colors.textMuted },
  // Quick actions
  quickScroll: { maxHeight: 50, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder },
  quickContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  quickBtn: {
    backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
  },
  quickTxt: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  // Messages
  messageList: { flex: 1 },
  messageContent: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  msgRow: { flexDirection: 'row', gap: 8, maxWidth: '88%' },
  msgRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  msgRowCoach: { alignSelf: 'flex-start' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, marginTop: 4 },
  msgBubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '90%' },
  msgBubbleUser: { backgroundColor: Colors.primary },
  msgBubbleCoach: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextUser: { color: Colors.black, fontWeight: '500' },
  msgTextCoach: { color: Colors.textPrimary },
  // Input
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  filmBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 24,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: Colors.textPrimary,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnOff: { backgroundColor: Colors.surface },
  // Film result
  filmResult: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16, maxWidth: '90%',
  },
  filmGradeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  filmGradeCircle: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  filmGradeText: { fontSize: 22, fontWeight: '900' },
  filmSummary: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, flex: 1 },
  filmCoachNote: { fontSize: 13, color: Colors.primary, fontStyle: 'italic', lineHeight: 19, marginBottom: 12 },
  filmSection: { marginTop: 8 },
  filmSectionTitle: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.2, marginBottom: 8 },
  filmItem: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  filmDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  filmSkill: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  filmDetail: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
});
