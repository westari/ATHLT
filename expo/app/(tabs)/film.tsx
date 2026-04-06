import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Upload, Film, ChevronDown, ChevronUp, Play } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';

interface FilmAnalysis {
  overallGrade: string;
  summary: string;
  strengths: { skill: string; detail: string }[];
  weaknesses: { skill: string; detail: string }[];
  keyPlays: { timestamp: string; description: string; grade: string }[];
  drillRecommendations: { name: string; reason: string }[];
  coachNote: string;
}

const GRADE_COLORS: Record<string, string> = {
  'A': '#8B9A6B', 'B': Colors.primary, 'C': '#B08D57', 'D': '#C47A6C', 'F': '#C44A4A',
};

export default function FilmScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = usePlanStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<FilmAnalysis | null>(null);
  const [error, setError] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('strengths');
  const [analyzeProgress, setAnalyzeProgress] = useState('');

  const handlePickVideo = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError('');

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your camera roll to analyze game film.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      videoMaxDuration: 120,
      quality: 0.5,
    });

    if (result.canceled) return;

    const video = result.assets[0];
    if (!video.uri) return;

    setIsAnalyzing(true);
    setAnalyzeProgress('Reading video file...');

    try {
      const base64 = await FileSystem.readAsStringAsync(video.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setAnalyzeProgress('Coach X is watching your film...');

      const mimeType = video.uri.endsWith('.mov') ? 'video/quicktime' : 'video/mp4';

      const response = await fetch('https://collectiq-xi.vercel.app/api/analyze-film', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoBase64: base64,
          mimeType: mimeType,
          profile: profile,
        }),
      });

      const data = await response.json();

      if (response.ok && data.overallGrade) {
        setAnalysis(data);
      } else {
        setError(data.error || 'Failed to analyze video. Try a shorter clip.');
      }
    } catch (e: any) {
      setError('Failed to upload video. Try a shorter clip (under 30 seconds).');
    }

    setIsAnalyzing(false);
    setAnalyzeProgress('');
  };

  const handleRecordVideo = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError('');

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera access to record game film.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 120,
      quality: 0.5,
    });

    if (result.canceled) return;

    const video = result.assets[0];
    if (!video.uri) return;

    setIsAnalyzing(true);
    setAnalyzeProgress('Reading video file...');

    try {
      const base64 = await FileSystem.readAsStringAsync(video.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setAnalyzeProgress('Coach X is watching your film...');

      const response = await fetch('https://collectiq-xi.vercel.app/api/analyze-film', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoBase64: base64,
          mimeType: 'video/mp4',
          profile: profile,
        }),
      });

      const data = await response.json();

      if (response.ok && data.overallGrade) {
        setAnalysis(data);
      } else {
        setError(data.error || 'Failed to analyze video.');
      }
    } catch (e) {
      setError('Failed to upload video. Try a shorter clip.');
    }

    setIsAnalyzing(false);
    setAnalyzeProgress('');
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (isAnalyzing) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.analyzingScreen}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={s.analyzingTitle}>Analyzing your film</Text>
          <Text style={s.analyzingText}>{analyzeProgress}</Text>
          <Text style={s.analyzingHint}>This may take up to 30 seconds for longer clips.</Text>
        </View>
      </View>
    );
  }

  if (analysis) {
    const gc = GRADE_COLORS[analysis.overallGrade] || Colors.primary;
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.headerRow}>
            <Text style={s.headerTitle}>Film Analysis</Text>
            <TouchableOpacity style={s.newBtn} onPress={() => setAnalysis(null)} activeOpacity={0.7}>
              <Text style={s.newBtnTxt}>New Analysis</Text>
            </TouchableOpacity>
          </View>

          {/* Grade card */}
          <View style={s.gradeCard}>
            <View style={[s.gradeCircle, { borderColor: gc }]}>
              <Text style={[s.gradeText, { color: gc }]}>{analysis.overallGrade}</Text>
            </View>
            <Text style={s.gradeSummary}>{analysis.summary}</Text>
          </View>

          {/* Coach note */}
          {analysis.coachNote && (
            <View style={s.coachNote}>
              <Text style={s.coachNoteLabel}>COACH X SAYS</Text>
              <Text style={s.coachNoteText}>{analysis.coachNote}</Text>
            </View>
          )}

          {/* Strengths */}
          <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('strengths')} activeOpacity={0.7}>
            <Text style={s.sectionTitle}>STRENGTHS</Text>
            <Text style={[s.sectionCount, { color: '#8B9A6B' }]}>{analysis.strengths.length}</Text>
            {expandedSection === 'strengths' ? <ChevronUp size={18} color={Colors.textMuted} /> : <ChevronDown size={18} color={Colors.textMuted} />}
          </TouchableOpacity>
          {expandedSection === 'strengths' && analysis.strengths.map((s2, i) => (
            <View key={i} style={s.itemCard}>
              <View style={[s.itemDot, { backgroundColor: '#8B9A6B' }]} />
              <View style={s.itemContent}>
                <Text style={s.itemSkill}>{s2.skill}</Text>
                <Text style={s.itemDetail}>{s2.detail}</Text>
              </View>
            </View>
          ))}

          {/* Weaknesses */}
          <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('weaknesses')} activeOpacity={0.7}>
            <Text style={s.sectionTitle}>AREAS TO IMPROVE</Text>
            <Text style={[s.sectionCount, { color: '#C47A6C' }]}>{analysis.weaknesses.length}</Text>
            {expandedSection === 'weaknesses' ? <ChevronUp size={18} color={Colors.textMuted} /> : <ChevronDown size={18} color={Colors.textMuted} />}
          </TouchableOpacity>
          {expandedSection === 'weaknesses' && analysis.weaknesses.map((w, i) => (
            <View key={i} style={s.itemCard}>
              <View style={[s.itemDot, { backgroundColor: '#C47A6C' }]} />
              <View style={s.itemContent}>
                <Text style={s.itemSkill}>{w.skill}</Text>
                <Text style={s.itemDetail}>{w.detail}</Text>
              </View>
            </View>
          ))}

          {/* Key plays */}
          {analysis.keyPlays && analysis.keyPlays.length > 0 && (
            <>
              <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('plays')} activeOpacity={0.7}>
                <Text style={s.sectionTitle}>KEY PLAYS</Text>
                <Text style={[s.sectionCount, { color: Colors.primary }]}>{analysis.keyPlays.length}</Text>
                {expandedSection === 'plays' ? <ChevronUp size={18} color={Colors.textMuted} /> : <ChevronDown size={18} color={Colors.textMuted} />}
              </TouchableOpacity>
              {expandedSection === 'plays' && analysis.keyPlays.map((p, i) => (
                <View key={i} style={s.itemCard}>
                  <View style={[s.itemDot, { backgroundColor: p.grade === 'good' ? '#8B9A6B' : p.grade === 'bad' ? '#C47A6C' : Colors.textMuted }]} />
                  <View style={s.itemContent}>
                    <Text style={s.itemSkill}>{p.timestamp}</Text>
                    <Text style={s.itemDetail}>{p.description}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Drill recommendations */}
          {analysis.drillRecommendations && analysis.drillRecommendations.length > 0 && (
            <>
              <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection('drills')} activeOpacity={0.7}>
                <Text style={s.sectionTitle}>RECOMMENDED DRILLS</Text>
                <Text style={[s.sectionCount, { color: Colors.primary }]}>{analysis.drillRecommendations.length}</Text>
                {expandedSection === 'drills' ? <ChevronUp size={18} color={Colors.textMuted} /> : <ChevronDown size={18} color={Colors.textMuted} />}
              </TouchableOpacity>
              {expandedSection === 'drills' && analysis.drillRecommendations.map((d, i) => (
                <View key={i} style={s.itemCard}>
                  <View style={[s.itemDot, { backgroundColor: Colors.primary }]} />
                  <View style={s.itemContent}>
                    <Text style={s.itemSkill}>{d.name}</Text>
                    <Text style={s.itemDetail}>{d.reason}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.headerTitle}>Film Study</Text>
        <Text style={s.headerSub}>Upload game film and Coach X will break down your performance.</Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {/* Upload options */}
        <TouchableOpacity style={s.uploadCard} onPress={handlePickVideo} activeOpacity={0.85}>
          <View style={s.uploadIcon}>
            <Upload size={28} color={Colors.primary} />
          </View>
          <Text style={s.uploadTitle}>Upload from Camera Roll</Text>
          <Text style={s.uploadSub}>Select a game clip (under 2 minutes)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.uploadCard} onPress={handleRecordVideo} activeOpacity={0.85}>
          <View style={s.uploadIcon}>
            <Film size={28} color={Colors.primary} />
          </View>
          <Text style={s.uploadTitle}>Record New Clip</Text>
          <Text style={s.uploadSub}>Film yourself or a game right now</Text>
        </TouchableOpacity>

        {/* How it works */}
        <View style={s.howItWorks}>
          <Text style={s.howTitle}>HOW IT WORKS</Text>
          {[
            { num: '1', text: 'Upload a game clip or practice footage' },
            { num: '2', text: 'Coach X analyzes your movements, decisions, and technique' },
            { num: '3', text: 'Get a detailed breakdown with strengths, weaknesses, and drills to improve' },
          ].map((step, i) => (
            <View key={i} style={s.howStep}>
              <View style={s.howNum}><Text style={s.howNumTxt}>{step.num}</Text></View>
              <Text style={s.howText}>{step.text}</Text>
            </View>
          ))}
        </View>

        {/* Tips */}
        <View style={s.tipsCard}>
          <Text style={s.tipsTitle}>TIPS FOR BEST RESULTS</Text>
          <Text style={s.tipItem}>• Keep clips under 2 minutes</Text>
          <Text style={s.tipItem}>• Film from the side or behind the court</Text>
          <Text style={s.tipItem}>• Good lighting helps the AI see better</Text>
          <Text style={s.tipItem}>• Game footage works better than practice</Text>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, marginBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, paddingTop: 16, marginBottom: 8 },
  headerSub: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 24 },
  error: { fontSize: 13, color: '#C47A6C', backgroundColor: '#2A1515', borderRadius: 10, padding: 12, marginBottom: 16 },
  newBtn: { backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.surfaceBorder, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnTxt: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  // Upload cards
  uploadCard: {
    backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 24, alignItems: 'center', marginBottom: 14,
  },
  uploadIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#1A1708',
    borderWidth: 2, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  uploadTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  uploadSub: { fontSize: 13, color: Colors.textMuted },
  // How it works
  howItWorks: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 20, marginBottom: 14,
  },
  howTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 16 },
  howStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  howNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  howNumTxt: { fontSize: 13, fontWeight: '800', color: Colors.black },
  howText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, flex: 1, paddingTop: 3 },
  // Tips
  tipsCard: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 20, marginBottom: 14,
  },
  tipsTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  tipItem: { fontSize: 13, color: Colors.textSecondary, lineHeight: 22 },
  // Analyzing screen
  analyzingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  analyzingTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginTop: 24, marginBottom: 8 },
  analyzingText: { fontSize: 15, color: Colors.primary, fontWeight: '500', marginBottom: 8 },
  analyzingHint: { fontSize: 13, color: Colors.textMuted },
  // Analysis results
  gradeCard: {
    backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 24, alignItems: 'center', marginBottom: 16,
  },
  gradeCircle: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  gradeText: { fontSize: 36, fontWeight: '900' },
  gradeSummary: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  coachNote: {
    backgroundColor: '#141210', borderRadius: 14, borderWidth: 1, borderColor: '#2A2518',
    padding: 18, marginBottom: 16,
  },
  coachNoteLabel: { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 1.5, marginBottom: 8 },
  coachNoteText: { fontSize: 15, color: Colors.primary, lineHeight: 22, fontStyle: 'italic' },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16, marginBottom: 8,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, flex: 1 },
  sectionCount: { fontSize: 16, fontWeight: '800' },
  itemCard: {
    flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 16,
    marginBottom: 4,
  },
  itemDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  itemContent: { flex: 1 },
  itemSkill: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: 3 },
  itemDetail: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
});