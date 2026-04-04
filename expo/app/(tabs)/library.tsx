import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';

const DRILL_CATEGORIES = [
  { name: 'Ball Handling', count: 24, color: Colors.primary, description: 'Crossovers, combos, pressure handling' },
  { name: 'Shooting', count: 31, color: '#B08D57', description: 'Catch & shoot, off dribble, free throws' },
  { name: 'Finishing', count: 18, color: '#C4A46C', description: 'Layups, floaters, euro steps, post moves' },
  { name: 'Defense', count: 15, color: '#C47A6C', description: 'Slides, closeouts, help & recover' },
  { name: 'Speed & Agility', count: 12, color: '#8B9A6B', description: 'Sprints, ladder, cone drills, plyos' },
  { name: 'Warmup & Cooldown', count: 8, color: '#8B9A6B', description: 'Dynamic stretches, mobility, form shots' },
  { name: 'Conditioning', count: 10, color: '#C47A6C', description: 'Suicides, sprints, game-speed finishers' },
  { name: 'Basketball IQ', count: 6, color: Colors.primary, description: 'Read & react, pick & roll reads, spacing' },
];

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Drill Library</Text>
        <Text style={styles.headerSubtitle}>Browse drills by category. Tap any drill in your training plan to see it here.</Text>

        <View style={styles.categoryList}>
          {DRILL_CATEGORIES.map((cat, i) => (
            <TouchableOpacity key={i} style={styles.categoryCard} activeOpacity={0.7}>
              <View style={[styles.categoryAccent, { backgroundColor: cat.color }]} />
              <View style={styles.categoryContent}>
                <View style={styles.categoryTop}>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                  <Text style={styles.categoryCount}>{cat.count} drills</Text>
                </View>
                <Text style={styles.categoryDesc}>{cat.description}</Text>
              </View>
              <ChevronRight size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: 20 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.textPrimary, paddingTop: 16, marginBottom: 8 },
  headerSubtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 24 },
  categoryList: { gap: 10 },
  categoryCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: 16, gap: 14, overflow: 'hidden',
  },
  categoryAccent: { width: 4, height: 40, borderRadius: 2 },
  categoryContent: { flex: 1 },
  categoryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  categoryName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  categoryCount: { fontSize: 12, color: Colors.textMuted },
  categoryDesc: { fontSize: 12, color: Colors.textSecondary },
});
