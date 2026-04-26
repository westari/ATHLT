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
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Film as FilmIcon, Upload, Play, Eye } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { supabase } from '@/constants/supabase';
import CoachXPill from '@/components/CoachXPill';

/**
 * Film tab — replaces the old Coach X chat tab.
 * Core feature: upload your own film, Coach X breaks it down with timestamped feedback.
 *
 * Sections:
 *  - Upload pill (primary CTA)
 *  - Latest analysis result (if any)
 *  - History of past film analyses
 *  - Recommended players to study (based on profile)
 */

interface FilmAnalysis {
  id: string;
  date: string;
  videoUrl: string;
  overallGrade: string;
  summary: string;
  coachNote?: string;
  strengths?: { skill: string; detail: string }[];
  weaknesses?: { skill: string; detail: string }[];
  drillRecommendations?: { name: string; reason: string }[];
}

const GRADE_COLORS: Record<string, string> = {
  'A': '#8B9A6B', 'B': Colors.primary, 'C': '#B08D57', 'D': '#C47A6C', 'F': '#C44A4A',
};

// Recommended players to study based on position (placeholder data — Coach X will personalize later)
const PLAYERS_TO_STUDY: Record<string, { name: string; reason: string }[]> = {
  'Point Guard': [
    { name: 'Chris Paul', reason: 'Pace control + mid-range mastery' },
    { name: 'Trae Young', reason: 'Pull-up game from deep' },
  ],
  'Shooting Guard': [
    { name: 'Devin Booker', reason: 'Mid-range footwork is elite' },
    { name: 'Anthony Edwards', reason: 'Athleticism + finishing through contact' },
  ],
  'Small Forward': [
    { name: 'Jayson Tatum', reason: 'Step-back jumper mechanics' },
    { name: 'Jaylen Brown', reason: 'Two-way wing model' },
  ],
  'Power Forward': [
    { name: 'Pascal Siakam', reason: 'Footwork and finishing variety' },
    { name: 'Paolo Banchero', reason: 'Scoring against bigger defenders' },
  ],
  'Center': [
    { name: 'Joel Embiid', reason: 'Footwork and face-up game' },
    { name: 'Bam Adebayo', reason: 'Rim protection + passing' },
  ],
};

