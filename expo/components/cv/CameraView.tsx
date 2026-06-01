/**
 * CVCameraView — live camera feed with shot tracking.
 *
 * Uses react-native-vision-camera v4 for camera preview.
 * Shot detection runs via a 500ms polling interval (snapshot-based) rather
 * than a frame processor — see cv/CRASH-RESOLUTION.md for why.
 *
 * Frame processors crash on this device (VisionCamera v4 + worklets-core +
 * New Architecture + Expo SDK 54). Removing the frame processor entirely
 * fixes the crash. The polling interval calls tracker.processFrame() as a
 * stub; replace with real CoreML inference once Apple Dev + EAS build is live.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import Colors from '@/constants/colors';
import ShotOverlay from './ShotOverlay';
import { ShotTracker, type ShotEvent } from '@/lib/cv/ShotTracker';
import { loadModel } from '@/modules/shot-detector';

// VisionCamera imports — guarded so the file compiles before the package is installed.
// NOTE: useFrameProcessor and Worklets are intentionally NOT imported.
// See cv/CRASH-RESOLUTION.md — frame processors crash with this SDK configuration.
let Camera: any = null;
let useCameraDevice: any = null;
let useCameraPermission: any = null;

try {
  const VC       = require('react-native-vision-camera');
  Camera         = VC.Camera;
  useCameraDevice     = VC.useCameraDevice;
  useCameraPermission = VC.useCameraPermission;
} catch {
  // VisionCamera not yet installed — placeholder renders in dev
}

interface Props {
  tracker: ShotTracker;
  active: boolean;
  onShotDetected: (event: ShotEvent) => void;
  onCameraReady?: () => void;
}

type ModelState = 'loading' | 'ready' | 'error';

export default function CVCameraView({ tracker, active, onShotDetected, onCameraReady }: Props) {
  const [modelState, setModelState]   = useState<ModelState>('loading');
  const [modelError, setModelError]   = useState<string>('');
  const [showDebugBoxes, setShowDebugBoxes] = useState(false);
  // Brief settle after model load — ensures camera is fully initialized before polling starts.
  const [inferenceEnabled, setInferenceEnabled] = useState(false);

  const activeRef   = useRef(active);
  activeRef.current = active;
  const cameraRef   = useRef<any>(null);

  const hasCameraPackage = Camera !== null;

  // Always call these hooks (conditional logic is inside the ternary, not the call itself —
  // hasCameraPackage is a module-load-time constant that never changes).
  const { hasPermission, requestPermission } = hasCameraPackage
    ? useCameraPermission()
    : { hasPermission: false, requestPermission: async () => false };

  const device = hasCameraPackage
    ? useCameraDevice('back')
    : null;

  // Load CoreML model on mount
  useEffect(() => {
    let cancelled = false;
    loadModel().then((result: { loaded: boolean; error?: string }) => {
      if (cancelled) return;
      if (result.loaded) {
        setModelState('ready');
        onCameraReady?.();
        // 500ms settle: camera and CoreML runtime must both be initialized before polling.
        setTimeout(() => { if (!cancelled) setInferenceEnabled(true); }, 500);
      } else {
        setModelState('error');
        setModelError(result.error ?? 'Unknown error');
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Wire tracker.onShot → JS callback to parent screen
  useEffect(() => {
    tracker.onShot = (event: ShotEvent) => { onShotDetected(event); };
    return () => { tracker.onShot = null; };
  }, [tracker, onShotDetected]);

  // Polling loop — replaces the frame processor that was crashing.
  //
  // Currently a stub: calls processFrame with empty detections (no CoreML yet).
  // To enable real inference:
  //   1. const snap = await cameraRef.current.takeSnapshot({ quality: 30, skipMetadata: true });
  //   2. const dets = await detectShotsFromFile(snap.path);   ← new Swift function (future)
  //   3. tracker.processFrame(dets, Date.now());
  useEffect(() => {
    if (!active || !inferenceEnabled || !hasCameraPackage) return;
    const id = setInterval(() => {
      if (!activeRef.current) return;
      tracker.processFrame([], Date.now());
    }, 500);
    return () => clearInterval(id);
  }, [active, inferenceEnabled, hasCameraPackage, tracker]);

  // ---- Render states ----

  if (!hasCameraPackage) {
    return (
      <PlaceholderView
        reason="VisionCamera not installed"
        detail="npm install react-native-vision-camera@4 --legacy-peer-deps --save"
      />
    );
  }

  if (!hasPermission) {
    return (
      <PlaceholderView
        reason="Camera permission needed"
        detail="Tap to grant camera access"
        onPress={requestPermission}
      />
    );
  }

  if (!device) {
    return <PlaceholderView reason="No back camera found" />;
  }

  if (modelState === 'loading') {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading shot detection model…</Text>
      </View>
    );
  }

  if (modelState === 'error') {
    return (
      <PlaceholderView
        reason="Model not loaded"
        detail={modelError || 'best.mlpackage not found. Run Colab training + EAS build.'}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
      />
      <ShotOverlay
        detections={[]}
        showDebugBoxes={showDebugBoxes}
      />
      {/* Long-press anywhere to toggle debug bounding boxes */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        onLongPress={() => setShowDebugBoxes(prev => !prev)}
        activeOpacity={1}
      />
    </View>
  );
}

// ---- Placeholder for unavailable states ----

function PlaceholderView({
  reason,
  detail,
  onPress,
}: {
  reason: string;
  detail?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.placeholder}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
    >
      <View style={styles.placeholderIcon}>
        <Text style={styles.placeholderIconText}>CAM</Text>
      </View>
      <Text style={styles.placeholderReason}>{reason}</Text>
      {detail && <Text style={styles.placeholderDetail}>{detail}</Text>}
      {onPress && <Text style={styles.placeholderCta}>Tap to continue</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  placeholderIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 160, 23, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 160, 23, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  placeholderIconText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  placeholderReason: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  placeholderDetail: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  placeholderCta: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
});
