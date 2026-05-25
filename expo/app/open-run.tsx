/**
 * Open Run — free-form shooting session with live CV tracking.
 * No drill guide, no timer — just track shots as long as the user wants.
 *
 * Route: /open-run
 * Added to PlusActionSheet under "Track Shots"
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { X, Play, StopCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import CVCameraView from '@/components/cv/CameraView';
import PostSessionRecap from '@/components/cv/PostSessionRecap';
import { ShotTracker, type ShotEvent } from '@/lib/cv/ShotTracker';
import { CVSessionSync, type SessionRecap } from '@/lib/cv/ShotSync';
import { supabase } from '@/constants/supabase';

type SessionPhase = 'idle' | 'tracking' | 'finishing' | 'recap';

export default function OpenRunScreen() {
  const safeInsets = useSafeAreaInsets();
  const router  = useRouter();

  const [phase, setPhase]     = useState<SessionPhase>('idle');
  const [recap, setRecap]     = useState<SessionRecap | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);

  const tracker = useMemo(() => new ShotTracker(), []);
  const sync    = useMemo(() => new CVSessionSync(), []);

  const handleShotDetected = useCallback((event: ShotEvent) => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sync.recordShot(event);
  }, [sync]);

  const handleStart = async () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    tracker.reset();

    await sync.start({
      sessionType: 'open_run',
    });

    setPhase('tracking');
  };

  const handleStop = async () => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase('finishing');
    setRecapLoading(true);

    const summary = tracker.getSummary();
    const { data: { user } } = await supabase.auth.getUser();

    const sessionRecap = await sync.finish(summary, user?.id);
    setRecap(sessionRecap);
    setRecapLoading(false);
    setPhase('recap');
  };

  const handleDone = () => {
    router.back();
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
          onDone={handleDone}
        />
      </View>
    );
  }

  // ---- Main tracking screen ----
  return (
    <View style={styles.full}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Camera — fills screen */}
      <CVCameraView
        tracker={tracker}
        active={phase === 'tracking'}
        onShotDetected={handleShotDetected}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: safeInsets.top + 8 }]}>
        <TouchableOpacity
          style={styles.topBtn}
          onPress={() => {
            if (phase === 'tracking') {
              handleStop();
            } else {
              router.back();
            }
          }}
          activeOpacity={0.8}
        >
          <X size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.topTitle}>Open Run</Text>

        {/* Stop button (only visible during tracking) */}
        {phase === 'tracking' && (
          <TouchableOpacity
            style={[styles.topBtn, styles.stopBtn]}
            onPress={handleStop}
            activeOpacity={0.8}
          >
            <StopCircle size={18} color="#F44336" />
          </TouchableOpacity>
        )}
        {phase !== 'tracking' && <View style={styles.topBtnPlaceholder} />}
      </View>

      {/* Bottom start/stop controls */}
      <View style={[styles.bottomBar, { paddingBottom: safeInsets.bottom + 16 }]}>
        {phase === 'idle' && (
          <>
            <Text style={styles.hint}>Point camera at the hoop. Rim should be visible.</Text>
            <TouchableOpacity
              style={styles.startBtn}
              onPress={handleStart}
              activeOpacity={0.85}
            >
              <Play size={20} color="#000" fill="#000" />
              <Text style={styles.startBtnText}>Start Tracking</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'tracking' && (
          <TouchableOpacity
            style={styles.stopBtnLarge}
            onPress={handleStop}
            activeOpacity={0.85}
          >
            <StopCircle size={20} color="#FFFFFF" />
            <Text style={styles.stopBtnLargeText}>Stop Session</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  topBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.50)',
    alignItems: 'center', justifyContent: 'center',
  },
  stopBtn: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
  },
  topBtnPlaceholder: { width: 36 },
  topTitle: {
    color: '#FFFFFF',
    fontSize: 16, fontWeight: '700', letterSpacing: -0.3,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    zIndex: 10,
  },
  hint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13, textAlign: 'center', lineHeight: 18,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 100,
  },
  startBtnText: {
    color: '#000',
    fontSize: 16, fontWeight: '800', letterSpacing: -0.3,
  },
  stopBtnLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(244, 67, 54, 0.12)',
    borderWidth: 1.5,
    borderColor: '#F44336',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 100,
  },
  stopBtnLargeText: {
    color: '#F44336',
    fontSize: 16, fontWeight: '700',
  },
});