export default function FilmScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = usePlanStore();
  const [isUploading, setIsUploading] = useState(false);
  const [analyses, setAnalyses] = useState<FilmAnalysis[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [latestResult, setLatestResult] = useState<any>(null);

  // Load past film analyses on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoadingHistory(false);
        return;
      }

      // NOTE: This requires a `film_analyses` table in Supabase. If it doesn't
      // exist yet, this query will fail silently and history will just be empty.
      const { data } = await supabase
        .from('film_analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(20);

      if (data) setAnalyses(data as FilmAnalysis[]);
    } catch (e) {
      console.error('Failed to load film history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleUpload = async () => {
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
    setLatestResult(null);

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
        Alert.alert('Upload failed', 'Try a shorter clip.');
        setIsUploading(false);
        return;
      }

      const videoUrl = supabaseUrl + '/storage/v1/object/public/films/' + fileName;

      const analysisRes = await fetch('https://collectiq-xi.vercel.app/api/analyze-film', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, profile }),
      });

      const analysisData = await analysisRes.json();

      if (analysisRes.ok && analysisData.overallGrade) {
        setLatestResult({ ...analysisData, videoUrl });

        // Save to film_analyses table for history
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('film_analyses').insert({
              user_id: user.id,
              video_url: videoUrl,
              overall_grade: analysisData.overallGrade,
              summary: analysisData.summary,
              coach_note: analysisData.coachNote,
              strengths: analysisData.strengths,
              weaknesses: analysisData.weaknesses,
              drill_recommendations: analysisData.drillRecommendations,
              date: new Date().toISOString(),
            });
            // Refresh history
            loadHistory();
          }
        } catch (saveErr) {
          console.error('Failed to save film analysis:', saveErr);
        }
      } else {
        Alert.alert('Analysis failed', "Couldn't analyze that clip. Try a shorter one or better lighting.");
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Try again.');
    }

    setIsUploading(false);
  };

  const renderAnalysisCard = (data: any) => {
    const gc = GRADE_COLORS[data.overallGrade] || Colors.primary;
    return (
      <View style={s.analysisCard}>
        <View style={s.gradeRow}>
          <View style={[s.gradeCircle, { borderColor: gc }]}>
            <Text style={[s.gradeText, { color: gc }]}>{data.overallGrade}</Text>
          </View>
          <Text style={s.summary}>{data.summary}</Text>
        </View>

        {data.coachNote && <Text style={s.coachNote}>"{data.coachNote}"</Text>}

        {data.strengths && data.strengths.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>STRENGTHS</Text>
            {data.strengths.map((item: any, i: number) => (
              <View key={i} style={s.item}>
                <View style={[s.dot, { backgroundColor: '#8B9A6B' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.skill}>{item.skill}</Text>
                  <Text style={s.detail}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {data.weaknesses && data.weaknesses.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>WORK ON</Text>
            {data.weaknesses.map((item: any, i: number) => (
              <View key={i} style={s.item}>
                <View style={[s.dot, { backgroundColor: '#C47A6C' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.skill}>{item.skill}</Text>
                  <Text style={s.detail}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {data.drillRecommendations && data.drillRecommendations.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>DRILLS COACH X RECOMMENDS</Text>
            {data.drillRecommendations.map((item: any, i: number) => (
              <View key={i} style={s.item}>
                <View style={[s.dot, { backgroundColor: Colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.skill}>{item.name}</Text>
                  <Text style={s.detail}>{item.reason}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const playersToStudy = profile?.position
    ? PLAYERS_TO_STUDY[profile.position] || []
    : [];

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Coach X pill at top */}
      <CoachXPill />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Header */}
        <Text style={s.title}>Film Room</Text>
        <Text style={s.subtitle}>Upload your game footage. Coach X breaks it down.</Text>

        {/* Upload CTA */}
        <TouchableOpacity
          style={s.uploadBtn}
          onPress={handleUpload}
          activeOpacity={0.85}
          disabled={isUploading}
        >
          {isUploading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color={Colors.white} />
              <Text style={s.uploadTxt}>Coach X is watching...</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Upload size={20} color={Colors.white} />
              <Text style={s.uploadTxt}>Upload Film</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={s.uploadHint}>Up to 60 seconds. Game footage works best.</Text>

        {/* Latest result (just analyzed) */}
        {latestResult && (
          <View style={{ marginTop: 24 }}>
            <Text style={s.sectionHeader}>LATEST ANALYSIS</Text>
            {renderAnalysisCard(latestResult)}
          </View>
        )}

        {/* Players to study */}
        {playersToStudy.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={s.sectionHeader}>PLAYERS TO STUDY</Text>
            <Text style={s.sectionSub}>Based on your position</Text>
            {playersToStudy.map((p, i) => (
              <View key={i} style={s.playerCard}>
                <View style={s.playerIcon}>
                  <Eye size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.playerName}>{p.name}</Text>
                  <Text style={s.playerReason}>{p.reason}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* History */}
        <View style={{ marginTop: 24 }}>
          <Text style={s.sectionHeader}>YOUR FILM HISTORY</Text>
          {isLoadingHistory ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
          ) : analyses.length === 0 ? (
            <View style={s.emptyHistory}>
              <FilmIcon size={32} color={Colors.textMuted} />
              <Text style={s.emptyText}>No film analyses yet</Text>
              <Text style={s.emptySubtext}>Upload your first clip above</Text>
            </View>
          ) : (
            analyses.map((a, i) => {
              const gc = GRADE_COLORS[a.overallGrade] || Colors.primary;
              return (
                <View key={i} style={s.historyCard}>
                  <View style={[s.gradePill, { backgroundColor: gc + '22', borderColor: gc }]}>
                    <Text style={[s.gradePillText, { color: gc }]}>{a.overallGrade}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.historyDate}>
                      {new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <Text style={s.historySummary} numberOfLines={2}>{a.summary}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 20 },
  title: {
    fontSize: 28, fontWeight: '700', color: Colors.textPrimary,
    marginTop: 8, marginBottom: 4, letterSpacing: -0.8,
  },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 24 },
  uploadBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTxt: { fontSize: 16, fontWeight: '600', color: Colors.white, letterSpacing: 0.2 },
  uploadHint: {
    fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 10,
  },
  sectionHeader: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 6,
  },
  sectionSub: {
    fontSize: 12, color: Colors.textMuted, marginBottom: 12,
  },
  // Analysis card (full)
  analysisCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 16,
  },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  gradeCircle: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  gradeText: { fontSize: 22, fontWeight: '900' },
  summary: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, flex: 1 },
  coachNote: {
    fontSize: 13, color: Colors.primary, fontStyle: 'italic',
    lineHeight: 19, marginBottom: 12,
  },
  section: { marginTop: 8 },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.2, marginBottom: 8,
  },
  item: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  skill: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  detail: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  // Players to study
  playerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 14, marginBottom: 8,
  },
  playerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FBF5E2',
    alignItems: 'center', justifyContent: 'center',
  },
  playerName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  playerReason: { fontSize: 12, color: Colors.textMuted },
  // History
  historyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 14, marginBottom: 8,
  },
  gradePill: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  gradePillText: { fontSize: 18, fontWeight: '900' },
  historyDate: { fontSize: 12, color: Colors.textMuted, marginBottom: 4, fontWeight: '600' },
  historySummary: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  emptyHistory: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 40, gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  emptyText: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  emptySubtext: { fontSize: 12, color: Colors.textMuted },
});
