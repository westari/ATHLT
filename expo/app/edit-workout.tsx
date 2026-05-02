import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView,
  Modal, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Trash2, Plus, RotateCcw, Search, X, Check, GripVertical,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePlanStore } from '@/store/planStore';
import { resolvePlanDrill } from '@/lib/resolveDrill';
import { ALL_DRILLS, DRILL_CATEGORIES, type Drill } from '@/constants/drillLibrary';

type EditMode = 'list' | 'addDrill';

export default function EditWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { plan, currentDayIndex, setPlan } = usePlanStore();

  const [mode, setMode] = useState<EditMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [hasChanges, setHasChanges] = useState(false);
  // Holds the previous drills array right before "Start over" is pressed,
  // so the user can undo and bring everything back.
  const [undoStack, setUndoStack] = useState<any[] | null>(null);

  const day = plan?.days?.[currentDayIndex];
  const planDrills = day?.drills || [];

  const resolvedDrills = useMemo(
    () => planDrills.map(d => resolvePlanDrill(d)).filter(Boolean),
    [planDrills]
  );

  // ===== Filter the library for the "add drill" modal =====
  const filteredLibrary = useMemo(() => {
    let drills: Drill[] = ALL_DRILLS;
    if (selectedCategory !== 'All') {
      drills = drills.filter(d => d.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      drills = drills.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q)
      );
    }
    return drills;
  }, [searchQuery, selectedCategory]);

  // ===== Update plan drills helper =====
  const updateDrills = (newDrills: any[]) => {
    if (!plan) return;
    const updatedDays = plan.days.map((d, i) =>
      i === currentDayIndex ? { ...d, drills: newDrills } : d
    );
    setPlan({ ...plan, days: updatedDays });
    setHasChanges(true);
  };

  // ===== Remove drill =====
  const handleRemoveDrill = (index: number) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newDrills = planDrills.filter((_, i) => i !== index);
    updateDrills(newDrills);
  };

  // ===== Add drill from library =====
  const handleAddDrill = (drill: Drill) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newDrill = {
      drillId: drill.id,
      time: `${drill.duration} min`,
    };
    updateDrills([...planDrills, newDrill]);
    setUndoStack(null); // Clear undo — they're building new
    setMode('list');
    setSearchQuery('');
    setSelectedCategory('All');
  };

  // ===== Rebuild from scratch =====
  const handleRebuildFromScratch = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Save the current drills so we can undo
    setUndoStack([...planDrills]);
    updateDrills([]);
  };

  // ===== Undo "Start over" =====
  const handleUndo = () => {
    if (!undoStack) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateDrills(undoStack);
    setUndoStack(null);
  };

  // ===== Reorder drill (move up) =====
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newDrills = [...planDrills];
    [newDrills[index - 1], newDrills[index]] = [newDrills[index], newDrills[index - 1]];
    updateDrills(newDrills);
  };

  // ===== Done =====
  const handleDone = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.back();
  };

  if (!plan || !day) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>No plan to edit</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ===== Header ===== */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleDone} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit workout</Text>
        <TouchableOpacity onPress={handleDone} style={styles.doneBtn}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        {/* ===== Day info ===== */}
        <View style={styles.dayInfo}>
          <Text style={styles.dayLabel}>{day.day.toUpperCase()} · {day.focus}</Text>
          <Text style={styles.dayHint}>
            Add or remove drills, reorder, or start over.
          </Text>
        </View>

        {/* ===== Quick actions ===== */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => setMode('addDrill')}
            activeOpacity={0.8}
          >
            <Plus size={20} color={Colors.primary} />
            <Text style={styles.actionLabel}>Add drill</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleRebuildFromScratch}
            activeOpacity={0.8}
          >
            <RotateCcw size={20} color={Colors.primary} />
            <Text style={styles.actionLabel}>Start over</Text>
          </TouchableOpacity>
        </View>

        {/* ===== Undo banner — shown after Start over ===== */}
        {undoStack ? (
          <View style={styles.undoBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.undoBannerTitle}>Cleared your workout</Text>
              <Text style={styles.undoBannerBody}>
                Tap undo to bring those drills back.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.undoBtn}
              onPress={handleUndo}
              activeOpacity={0.7}
            >
              <RotateCcw size={14} color={Colors.primary} />
              <Text style={styles.undoBtnText}>Undo</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ===== Drill list ===== */}
        <View style={styles.drillsSection}>
          <Text style={styles.sectionTitle}>WORKOUT ({resolvedDrills.length})</Text>

          {resolvedDrills.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                No drills yet. Tap "Add drill" to build your workout.
              </Text>
            </View>
          ) : (
            resolvedDrills.map((drill, i) => (
              <View key={i} style={styles.drillCard}>
                <TouchableOpacity
                  onPress={() => handleMoveUp(i)}
                  disabled={i === 0}
                  style={[styles.dragHandle, i === 0 && styles.dragHandleDisabled]}
                  activeOpacity={0.7}
                >
                  <GripVertical size={18} color={i === 0 ? Colors.textMuted : Colors.textSecondary} />
                </TouchableOpacity>

                <View style={styles.drillInfo}>
                  <Text style={styles.drillName} numberOfLines={1}>{drill?.name}</Text>
                  <Text style={styles.drillMeta}>
                    {drill?.category} · {drill?.time}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleRemoveDrill(i)}
                  style={styles.removeBtn}
                  activeOpacity={0.7}
                >
                  <Trash2 size={18} color="#C47A6C" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {hasChanges && (
          <View style={styles.savedNote}>
            <Check size={14} color={Colors.primary} />
            <Text style={styles.savedNoteText}>Changes saved</Text>
          </View>
        )}
      </ScrollView>

      {/* ===== Add Drill Modal ===== */}
      <Modal
        visible={mode === 'addDrill'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMode('list')}
      >
        <View style={[styles.modalContainer, { paddingTop: 12 }]}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMode('list')} style={styles.modalCloseBtn}>
              <X size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add a drill</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Search */}
          <View style={styles.searchWrap}>
            <Search size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search drills..."
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

          {/* Category filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 6, alignItems: 'center' }}
            keyboardShouldPersistTaps="always"
          >
            <TouchableOpacity
              style={[styles.catChip, { marginRight: 8 }, selectedCategory === 'All' && styles.catChipActive]}
              onPress={() => setSelectedCategory('All')}
              activeOpacity={0.6}
            >
              <Text style={[styles.catChipText, selectedCategory === 'All' && styles.catChipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {DRILL_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.name}
                style={[styles.catChip, { marginRight: 8 }, selectedCategory === cat.name && styles.catChipActive]}
                onPress={() => {
                  if (Platform.OS !== 'web') void Haptics.selectionAsync();
                  setSelectedCategory(cat.name);
                }}
                activeOpacity={0.6}
              >
                <Text style={[styles.catChipText, selectedCategory === cat.name && styles.catChipTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Drill list */}
          <ScrollView
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="always"
          >
            {filteredLibrary.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No drills match your search.</Text>
              </View>
            ) : (
              filteredLibrary.map(drill => (
                <TouchableOpacity
                  key={drill.id}
                  style={styles.libraryDrillCard}
                  onPress={() => handleAddDrill(drill)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.libraryDrillName} numberOfLines={1}>{drill.name}</Text>
                    <Text style={styles.libraryDrillMeta}>
                      {drill.category} · {drill.duration}min · {drill.difficulty}
                    </Text>
                    {drill.summary ? (
                      <Text style={styles.libraryDrillSummary} numberOfLines={2}>
                        {drill.summary}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.addIcon}>
                    <Plus size={18} color={Colors.primary} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
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
  doneBtn: {
    paddingHorizontal: 12, paddingVertical: 10,
  },
  doneText: {
    fontSize: 15, fontWeight: '600', color: Colors.primary, letterSpacing: -0.2,
  },

  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: Colors.textMuted },

  dayInfo: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  dayLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.primary,
    letterSpacing: 1.5, marginBottom: 6,
  },
  dayHint: {
    fontSize: 14, color: Colors.textSecondary, lineHeight: 20,
  },

  actionsRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, marginBottom: 24,
  },
  actionCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14,
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 14, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.2,
  },

  drillsSection: { paddingHorizontal: 20 },

  undoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FBF5E2',
    borderWidth: 1, borderColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    marginHorizontal: 20, marginBottom: 16,
  },
  undoBannerTitle: {
    fontSize: 13, fontWeight: '700', color: Colors.primary,
    letterSpacing: -0.2, marginBottom: 2,
  },
  undoBannerBody: {
    fontSize: 12, color: Colors.textSecondary, lineHeight: 16,
  },
  undoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.background,
    borderRadius: 100,
    borderWidth: 1, borderColor: Colors.primary,
  },
  undoBtnText: {
    fontSize: 12, fontWeight: '700', color: Colors.primary, letterSpacing: -0.1,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 10,
  },

  drillCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 8,
  },
  dragHandle: {
    width: 24, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  dragHandleDisabled: { opacity: 0.3 },
  drillInfo: { flex: 1 },
  drillName: {
    fontSize: 14, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.2,
  },
  drillMeta: {
    fontSize: 11, color: Colors.textMuted, marginTop: 2,
  },
  removeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },

  emptyWrap: {
    paddingVertical: 32, alignItems: 'center',
  },
  emptyText: {
    fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19,
  },

  savedNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingTop: 16,
  },
  savedNoteText: {
    fontSize: 12, color: Colors.primary, fontWeight: '600',
  },

  // ===== Modal =====
  modalContainer: {
    flex: 1, backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    justifyContent: 'space-between',
  },
  modalCloseBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.3,
  },

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

  catChip: {
    paddingHorizontal: 14, paddingVertical: 0,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    borderRadius: 100,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catChipActive: {
    backgroundColor: '#1A1A1A', borderColor: '#1A1A1A',
  },
  catChipText: {
    fontSize: 13, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.1,
    lineHeight: 20,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  catChipTextActive: { color: Colors.white },

  libraryDrillCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
  },
  libraryDrillName: {
    fontSize: 15, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.2,
  },
  libraryDrillMeta: {
    fontSize: 11, color: Colors.textMuted, marginTop: 3, textTransform: 'capitalize',
  },
  libraryDrillSummary: {
    fontSize: 12, color: Colors.textSecondary, marginTop: 4, lineHeight: 17,
  },
  addIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FBF5E2', borderWidth: 1, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
