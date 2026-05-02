import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight, Search, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { DRILL_CATEGORIES, getDrillsByCategory, ALL_DRILLS } from '@/constants/drillLibrary';
import type { Drill } from '@/constants/drillLibrary';

const DIFFICULTY_COLORS = {
  beginner: '#8B9A6B',
  intermediate: '#C4A46C',
  advanced: '#C47A6C',
};

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleCategoryPress = (name: string) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(name);
    setSelectedDrill(null);
  };

  const handleDrillPress = (drill: Drill) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDrill(drill);
  };

  const handleBack = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedDrill) {
      setSelectedDrill(null);
    } else {
      setSelectedCategory(null);
      setSearchQuery('');
    }
  };

  // Search results
  const searchResults = searchQuery.length > 1
    ? ALL_DRILLS.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Drill detail view
  if (selectedDrill) {
    const diffColor = DIFFICULTY_COLORS[selectedDrill.difficulty];
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
              <ArrowLeft size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.detailHeaderTitle}>{selectedDrill.category}</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Drill info */}
          <Text style={styles.detailName}>{selectedDrill.name}</Text>

          <View style={styles.detailMeta}>
            <View style={[styles.diffBadge, { backgroundColor: diffColor + '20' }]}>
              <Text style={[styles.diffBadgeText, { color: diffColor }]}>
                {selectedDrill.difficulty.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.detailDuration}>{selectedDrill.duration} min</Text>
            <Text style={styles.detailEquip}>{selectedDrill.equipment.join(' · ')}</Text>
          </View>

          <Text style={styles.detailSummary}>{selectedDrill.summary}</Text>

          {/* Steps */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>HOW TO DO IT</Text>
            {selectedDrill.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          {/* Coaching points */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>COACHING POINTS</Text>
            {selectedDrill.coachingPoints.map((point, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: Colors.primary }]} />
                <Text style={styles.bulletText}>{point}</Text>
              </View>
            ))}
          </View>

          {/* Common mistakes */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>COMMON MISTAKES</Text>
            {selectedDrill.commonMistakes.map((mistake, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: '#C47A6C' }]} />
                <Text style={styles.bulletText}>{mistake}</Text>
              </View>
            ))}
          </View>

          {/* Variations */}
          {selectedDrill.variations && selectedDrill.variations.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>VARIATIONS</Text>
              {selectedDrill.variations.map((v, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: Colors.textMuted }]} />
                  <Text style={styles.bulletText}>{v}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      </View>
    );
  }

  // Category drill list view
  if (selectedCategory) {
    const drills = getDrillsByCategory(selectedCategory);
    const catColor = DRILL_CATEGORIES.find(c => c.name === selectedCategory)?.color || Colors.primary;

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
              <ArrowLeft size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.detailHeaderTitle}>{selectedCategory}</Text>
            <View style={{ width: 40 }} />
          </View>

          <Text style={styles.categoryDrillCount}>{drills.length} drills</Text>

          <View style={styles.drillList}>
            {drills.map((drill, i) => {
              const diffColor = DIFFICULTY_COLORS[drill.difficulty];
              return (
                <TouchableOpacity
                  key={drill.id}
                  style={styles.drillCard}
                  onPress={() => handleDrillPress(drill)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.drillAccent, { backgroundColor: catColor }]} />
                  <View style={styles.drillCardContent}>
                    <Text style={styles.drillCardName}>{drill.name}</Text>
                    <Text style={styles.drillCardSummary} numberOfLines={2}>{drill.summary}</Text>
                    <View style={styles.drillCardMeta}>
                      <View style={[styles.smallBadge, { backgroundColor: diffColor + '20' }]}>
                        <Text style={[styles.smallBadgeText, { color: diffColor }]}>
                          {drill.difficulty.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.drillCardDuration}>{drill.duration} min</Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>
      </View>
    );
  }

  // Main category list view
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Drill Library</Text>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search drills..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Search results */}
        {searchQuery.length > 1 ? (
          <View style={styles.drillList}>
            {searchResults.length === 0 ? (
              <Text style={styles.noResults}>No drills found for "{searchQuery}"</Text>
            ) : (
              searchResults.map((drill) => {
                const diffColor = DIFFICULTY_COLORS[drill.difficulty];
                const catColor = DRILL_CATEGORIES.find(c => c.name === drill.category)?.color || Colors.primary;
                return (
                  <TouchableOpacity
                    key={drill.id}
                    style={styles.drillCard}
                    onPress={() => handleDrillPress(drill)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.drillAccent, { backgroundColor: catColor }]} />
                    <View style={styles.drillCardContent}>
                      <Text style={styles.drillCardName}>{drill.name}</Text>
                      <View style={styles.drillCardMeta}>
                        <Text style={styles.drillCardCategory}>{drill.category}</Text>
                        <View style={[styles.smallBadge, { backgroundColor: diffColor + '20' }]}>
                          <Text style={[styles.smallBadgeText, { color: diffColor }]}>
                            {drill.difficulty.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.drillCardDuration}>{drill.duration} min</Text>
                      </View>
                    </View>
                    <ChevronRight size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : (
          /* Category list */
          <View style={styles.categoryList}>
            {DRILL_CATEGORIES.map((cat, i) => (
              <TouchableOpacity
                key={i}
                style={styles.categoryCard}
                onPress={() => handleCategoryPress(cat.name)}
                activeOpacity={0.7}
              >
                <View style={[styles.categoryAccent, { backgroundColor: cat.color }]} />
                <View style={styles.categoryContent}>
                  <View style={styles.categoryTop}>
                    <Text style={styles.categoryName}>{cat.name}</Text>
                    <Text style={styles.categoryCount}>{cat.drills.length} drills</Text>
                  </View>
                  <Text style={styles.categoryDesc}>{cat.description}</Text>
                </View>
                <ChevronRight size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, paddingTop: 16, marginBottom: 16 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.textPrimary },
  categoryList: { gap: 10 },
  categoryCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16, gap: 14,
  },
  categoryAccent: { width: 4, height: 40, borderRadius: 2 },
  categoryContent: { flex: 1 },
  categoryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  categoryName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  categoryCount: { fontSize: 12, color: Colors.textMuted },
  categoryDesc: { fontSize: 12, color: Colors.textSecondary },
  // Drill list
  drillList: { gap: 10 },
  drillCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16, gap: 12,
  },
  drillAccent: { width: 3, height: 36, borderRadius: 2 },
  drillCardContent: { flex: 1 },
  drillCardName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  drillCardSummary: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17, marginBottom: 8 },
  drillCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  drillCardCategory: { fontSize: 11, color: Colors.textMuted },
  drillCardDuration: { fontSize: 11, color: Colors.textMuted },
  smallBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  smallBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  categoryDrillCount: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },
  noResults: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingTop: 40 },
  // Detail header
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 8, paddingBottom: 16,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  detailHeaderTitle: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  // Detail view
  detailName: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginBottom: 14, lineHeight: 34 },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  diffBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  diffBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  detailDuration: { fontSize: 13, color: Colors.textSecondary },
  detailEquip: { fontSize: 13, color: Colors.textMuted },
  detailSummary: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22, marginBottom: 28 },
  detailSection: {
    backgroundColor: Colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 20, marginBottom: 14,
  },
  detailSectionTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 16,
  },
  stepRow: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  stepNumber: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumberText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  stepText: { flex: 1, fontSize: 14, color: Colors.textPrimary, lineHeight: 21 },
  bulletRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },
});
