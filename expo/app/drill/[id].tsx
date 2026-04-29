import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, Clock, Target, Play } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import YoutubePlayer from 'react-native-youtube-iframe';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';

const { width: SCREEN_W } = Dimensions.get('window');
// Standard YouTube aspect ratio is 16:9
const VIDEO_HEIGHT = Math.round((SCREEN_W - 40) * 9 / 16);

export default function DrillDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { plan, currentDayIndex, completedDrills, toggleDrillComplete } = usePlanStore();

  const drillIndex = parseInt(id || '0');
  const day = plan?.days?.[currentDayIndex];
  const drill = day?.drills?.[drillIndex];

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

  // Drill data — these fields come from your drill object on the plan.
  // Falls back gracefully if a field is missing.
  const drillName: string = drill.name || 'Drill';
  const drillSummary: string = (drill as any).summary || (drill as any).description || '';
  const youtubeId: string = (drill as any).youtubeId || '';
  const drillTime: string = drill.time || '';
  const drillFocus: string = (drill as any).focus || '';
  const drillSets: string = (drill as any).sets || '';
  const drillReps: string = (drill as any).reps || '';
  const drillCues: string[] = (drill as any).cues || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* ========== 1. Drill name ========== */}
        <View style={styles.titleWrap}>
          <Text style={styles.drillName}>{drillName}</Text>
        </View>

        {/* ========== 2. Short summary ========== */}
        {drillSummary ? (
          <View style={styles.summaryWrap}>
            <Text style={styles.summaryText}>{drillSummary}</Text>
          </View>
        ) : null}

        {/* ========== 3. YouTube video (the main thing) ========== */}
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

        {/* ========== 4. Drill details ========== */}
        <View style={styles.detailsWrap}>
          <View style={styles.detailsRow}>
            {drillTime ? (
              <View style={styles.detailChip}>
                <Clock size={14} color={Colors.primary} />
                <Text style={styles.detailChipText}>{drillTime}</Text>
              </View>
            ) : null}
            {drillFocus ? (
              <View style={styles.detailChip}>
                <Target size={14} color={Colors.primary} />
                <Text style={styles.detailChipText}>{drillFocus}</Text>
              </View>
            ) : null}
          </View>

          {(drillSets || drillReps) ? (
            <View style={styles.metaCard}>
              {drillSets ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>SETS</Text>
                  <Text style={styles.metaValue}>{drillSets}</Text>
                </View>
              ) : null}
              {drillReps ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>REPS</Text>
                  <Text style={styles.metaValue}>{drillReps}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {drillCues.length > 0 ? (
            <View style={styles.cuesWrap}>
              <Text style={styles.cuesTitle}>COACH X CUES</Text>
              {drillCues.map((cue, i) => (
                <View key={i} style={styles.cueRow}>
                  <Text style={styles.cueBullet}>—</Text>
                  <Text style={styles.cueText}>{cue}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* ========== Bottom: Mark complete ========== */}
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

  titleWrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
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
  detailsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  detailChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: '#FBF5E2', borderRadius: 100,
    borderWidth: 1, borderColor: Colors.primary,
  },
  detailChipText: {
    fontSize: 12, fontWeight: '600', color: Colors.primary, letterSpacing: -0.1,
  },

  metaCard: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingVertical: 16, paddingHorizontal: 20, marginBottom: 16,
  },
  metaItem: { flex: 1, alignItems: 'flex-start' },
  metaLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 4,
  },
  metaValue: {
    fontSize: 22, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.5,
  },

  cuesWrap: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16, marginBottom: 8,
  },
  cuesTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.primary,
    letterSpacing: 1.5, marginBottom: 10,
  },
  cueRow: { flexDirection: 'row', gap: 8, paddingVertical: 6 },
  cueBullet: { fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  cueText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  bottomBar: {
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
