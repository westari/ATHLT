/**
 * CVCameraView — live camera feed with shot tracking.
 *
 * Requires react-native-vision-camera v5 and react-native-worklets-core.
 * See expo/cv/INSTALL.md for setup instructions before using.
 *
 * Props:
 *   onShotDetected  — called on JS thread whenever a make/miss is detected
 *   onSessionEnd    — called when user taps Stop
 *   tracker         — ShotTracker instance shared with the parent screen
 *   active          — whether tracking is currently running
 *
 * The camera is always back-facing and runs at the device's preferred 30fps.
 * The frame processor runs on the VisionCamera JS-Runtime (off main thread).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import Colors from '@/constants/colors';
import ShotOverlay from './ShotOverlay';
import { ShotTracker, type ShotEvent } from '@/lib/cv/ShotTracker';
import { loadModel } from '@/modules/shot-detector';

// VisionCamera v5 imports — guarded so the file compiles before the package is installed
let Camera: any = null;
let useCameraDevice: any = null;
let useCameraPermission: any = null;
let useFrameProcessor: any = null;
let detectShots: any = null;
let Worklets: any = null;

try {
  const VC = require('react-native-vision-camera');
  Camera           = VC.Camera;
  useCameraDevice  = VC.useCameraDevice;
  useCameraPermission = VC.useCameraPermission;
  useFrameProcessor = VC.useFrameProcessor;
  Worklets         = require('react-native-worklets-core').Worklets;
  detectShots      = require('@/modules/shot-detector/src').detectShots;
} catch {
  // VisionCamera not yet installed — show placeholder in dev
}

interface Props {
  tracker: ShotTracker;
  active: boolean;
  onShotDetected: (event: ShotEvent) => void;
  onCameraReady?: () => void;
}

type ModelState = 'loading' | 'ready' | 'error';

export default function CVCameraView({ tracker, active, onShotDetected, onCameraReady }: Props) {
  const [modelState, setModelState] = useState<ModelState>('loading');
  const [modelError, setModelError]  = useState<string>('');
  const [lastShotType, setLastShotType] = useState<'make' | 'miss' | null>(null);
  const [lastDetections, setLastDetections] = useState<any[]>([]);
  const [showDebugBoxes, setShowDebugBoxes] = useState(false);
  const [makes, setMakes]       = useState(0);
  const [totalShots, setTotal]  = useState(0);
  // inferenceEnabled adds a 500ms settle delay after model load before the frame
  // processor fires any inference. This prevents a crash window where the first
  // frame arrives while CoreML is still initialising internal buffers.
  const [inferenceEnabled, setInferenceEnabled] = useState(false);

  // Guards against referencing stale closures in worklet callbacks
  const activeRef = useRef(active);
  activeRef.current = active;

  // Load model on mount
  useEffect(() => {
    let cancelled = false;
    loadModel().then((result) => {
      if (cancelled) return;
      if (result.loaded) {
        setModelState('ready');
        onCameraReady?.();
        // Allow 500ms for the CoreML runtime to fully settle before inference starts.
        setTimeout(() => {
          if (!cancelled) setInferenceEnabled(true);
        }, 500);
      } else {
        setModelState('error');
        setModelError(result.error ?? 'Unknown error');
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Wire tracker.onShot to update UI
  useEffect(() => {
    tracker.onShot = (event: ShotEvent) => {
      setLastShotType(event.type);
      setMakes(tracker.getMakes());
      setTotal(tracker.getTotalShots());
      onShotDetected(event);
    };
    return () => { tracker.onShot = null; };
  }, [tracker, onShotDetected]);

  // ---- VisionCamera hooks ----

  const hasCameraPackage = Camera !== null;

  const { hasPermission, requestPermission } = hasCameraPackage
    ? useCameraPermission()
    : { hasPermission: false, requestPermission: async () => false };

  const device = hasCameraPackage
    ? useCameraDevice('back')
    : null;

  // ---- Worklet diagnostic flag ----
  //
  // NOOP_WORKLET = true: runs a minimal worklet that calls back with empty
  // detections. If this doesn't crash but the real worklet does, the bug is
  // in detectShots / the Swift inference path.
  //
  // NOOP_WORKLET = false: runs real inference.
  //
  // Start with true to confirm VisionCamera frame processor setup works,
  // then flip to false to enable actual CV tracking.
  const NOOP_WORKLET = false;

  // Callback bridging worklet → JS thread.
  // Wrapped so errors in the JS handler never propagate back into the worklet.
  const onDetectionsJS = hasCameraPackage && Worklets
    ? Worklets.createRunOnJS((dets: any[], ts: number) => {
        try {
          if (!activeRef.current) return;
          const safeDets = Array.isArray(dets) ? dets : [];
          setLastDetections(safeDets);
          tracker.processFrame(safeDets, ts);
        } catch {
          // Swallow — JS handler errors must not reach the worklet runtime
        }
      })
    : null;

  const frameProcessor = hasCameraPackage && useFrameProcessor && onDetectionsJS
    ? useFrameProcessor((frame: any) => {
        'worklet';
        try {
          if (NOOP_WORKLET) {
            // Diagnostic no-op: confirms VisionCamera frame processor setup is
            // working. If the app stays stable here but crashes with the real
            // worklet, the issue is in detectShots or the Swift inference layer.
            onDetectionsJS([], 0);
            return;
          }

          // Real inference path
          const result = detectShots(frame, { minConfidence: 0.35 });

          // Defensive null checks — malformed results must not throw in worklet context
          const dets = (result != null && Array.isArray(result.detections))
            ? result.detections
            : [];
          const ts = (result != null && typeof result.timestampMs === 'number')
            ? result.timestampMs
            : 0;

          onDetectionsJS(dets, ts);
        } catch {
          // Worklet try/catch: any exception (including from native detectShots) is
          // caught here. The worklet never crashes the app — it just misses a frame.
          onDetectionsJS([], 0);
        }
      }, [onDetectionsJS])
    : undefined;

  // ---- Render states ----

  if (!hasCameraPackage) {
    return <PlaceholderView reason="VisionCamera not installed" detail="Run: npm install react-native-vision-camera@5.0.10 react-native-worklets-core --legacy-peer-deps" />;
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
        <Text style={styles.loadingText}>Loading shot detection model...</Text>
      </View>
    );
  }

  if (modelState === 'error') {
    return (
      <PlaceholderView
        reason="Model not loaded"
        detail={modelError || 'best.mlpackage not found in bundle. Run Colab training and EAS build.'}
      />
    );
  }

  // Flip to true to test camera without inference (diagnostic only)
  const DISABLE_FRAME_PROCESSOR = false;

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={(DISABLE_FRAME_PROCESSOR || !active || !inferenceEnabled) ? undefined : frameProcessor}
        pixelFormat="rgb"
        fps={30}
      />

      <ShotOverlay
        makes={makes}
        totalShots={totalShots}
        lastShotType={lastShotType}
        detections={lastDetections}
        showDebugBoxes={showDebugBoxes}
      />

      {/* Debug toggle (long-press anywhere on the camera) */}
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
