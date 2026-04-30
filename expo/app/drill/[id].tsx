import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, Clock, Target, Play, AlertCircle, Lightbulb } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import YoutubePlayer from 'react-native-youtube-iframe';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';

const { width: SCREEN_W } = Dimensions.get('window');
const VIDEO_HEIGHT = Math.round((SCREEN_W - 40) * 9 / 16);

export default function DrillDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { plan, currentDayIndex, completedDrills, toggleDrillComplete } = usePlanStore();

  const drillIndex = parseInt(id || '0');
  const day = plan?.days?.[currentDayIndex];
  const planDrill = day?.drills?.[drillIndex];
  const drill = resolvePlanDrill(planDrill);

  const [videoPlaying, setVideoPlaying] = useState(false);

  if (!drill) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>Drill not found</Text>
        </View>
      </View>
    );
  }

  const isComplete = !!completedDrills[currentDayIndex + '-' + drillIndex];

  const handleComplete = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleDrillComplete(currentDayIndex, drillIndex);
  };

  // YouTube ID — drills will get these added over time. Falls back to "video coming soon".
  const youtubeId: string = (drill as any).youtubeId || '';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* ========== Title + category ========== */}
        <View style={styles.titleWrap}>
          {drill.category ? (
            <Text style={styles.category}>{drill.category.toUpperCase()}</Text>
          ) : null}
          <Text style={styles.drillName}>{drill.name}</Text>
        </View>

        {/* ========== Summary ========== */}
        {drill.summary ? (
          <View style={styles.summaryWrap}>
            <Text style={styles.summaryText}>{drill.summary}</Text>
          </View>
        ) : null}

        {/* ========== Video ========== */}
        {youtubeId ? (
          <View style={styles.videoWrap}>
            <View style={styles.videoBox}>
              <YoutubePlayer
                height={VIDEO_HEIGHT}
                play={videoPlaying}
                videoId={youtubeId}
                onChangeState={(state) => {
                  if (state === 'ended') setVideoPlaying(false);
                }}
                webViewProps={{
                  allowsInlineMediaPlayback: true,
                  mediaPlaybackRequiresUserAction: false,
                }}
                initialPlayerParams={{
                  modestbranding: true,
                  rel: false,
                  controls: true,
                  preventFullScreen: false,
                }}
              />
            </View>
          </View>
        ) : (
          <View style={styles.videoMissingWrap}>
            <View style={[styles.videoBox, styles.videoMissingBox]}>
              <Play size={32} color={Colors.textMuted} />
              <Text style={styles.videoMissingText}>Video coming soon</Text>
            </View>
          </View>
        )}

        {/* ========== Quick info chips ========== */}
        <View style={styles.detailsWrap}>
          <View style={styles.detailsRow}>
            {drill.time ? (
              <View style={styles.detailChip}>
                <Clock size={14} color={Colors.primary} />
                <Text style={styles.detailChipText}>{drill.time}</Text>
              </View>
            ) : null}
            {drill.difficulty ? (
              <View style={styles.detailChip}>
                <Target size={14} color={Colors.primary} />
                <Text style={styles.detailChipText}>{drill.difficulty}</Text>
              </View>
            ) : null}
          </View>

          {/* ========== Equipment ========== */}
          {drill.equipment && drill.equipment.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>EQUIPMENT</Text>
              <Text style={styles.sectionText}>
                {drill.equipment.join(', ')}
              </Text>
            </View>
          ) : null}

          {/* ========== Steps ========== */}
          {drill.steps && drill.steps.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>HOW TO DO IT</Text>
              {drill.steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* ========== Coaching points ========== */}
          {drill.coachingPoints && drill.coachingPoints.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Lightbulb size={14} color={Colors.primary} />
                <Text style={styles.sectionTitle}>COACH X CUES</Text>
              </View>
              {drill.coachingPoints.map((cue, i) => (
                <View key={i} style={styles.cueRow}>
                  <Text style={styles.cueBullet}>—</Text>
                  <Text style={styles.cueText}>{cue}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* ========== Common mistakes ========== */}
          {drill.commonMistakes && drill.commonMistakes.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <AlertCircle size={14} color="#C47A6C" />
                <Text style={[styles.sectionTitle, { color: '#C47A6C' }]}>WATCH OUT FOR</Text>
              </View>
              {drill.commonMistakes.map((m, i) => (
                <View key={i} style={styles.cueRow}>
                  <Text style={[styles.cueBullet, { color: '#C47A6C' }]}>×</Text>
                  <Text style={styles.cueText}>{m}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* ========== Variations ========== */}
          {drill.variations && drill.variations.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>VARIATIONS</Text>
              {drill.variations.map((v, i) => (
                <View key={i} style={styles.cueRow}>
                  <Text style={styles.cueBullet}>—</Text>
                  <Text style={styles.cueText}>{v}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Mark complete bottom button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.completeBtn, isComplete && styles.completeBtnDone]}
          onPress={handleComplete}
          activeOpacity={0.85}
        >
          {isComplete ? (
            <>
              <Check size={18} color={Colors.white} />
              <Text style={styles.completeBtnText}>Completed</Text>
            </>
          ) : (
            <Text style={styles.completeBtnText}>Mark complete</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: Colors.textMuted },

  titleWrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  category: {
    fontSize: 11, fontWeight: '700', color: Colors.primary,
    letterSpacing: 1.5, marginBottom: 6,
  },
  drillName: {
    fontSize: 28, fontWeight: '700', color: Colors.textPrimary,
    letterSpacing: -0.8, lineHeight: 34,
  },

  summaryWrap: { paddingHorizontal: 20, paddingBottom: 16 },
  summaryText: {
    fontSize: 15, color: Colors.textSecondary, lineHeight: 22, letterSpacing: -0.2,
  },

  videoWrap: { paddingHorizontal: 20, marginBottom: 20 },
  videoBox: {
    borderRadius: 16, overflow: 'hidden', backgroundColor: '#000',
  },
  videoMissingWrap: { paddingHorizontal: 20, marginBottom: 20 },
  videoMissingBox: {
    height: VIDEO_HEIGHT, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.surfaceBorder,
    gap: 8,
  },
  videoMissingText: { fontSize: 13, color: Colors.textMuted },

  detailsWrap: { paddingHorizontal: 20 },
  detailsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 20 },
  detailChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: '#FBF5E2', borderRadius: 100,
    borderWidth: 1, borderColor: Colors.primary,
  },
  detailChipText: {
    fontSize: 12, fontWeight: '600', color: Colors.primary, letterSpacing: -0.1,
    textTransform: 'capitalize',
  },

  section: { marginBottom: 24 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.primary,
    letterSpacing: 1.5, marginBottom: 12,
  },
  sectionText: {
    fontSize: 14, color: Colors.textSecondary, lineHeight: 20,
  },

  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stepNumber: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    fontSize: 12, fontWeight: '700', color: Colors.white,
  },
  stepText: {
    flex: 1, fontSize: 14, color: Colors.textPrimary,
    lineHeight: 21, letterSpacing: -0.2,
  },

  cueRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  cueBullet: {
    fontSize: 14, color: Colors.primary, lineHeight: 20,
    fontWeight: '700', minWidth: 14,
  },
  cueText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: Colors.background,
    borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  completeBtn: {
    backgroundColor: '#1A1A1A', borderRadius: 100, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  completeBtnDone: { backgroundColor: Colors.primary },
  completeBtnText: {
    fontSize: 15, fontWeight: '600', color: Colors.white, letterSpacing: 0.2,
  },
});
