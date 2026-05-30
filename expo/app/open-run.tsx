/**
 * Open Run — free-form shooting session with live CV tracking.
 * No drill guide, no timer — just track shots as long as the user wants.
 *
 * Route: /open-run
 *
 * NOTE: expo-screen-orientation must be installed before the orientation
 * lock takes effect. Run: npm install expo-screen-orientation --legacy-peer-deps --save
 * Then do an EAS rebuild (native code required).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { X, Play, Square } from 'lucide-react-native';
import Colors from '@/constants/colors';
import CVCameraView from '@/components/cv/CameraView';
import PostSessionRecap from '@/components/cv/PostSessionRecap';
import { ShotTracker, type ShotEvent } from '@/lib/cv/ShotTracker';
import { CVSessionSync, type SessionRecap } from '@/lib/cv/ShotSync';
import { supabase } from '@/constants/supabase';

type SessionPhase = 'idle' | 'tracking' | 'finishing' | 'recap';

export default function OpenRunScreen() {
  const safeInsets = useSafeAreaInsets();
  const router     = useRouter();

  const [phase, setPhase]               = useState<SessionPhase>('idle');
  const [recap, setRecap]               = useState<SessionRecap | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [liveMakes, setLiveMakes]       = useState(0);
  const [liveTotal, setLiveTotal]       = useState(0);

  const tracker = useMemo(() => new ShotTracker(), []);
  const sync    = useMemo(() => new CVSessionSync(), []);

  // Orientation lock — requires expo-screen-orientation + EAS rebuild
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const handleShotDetected = useCallback((event: ShotEvent) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sync.recordShot(event);
    setLiveMakes(tracker.getMakes());
    setLiveTotal(tracker.getTotalShots());
  }, [sync, tracker]);

  const handleStart = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      tracker.reset();
      setLiveMakes(0);
      setLiveTotal(0);
      await sync.start({ sessionType: 'open_run' });
    } catch (e) {
      console.error('[open-run] handleStart error:', e);
    }
    setPhase('tracking');
  };

  const handleStop = async () => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase('finishing');
    setRecapLoading(true);

    try {
      const summary = tracker.getSummary();
      let userId: string | undefined;
      try {
        const authResult = await supabase.auth.getUser();
        userId = authResult.data?.user?.id ?? undefined;
      } catch {
        // no-op
      }
      const sessionRecap = await sync.finish(summary, userId);
      setRecap(sessionRecap);
    } catch (e) {
      console.error('[open-run] handleStop error:', e);
      setRecap(null);
    } finally {
      setRecapLoading(false);
      setPhase('recap');
    }
  };

  // ---- Recap screen ----
  if (phase === 'recap' || phase === 'finishing') {
    const summary = tracker.getSummary();
    return (
      <View style={[styles.full, { paddingTop: safeInsets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <PostSessionRecap
          recap={recap}
          summary={summary}
          loading={recapLoading}
          onDone={() => router.back()}
        />
      </View>
    );
  }

  const isTracking = phase === 'tracking';
  const fgPct = liveTotal > 0 ? ((liveMakes / liveTotal) * 100).toFixed(1) : null;

  // ---- Main tracking screen ----
  return (
    <View style={styles.full}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Camera fills screen — preview always visible, inference gated by isTracking */}
      <CVCameraView
        tracker={tracker}
        active={isTracking}
        onShotDetected={handleShotDetected}
      />

      {/* Top-left: X / back button */}
      <BlurView intensity={40} tint="dark" style={[styles.topLeftBtn, { top: safeInsets.top + 12 }]}>
        <TouchableOpacity
          style={styles.iconBtnInner}
          onPress={() => {
            if (isTracking) void handleStop();
            else router.back();
          }}
          activeOpacity={0.8}
        >
          <X size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </BlurView>

      {/* Top-center: screen title */}
      <View style={[styles.topTitle, { top: safeInsets.top + 14 }]} pointerEvents="none">
        <Text style={styles.topTitleText}>Track Shots</Text>
      </View>

      {/* Top-right: live stat pill (only during tracking) */}
      {isTracking && fgPct !== null && (
        <BlurView intensity={40} tint="dark" style={[styles.statPill, { top: safeInsets.top + 12 }]}>
          <Text style={styles.statPillText}>
            {liveMakes}/{liveTotal} · {fgPct}%
          </Text>
        </BlurView>
      )}

      {/* Bottom: start / stop controls */}
      <View style={[styles.bottomBar, { paddingBottom: safeInsets.bottom + 20 }]}>
        {!isTracking && (
          <>
            <Text style={styles.hint}>Point camera at the hoop. Rim should be fully visible.</Text>
            <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
              <Play size={18} color={Colors.black} fill={Colors.black} />
              <Text style={styles.startBtnText}>Start Tracking</Text>
            </TouchableOpacity>
          </>
        )}

        {isTracking && (
          <BlurView intensity={50} tint="dark" style={styles.stopBtnBlur}>
            <TouchableOpacity style={styles.stopBtnInner} onPress={handleStop} activeOpacity={0.85}>
              <Square size={16} color="#F44336" fill="#F44336" />
              <Text style={styles.stopBtnText}>Stop Session</Text>
            </TouchableOpacity>
          </BlurView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: '#000' },

  topLeftBtn: {
    position: 'absolute', left: 16,
    width: 40, height: 40, borderRadius: 20,
    overflow: 'hidden',
    zIndex: 20,
  },
  iconBtnInner: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },

  topTitle: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center',
    zIndex: 10,
    pointerEvents: 'none' as any,
  },
  topTitleText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15, fontWeight: '600', letterSpacing: -0.2,
  },

  statPill: {
    position: 'absolute', right: 16,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 100, overflow: 'hidden',
    zIndex: 20,
  },
  statPillText: {
    color: '#FFFFFF', fontSize: 13, fontWeight: '700',
    letterSpacing: -0.2, fontVariant: ['tabular-nums'],
  },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', paddingHorizontal: 20, paddingTop: 16,
    gap: 10, zIndex: 20,
  },
  hint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13, textAlign: 'center', lineHeight: 18,
  },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14, paddingHorizontal: 36,
    borderRadius: 100,
  },
  startBtnText: {
    color: Colors.black, fontSize: 16, fontWeight: '700', letterSpacing: -0.3,
  },

  stopBtnBlur: {
    borderRadius: 100, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#F44336',
  },
  stopBtnInner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 32,
  },
  stopBtnText: {
    color: '#F44336', fontSize: 16, fontWeight: '700',
  },
});
