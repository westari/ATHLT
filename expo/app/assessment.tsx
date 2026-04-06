import React, { useState } from 'react';
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
import { router } from 'expo-router';
import { Upload, Film, Check, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';

interface Clip {
  id: string;
  title: string;
  instruction: string;
  detail: string;
  clipType: string;
}

const CLIPS: Clip[] = [
  {
    id: 'one_on_one',
    title: 'One-on-One',
    instruction: 'Film one possession of you playing 1-on-1',
    detail: 'Half court is fine. Show me how you create and finish.',
    clipType: '1on1',
  },
  {
    id: 'threes',
    title: 'Open Threes',
    instruction: 'Film 2 open three pointers',
    detail: 'No defender. I want to see your form.',
    clipType: 'threes',
  },
  {
    id: 'dribble',
    title: 'Dribble Combo',
    instruction: 'Film some basic dribble combos',
    detail: 'Crossover, between the legs, behind the back. Show me your handle.',
    clipType: 'dribble',
  },
  {
    id: 'game',
    title: 'Game Footage',
    instruction: 'Film footage from a real game',
    detail: 'No game footage? Film yourself finishing once with each hand instead.',
    clipType: 'game',
  },
];

export default function AssessmentScreen() {
  const insets = useSafeAreaInsets();
  const { profile, setSkillLevels, generatePlan } = usePlanStore();
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [completedAssessments, setCompletedAssessments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [skillLevels, setSkillLevelsState] = useState<Record<string, number>>({});

  var currentClip = CLIPS[currentClipIndex];
  var progress = ((currentClipIndex) / CLIPS.length) * 100;

  const uploadAndAssess = async (uri: string) => {
    setIsUploading(true);
    setError('');

    try {
      var fileName = 'assess_' + currentClip.id + '_' + Date.now() + '.mp4';

      var formData = new FormData();
      formData.append('file', {
        uri: uri,
        type: 'video/mp4',
        name: fileName,
      } as any);

      var supabaseUrl = 'https://tvtojlwdpipntkktguck.supabase.co';
      var supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2dG9qbHdkcGlwbnRra3RndWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODMxNDYsImV4cCI6MjA5MTA1OTE0Nn0.9GiDMwjhdZNotoJT_mFlxvxgns0I0pgjVNmM1oyPqFY';

      var uploadRes = await fetch(
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
        setError('Upload failed. Try a shorter clip.');
        setIsUploading(false);
        return;
      }

      var videoUrl = supabaseUrl + '/storage/v1/object/public/films/' + fileName;

      var response = await fetch('https://collectiq-xi.vercel.app/api/assess-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoUrl,
          clipType: currentClip.clipType,
          profile: profile,
        }),
      });

      var data = await response.json();

      if (response.ok && data) {
        var newAssessments = [...completedAssessments, data];
        setCompletedAssessments(newAssessments);

        if (currentClipIndex < CLIPS.length - 1) {
          setCurrentClipIndex(currentClipIndex + 1);
        } else {
          // All clips done - calculate final skill levels
          var finalSkills = calculateFinalSkills(newAssessments);
          setSkillLevelsState(finalSkills);
          setShowResults(true);
        }
      } else {
        setError(data.error || 'Failed to analyze clip. Try a shorter one.');
      }
    } catch (e) {
      setError('Something went wrong. Try again.');
    }

    setIsUploading(false);
  };

  const calculateFinalSkills = (assessments: any[]) => {
    var skillTotals: Record<string, { sum: number; count: number }> = {};

    assessments.forEach(function(a) {
      Object.keys(a).forEach(function(key) {
        if (typeof a[key] === 'number' && key !== 'clipType') {
          if (!skillTotals[key]) skillTotals[key] = { sum: 0, count: 0 };
          skillTotals[key].sum += a[key];
          skillTotals[key].count += 1;
        }
      });
    });

    var finals: Record<string, number> = {};
    Object.keys(skillTotals).forEach(function(skill) {
      finals[skill] = Math.round(skillTotals[skill].sum / skillTotals[skill].count);
    });

    return finals;
  };

  const handleUpload = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    var perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera roll access.');
      return;
    }

    var result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      videoMaxDuration: 30,
      quality: 0.3,
    });

    if (result.canceled || !result.assets[0]?.uri) return;
    await uploadAndAssess(result.assets[0].uri);
  };

  const handleRecord = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    var perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera access.');
      return;
    }

    var result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 30,
      quality: 0.3,
    });

    if (result.canceled || !result.assets[0]?.uri) return;
    await uploadAndAssess(result.assets[0].uri);
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Assessment?',
      'Without seeing you play, your plan will be more generic. Coach X recommends doing the assessment.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip Anyway', style: 'destructive', onPress: function() {
          generatePlan();
          router.replace('/(tabs)/today');
        }},
      ]
    );
  };

  const handleFinish = async () => {
    setSkillLevels(skillLevels);
    await generatePlan();
    router.replace('/(tabs)/today');
  };

  // Show results screen
  if (showResults) {
    var SKILL_LABELS: Record<string, string> = {
      ballHandling: 'Ball Handling',
      shooting: 'Shooting',
      shotForm: 'Shot Form',
      finishing: 'Finishing',
      defense: 'Defense',
      iq: 'Basketball IQ',
      athleticism: 'Athleticism',
      weakHand: 'Weak Hand',
      creativity: 'Creativity',
      touch: 'Touch',
      courtVision: 'Court Vision',
      decisionMaking: 'Decision Making',
    };

    var skillEntries = Object.entries(skillLevels).sort(function(a, b) { return b[1] - a[1]; });
    var avgLevel = skillEntries.reduce(function(s, e) { return s + e[1]; }, 0) / skillEntries.length;

    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.resultsHeader}>
            <Image source={require('@/assets/images/coach-x.png')} style={s.coachImg} resizeMode="contain" />
            <Text style={s.resultsTitle}>Here's What I Saw</Text>
            <Text style={s.resultsSub}>Your skill levels based on the film</Text>
          </View>

          <View style={s.overallCard}>
            <Text style={s.overallLabel}>OVERALL LEVEL</Text>
            <Text style={s.overallNum}>{avgLevel.toFixed(1)}<Text style={s.overallMax}>/10</Text></Text>
          </View>

          <View style={s.skillsGrid}>
            {skillEntries.map(function(entry) {
              var skillKey = entry[0];
              var level = entry[1];
              var label = SKILL_LABELS[skillKey] || skillKey;
              var color = level >= 7 ? '#8B9A6B' : level >= 5 ? Colors.primary : level >= 3 ? '#B08D57' : '#C47A6C';

              return (
                <View key={skillKey} style={s.skillCard}>
                  <Text style={s.skillName}>{label}</Text>
                  <View style={s.skillRow}>
                    <View style={s.skillBarOuter}>
                      <View style={[s.skillBarInner, { width: (level * 10) + '%', backgroundColor: color }]} />
                    </View>
                    <Text style={[s.skillLevel, { color: color }]}>{level}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={s.finishBtn} onPress={handleFinish} activeOpacity={0.85}>
            <Text style={s.finishTxt}>BUILD MY PLAN</Text>
            <ChevronRight size={18} color={Colors.black} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Clip upload screen
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Progress bar */}
      <View style={s.progressContainer}>
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: progress + '%' }]} />
        </View>
        <Text style={s.progressText}>Clip {currentClipIndex + 1} of {CLIPS.length}</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Coach X intro */}
        <View style={s.coachRow}>
          <Image source={require('@/assets/images/coach-x-small.png')} style={s.coachAvatar} resizeMode="cover" />
          <Text style={s.coachName}>Coach X</Text>
        </View>

        <Text style={s.clipTitle}>{currentClip.title}</Text>
        <Text style={s.clipInstruction}>{currentClip.instruction}</Text>
        <Text style={s.clipDetail}>{currentClip.detail}</Text>

        {/* Completed clips */}
        {completedAssessments.length > 0 && (
          <View style={s.completedList}>
            {completedAssessments.map(function(a, i) {
              return (
                <View key={i} style={s.completedItem}>
                  <View style={s.checkIcon}>
                    <Check size={14} color={Colors.black} />
                  </View>
                  <Text style={s.completedText}>{CLIPS[i].title}</Text>
                </View>
              );
            })}
          </View>
        )}

        {error ? <Text style={s.error}>{error}</Text> : null}

        {/* Action buttons */}
        {isUploading ? (
          <View style={s.uploadingCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={s.uploadingTitle}>Coach X is watching...</Text>
            <Text style={s.uploadingText}>This takes about a minute</Text>
          </View>
        ) : (
          <View style={s.actionsContainer}>
            <TouchableOpacity style={s.actionBtn} onPress={handleUpload} activeOpacity={0.85}>
              <View style={s.actionIcon}><Upload size={22} color={Colors.primary} /></View>
              <Text style={s.actionTitle}>Upload from Camera Roll</Text>
              <Text style={s.actionSub}>Pick a clip you already have</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionBtn} onPress={handleRecord} activeOpacity={0.85}>
              <View style={s.actionIcon}><Film size={22} color={Colors.primary} /></View>
              <Text style={s.actionTitle}>Record New Clip</Text>
              <Text style={s.actionSub}>Film it right now</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isUploading && currentClipIndex === 0 && (
          <TouchableOpacity style={s.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={s.skipTxt}>Skip assessment</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24, paddingBottom: 30 },
  // Progress
  progressContainer: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  progressBar: { height: 4, backgroundColor: Colors.surface, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  progressText: { fontSize: 11, color: Colors.textMuted, marginTop: 8, fontWeight: '600' },
  // Coach intro
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 16 },
  coachAvatar: { width: 32, height: 32, borderRadius: 16 },
  coachName: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  // Clip info
  clipTitle: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary, marginBottom: 8 },
  clipInstruction: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8, lineHeight: 24 },
  clipDetail: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 24 },
  // Completed
  completedList: { gap: 8, marginBottom: 24 },
  completedItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0F1A0F', borderRadius: 10, borderWidth: 1, borderColor: '#1A2D1A',
    padding: 12,
  },
  checkIcon: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#8B9A6B',
    alignItems: 'center', justifyContent: 'center',
  },
  completedText: { fontSize: 13, fontWeight: '600', color: '#8B9A6B' },
  // Error
  error: {
    fontSize: 13, color: '#C47A6C', backgroundColor: '#2A1515',
    borderRadius: 10, padding: 12, marginBottom: 16,
  },
  // Actions
  actionsContainer: { gap: 12 },
  actionBtn: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 20, alignItems: 'center',
  },
  actionIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#1A1708',
    borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  actionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  actionSub: { fontSize: 12, color: Colors.textMuted },
  // Uploading
  uploadingCard: {
    backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 32, alignItems: 'center',
  },
  uploadingTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginTop: 16, marginBottom: 4 },
  uploadingText: { fontSize: 13, color: Colors.textMuted },
  // Skip
  skipBtn: { alignItems: 'center', marginTop: 20, padding: 12 },
  skipTxt: { fontSize: 13, color: Colors.textMuted, textDecorationLine: 'underline' },

  // Results
  resultsHeader: { alignItems: 'center', marginTop: 20, marginBottom: 24 },
  coachImg: { width: 120, height: 120, marginBottom: 16 },
  resultsTitle: { fontSize: 26, fontWeight: '900', color: Colors.primary, marginBottom: 6 },
  resultsSub: { fontSize: 14, color: Colors.textSecondary },
  overallCard: {
    backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 2, borderColor: Colors.primary,
    padding: 24, alignItems: 'center', marginBottom: 20,
  },
  overallLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  overallNum: { fontSize: 56, fontWeight: '900', color: Colors.primary },
  overallMax: { fontSize: 24, color: Colors.textMuted, fontWeight: '700' },
  skillsGrid: { gap: 10, marginBottom: 24 },
  skillCard: {
    backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 14,
  },
  skillName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8 },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skillBarOuter: { flex: 1, height: 8, backgroundColor: '#1A1A1A', borderRadius: 4, overflow: 'hidden' },
  skillBarInner: { height: 8, borderRadius: 4 },
  skillLevel: { fontSize: 16, fontWeight: '900', minWidth: 24, textAlign: 'right' },
  finishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16,
  },
  finishTxt: { fontSize: 15, fontWeight: '900', color: Colors.black, letterSpacing: 0.8 },
});
