import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MessageSquare, Dumbbell, ClipboardList } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const ACTIONS = [
  {
    icon: MessageSquare,
    iconBg: Colors.primarySoft,
    iconColor: Colors.primary,
    title: 'Ask Coach',
    sub: 'Chat with your AI coach',
    route: '/coachx',
    accent: true,
  },
  {
    icon: Dumbbell,
    iconBg: Colors.inkA8,
    iconColor: Colors.textPrimary,
    title: 'Build a Workout',
    sub: 'Coach X builds it for you',
    route: '/build-workout',
    accent: false,
  },
  {
    icon: ClipboardList,
    iconBg: Colors.inkA8,
    iconColor: Colors.textPrimary,
    title: 'Log a Game',
    sub: 'Quick stats from your last game',
    route: '/log-game',
    accent: false,
  },
] as const;

export default function PlusActionSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleNav = (path: string) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    setTimeout(() => router.push(path as any), 200);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheetWrap} onPress={e => e.stopPropagation()}>
          <BlurView intensity={60} tint="light" style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>

            {/* Drag handle */}
            <View style={s.handle} />

            {/* Action rows */}
            <View style={s.actions}>
              {ACTIONS.map((action, i) => {
                const Icon = action.icon;
                return (
                  <React.Fragment key={action.route}>
                    <TouchableOpacity
                      style={[s.row, action.accent && s.rowAccent]}
                      onPress={() => handleNav(action.route)}
                      activeOpacity={0.78}
                    >
                      <View style={[s.iconCircle, { backgroundColor: action.iconBg }]}>
                        <Icon size={20} color={action.iconColor} />
                      </View>
                      <View style={s.rowText}>
                        <Text style={s.rowTitle}>{action.title}</Text>
                        <Text style={s.rowSub}>{action.sub}</Text>
                      </View>
                    </TouchableOpacity>
                    {i < ACTIONS.length - 1 && <View style={s.rowDivider} />}
                  </React.Fragment>
                );
              })}
            </View>

            {/* Cancel */}
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>

          </BlurView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,14,18,0.40)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  sheet: {
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.inkA24,
    alignSelf: 'center',
    marginBottom: 20,
  },
  actions: {
    backgroundColor: Colors.paperA88,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.hairline,
    overflow: 'hidden',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, paddingHorizontal: 16,
  },
  rowAccent: {
    backgroundColor: 'rgba(201,162,74,0.07)',
  },
  rowDivider: {
    height: 1, backgroundColor: Colors.hairline, marginLeft: 66,
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: {
    fontSize: 16, fontWeight: '600', color: Colors.textPrimary,
    letterSpacing: -0.2, marginBottom: 2,
  },
  rowSub: { fontSize: 13, color: Colors.textSecondary },

  cancelBtn: {
    backgroundColor: Colors.paperA88,
    borderRadius: 18, paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1, borderColor: Colors.hairline,
  },
  cancelText: {
    fontSize: 16, fontWeight: '600', color: Colors.textSecondary, letterSpacing: -0.2,
  },
});
