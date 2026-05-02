import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search, X, CheckCircle2, Circle, Filter } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { ALL_DRILLS, DRILL_CATEGORIES, type Drill } from '@/constants/drillLibrary';

type VideoFilter = 'all' | 'has-video' | 'no-video';

export default function DrillLibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [videoFilter, setVideoFilter] = useState<VideoFilter>('all');

  const filtered = useMemo(() => {
    let drills: Drill[] = ALL_DRILLS;

    if (selectedCategory !== 'All') {
      drills = drills.filter(d => d.category === selectedCategory);
    }
    if (videoFilter === 'has-video') {
      drills = drills.filter(d => !!d.videoUrl);
    } else if (videoFilter === 'no-video') {
      drills = drills.filter(d => !d.videoUrl);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      drills = drills.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q)
      );
    }
    return drills;
  }, [searchQuery, selectedCategory, videoFilter]);

  const totalCount = ALL_DRILLS.length;
  const withVideoCount = ALL_DRILLS.filter(d => !!d.videoUrl).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Drill Library</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalCount}</Text>
          <Text style={styles.statLabel}>Total drills</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{withVideoCount}</Text>
          <Text style={styles.statLabel}>With video</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalCount - withVideoCount}</Text>
          <Text style={styles.statLabel}>Need video</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Search size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or ID..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Video filter pills */}
      <View style={styles.videoFilterRow}>
        {(['all', 'has-video', 'no-video'] as VideoFilter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.videoFilterChip, videoFilter === f && styles.videoFilterActive]}
            onPress={() => setVideoFilter(f)}
          >
            <Text style={[styles.videoFilterText, videoFilter === f && styles.videoFilterTextActive]}>
              {f === 'all' ? 'All' : f === 'has-video' ? 'Has video' : 'Needs video'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 12 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        <TouchableOpacity
          style={[styles.catChip, selectedCategory === 'All' && styles.catChipActive]}
          onPress={() => setSelectedCategory('All')}
        >
          <Text style={[styles.catChipText, selectedCategory === 'All' && styles.catChipTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        {DRILL_CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.name}
            style={[styles.catChip, selectedCategory === cat.name && styles.catChipActive]}
            onPress={() => setSelectedCategory(cat.name)}
          >
            <Text style={[styles.catChipText, selectedCategory === cat.name && styles.catChipTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Drill list */}
      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        <View style={styles.resultCount}>
          <Text style={styles.resultCountText}>{filtered.length} drills</Text>
        </View>

        {filtered.map(drill => {
          const hasVideo = !!drill.videoUrl;
          return (
            <View key={drill.id} style={styles.drillCard}>
              <View style={styles.drillCardLeft}>
                {hasVideo ? (
                  <CheckCircle2 size={18} color={Colors.primary} />
                ) : (
                  <Circle size={18} color={Colors.surfaceBorder} />
                )}
              </View>
              <View style={styles.drillCardMid}>
                <View style={styles.drillNameRow}>
                  <Text style={styles.drillName} numberOfLines={1}>{drill.name}</Text>
                  <Text style={styles.drillId}>{drill.id}</Text>
                </View>
                <Text style={styles.drillMeta}>
                  {drill.category} · {drill.duration}min · {drill.difficulty}
                </Text>
                {drill.summary ? (
                  <Text style={styles.drillSummary} numberOfLines={2}>
                    {drill.summary}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.3,
  },

  statsBar: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: 16, marginHorizontal: 20, marginBottom: 16,
    paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: {
    fontSize: 20, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11, color: Colors.textMuted, marginTop: 2,
  },
  statDivider: { width: 1, backgroundColor: Colors.surfaceBorder, marginVertical: 4 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: {
    flex: 1, fontSize: 14, color: Colors.textPrimary, padding: 0,
  },

  videoFilterRow: {
    flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 10,
  },
  videoFilterChip: {
    flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    borderRadius: 100,
    minHeight: 36,
  },
  videoFilterActive: {
    backgroundColor: '#FBF5E2', borderColor: Colors.primary,
  },
  videoFilterText: {
    fontSize: 13, fontWeight: '600', color: Colors.textSecondary, letterSpacing: -0.1,
    lineHeight: 18,
  },
  videoFilterTextActive: { color: Colors.primary },

  catChip: {
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    borderRadius: 100,
    minHeight: 36,
    justifyContent: 'center',
  },
  catChipActive: {
    backgroundColor: '#1A1A1A', borderColor: '#1A1A1A',
  },
  catChipText: {
    fontSize: 13, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.1,
    lineHeight: 18,
  },
  catChipTextActive: { color: Colors.white },

  resultCount: { paddingHorizontal: 20, paddingVertical: 8 },
  resultCountText: {
    fontSize: 11, color: Colors.textMuted, fontWeight: '600', letterSpacing: 1,
  },

  drillCard: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 20, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  drillCardLeft: {
    paddingTop: 2,
  },
  drillCardMid: { flex: 1 },
  drillNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  drillName: {
    flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.2,
  },
  drillId: {
    fontSize: 10, color: Colors.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: Colors.surface, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
  },
  drillMeta: {
    fontSize: 11, color: Colors.textMuted, textTransform: 'capitalize',
  },
  drillSummary: {
    fontSize: 12, color: Colors.textSecondary, marginTop: 4, lineHeight: 17,
  },
});
