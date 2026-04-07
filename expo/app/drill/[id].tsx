import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Clock, Dumbbell, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { getDrillById } from '@/constants/drills';

export default function DrillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const drill = id ? getDrillById(id) : undefined;

  if (!drill) {
    return (
      <View style={[s.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <ChevronLeft size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 16, color: Colors.textMuted, textAlign: 'center', marginBottom: 8 }}>Drill not found</Text>
          <Text style={{ fontSize: 13, color: Colors.textMuted, textAlign: 'center' }}>This drill may have been removed or the link is invalid.</Text>
        </View>
      </View>
    );
  }

  const difficultyColor = drill.difficulty === 'beginner' ? '#8B9A6B' : drill.difficulty === 'intermediate' ? Colors.primary : '#C47A6C';

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{drill.category}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>{drill.name}</Text>
        <Text style={s.summary}>{drill.summary}</Text>

        <View style={s.metaRow}>
          <View style={s.metaPill}>
            <Clock size={14} color={Colors.textMuted} />
            <Text style={s.metaText}>{drill.duration} min</Text>
          </View>
          <View style={[s.metaPill, { borderColor: difficultyColor }]}>
            <Text style={[s.metaText, { color: difficultyColor, textTransform: 'capitalize' }]}>{drill.difficulty}</Text>
          </View>
          {drill.equipment.length > 0 && (
            <View style={s.metaPill}>
              <Dumbbell size={14} color={Colors.textMuted} />
              <Text style={s.metaText}>{drill.equipment.join(', ')}</Text>
            </View>
          )}
        </View>

        <Text style={s.sectionLabel}>HOW TO DO IT</Text>
        <View style={s.section}>
          {drill.steps.map((step, i) => (
            <View key={i} style={s.stepRow}>
              <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
              <Text style={s.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionLabel}>COACHING POINTS</Text>
        <View style={s.section}>
          {drill.coachingPoints.map((point, i) => (
            <View key={i} style={s.bulletRow}>
              <CheckCircle2 size={16} color={Colors.primary} style={{ marginTop: 2 }} />
              <Text style={s.bulletText}>{point}</Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionLabel}>COMMON MISTAKES</Text>
        <View style={s.section}>
          {drill.commonMistakes.map((mistake, i) => (
            <View key={i} style={s.bulletRow}>
              <AlertCircle size={16} color="#C47A6C" style={{ marginTop: 2 }} />
              <Text style={s.bulletText}>{mistake}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginTop: 8, marginBottom: 8 },
  summary: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 18 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.surfaceBorder, paddingHorizontal: 12, paddingVertical: 8 },
  metaText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 10, marginLeft: 4 },
  section: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: 16, marginBottom: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontSize: 12, fontWeight: '900', color: Colors.black },
  stepText: { flex: 1, fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  bulletText: { flex: 1, fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
});
