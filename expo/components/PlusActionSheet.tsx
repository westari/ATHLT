import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Platform, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Camera, Video, ClipboardList, MessageSquare, Film, BookOpen,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
};

// 2×2 grid — primary actions
const GRID_ACTIONS = [
  {
    icon: Camera,
    iconBg: Colors.primarySoft,
    iconColor: Colors.primary,
    title: 'Free Record',
    route: '/open-run',
    disabled: false,
  },
  {
    icon: Video,
    iconBg: Colors.inkA8,
    iconColor: Colors.textMuted,
    title: 'Record Game',
    route: null,
    disabled: true,
    soon: true,
  },
  {
    icon: ClipboardList,
    iconBg: Colors.primarySoft,
    iconColor: Colors.primary,
    title: 'Log a Game',
    route: '/log-game',
    disabled: false,
  },
  {
    icon: MessageSquare,
    iconBg: Colors.primarySoft,
    iconColor: Colors.primary,
    title: 'Ask Coach',
    route: '/coachx',
    disabled: false,
  },
] as const;

// Bottom list — secondary actions
const LIST_ACTIONS = [
  {
    icon: Film,
    iconBg: Colors.inkA8,
    iconColor: Colors.textSecondary,
    title: 'Upload Film',
    route: '/(tabs)/film',
  },
  {
    icon: BookOpen,
    iconBg: Colors.inkA8,
    iconColor: Colors.textSecondary,
    title: 'View Library',
    route: '/(tabs)/library',
  },
] as const;

const CARD_GAP = 10;
const SHEET_PAD = 16;

export default function PlusActionSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleNav = (path: string) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    setTimeout(() => router.push(path as any), 160);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Fully transparent backdrop — no dimming, no blur, content behind is unchanged */}
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheetWrap} onPress={e => e.stopPropagation()}>
          <View style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>

            {/* Drag handle */}
            <View style={s.handle} />

            {/* 2×2 grid */}
            <View style={s.gridRow}>
              {GRID_ACTIONS.slice(0, 2).map(action => (
                <GridCard key={action.title} action={action} onNav={handleNav} />
              ))}
            </View>
            <View style={[s.gridRow, { marginTop: CARD_GAP }]}>
              {GRID_ACTIONS.slice(2, 4).map(action => (
                <GridCard key={action.title} action={action} onNav={handleNav} />
              ))}
            </View>

            {/* Secondary list */}
            <View style={s.listSection}>
              {LIST_ACTIONS.map((action, i) => {
                const Icon = action.icon;
                const isLast = i === LIST_ACTIONS.length - 1;
                return (
                  <React.Fragment key={action.title}>
                    <TouchableOpacity
                      style={s.listRow}
                      onPress={() => handleNav(action.route)}
                      activeOpacity={0.75}
                    >
                      <View style={[s.listIcon, { backgroundColor: action.iconBg }]}>
                        <Icon size={17} color={action.iconColor} />
                      </View>
                      <Text style={s.listTitle}>{action.title}</Text>
                    </TouchableOpacity>
                    {!isLast && <View style={s.listDivider} />}
                  </React.Fragment>
                );
              })}
            </View>

            {/* Cancel */}
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>

          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function GridCard({
  action,
  onNav,
}: {
  action: typeof GRID_ACTIONS[number];
  onNav: (path: string) => void;
}) {
  const Icon = action.icon;
  return (
    <TouchableOpacity
      style={[s.gridCard, action.disabled && s.gridCardDisabled]}
      onPress={() => { if (!action.disabled && action.route) onNav(action.route); }}
      activeOpacity={action.disabled ? 1 : 0.78}
      disabled={action.disabled}
    >
      <View style={[s.gridIconCircle, { backgroundColor: action.iconBg }]}>
        <Icon size={24} color={action.iconColor} />
      </View>
      <Text style={[s.gridTitle, action.disabled && s.gridTitleDisabled]}>
        {action.title}
      </Text>
      {'soon' in action && action.soon && (
        <View style={s.soonBadge}>
          <Text style={s.soonText}>Soon</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  // Fully transparent — nothing dims/blurs behind the sheet
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    // Shadow lifts the sheet visually without dimming the background
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 24,
  },
  sheet: {
    backgroundColor: Colors.background,
    paddingTop: 10,
    paddingHorizontal: SHEET_PAD,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },

  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.inkA24,
    alignSelf: 'center',
    marginBottom: 18,
  },

  // ---- 2×2 grid ----
  gridRow: {
    flexDirection: 'row',
    gap: CARD_GAP,
  },
  gridCard: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    position: 'relative',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  gridCardDisabled: {
    opacity: 0.55,
  },
  gridIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  gridTitle: {
    fontSize: 14, fontWeight: '600', color: Colors.textPrimary,
    textAlign: 'center', letterSpacing: -0.2,
  },
  gridTitleDisabled: {
    color: Colors.textMuted,
  },
  soonBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: Colors.inkA8,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100,
  },
  soonText: {
    fontSize: 10, fontWeight: '500', color: Colors.textMuted,
  },

  // ---- Secondary list ----
  listSection: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.hairline,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  listDivider: {
    height: 1, backgroundColor: Colors.hairline, marginLeft: 60,
  },
  listIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  listTitle: {
    fontSize: 15, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.2,
  },

  // ---- Cancel ----
  cancelBtn: {
    backgroundColor: Colors.surface,
    borderRadius: 18, paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1, borderColor: Colors.hairline,
  },
  cancelText: {
    fontSize: 16, fontWeight: '600', color: Colors.textSecondary, letterSpacing: -0.2,
  },
});
