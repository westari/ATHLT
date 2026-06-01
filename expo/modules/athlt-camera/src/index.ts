/**
 * athlt-camera — JS bridge for the ATHLTCamera native module.
 *
 * The native side owns:
 *   - AVCaptureSession (camera capture + preview)
 *   - CoreML inference (YOLO model, ~5fps)
 *   - Shot detection state machine (make/miss logic)
 *
 * The JS side just:
 *   - Calls startSession / loadModel / startTracking / stopTracking
 *   - Subscribes to onShotDetected events
 *   - Renders ATHLTCameraView for the live preview
 */

import { requireNativeModule, EventEmitter, requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import type { ViewStyle } from 'react-native';

// ─── Types (defined first so they can be used in EventEmitter generic) ─────────

export interface ShotBBox {
  x: number;       // normalized 0..1, origin top-left
  y: number;
  width: number;
  height: number;
}

export interface ShotDetection {
  type: 'make' | 'miss';
  confidence: number;    // 0..1
  timestamp: number;     // ms since reference date
  bbox: ShotBBox;
  /** Running totals emitted with every shot so JS doesn't have to count. */
  makes: number;
  attempts: number;
}

export interface StartSessionResult {
  success: boolean;
  error?: string;
}

export interface LoadModelResult {
  loaded: boolean;
  modelName?: string;
  error?: string;
}

export interface SessionStats {
  makes: number;
  attempts: number;
  /** 0–100, integer */
  fgPercent: number;
}

// ─── Native module + typed emitter ────────────────────────────────────────────

const ATHLTCameraNative = requireNativeModule('ATHLTCamera');

// expo-modules-core EventEmitter generic constraint varies by version.
// Cast to any to bypass the opaque type — runtime behaviour is correct.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emitter = new EventEmitter(ATHLTCameraNative as any) as any;

// ─── Session lifecycle ─────────────────────────────────────────────────────────

/**
 * Initialize AVCaptureSession + request camera permission.
 * Call once when the screen mounts. The native preview starts showing
 * as soon as this resolves (permission granted, session running).
 */
export async function startSession(): Promise<StartSessionResult> {
  return ATHLTCameraNative.startSession();
}

/**
 * Tear down AVCaptureSession. Call on unmount.
 */
export async function stopSession(): Promise<{ success: boolean }> {
  return ATHLTCameraNative.stopSession();
}

// ─── Model ────────────────────────────────────────────────────────────────────

/**
 * Load best.mlmodelc from the app bundle.
 * Call after startSession() resolves. Loading takes 0.5–2s.
 */
export async function loadModel(): Promise<LoadModelResult> {
  return ATHLTCameraNative.loadModel();
}

/** Synchronous check — useful for guards before calling startTracking. */
export function isModelLoaded(): boolean {
  return ATHLTCameraNative.isModelLoaded();
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

/**
 * Start shot tracking. Inference fires at ~5fps.
 * Resets internal make/miss counters.
 */
export async function startTracking(): Promise<void> {
  return ATHLTCameraNative.startTracking();
}

/**
 * Stop tracking. Returns final session stats.
 * Camera preview keeps running — call stopSession() separately on unmount.
 */
export async function stopTracking(): Promise<SessionStats> {
  return ATHLTCameraNative.stopTracking();
}

// ─── Events ───────────────────────────────────────────────────────────────────

/**
 * Subscribe to shot detection events.
 * Returns an EventSubscription — call .remove() on cleanup.
 *
 * @example
 * useEffect(() => {
 *   const sub = addShotListener(shot => {
 *     console.log(shot.type, shot.makes, shot.attempts);
 *   });
 *   return () => sub.remove();
 * }, []);
 */
export function addShotListener(callback: (shot: ShotDetection) => void) {
  return emitter.addListener('onShotDetected', callback);
}

export function addErrorListener(callback: (err: { message: string }) => void) {
  return emitter.addListener('onError', callback);
}

// ─── Native View ──────────────────────────────────────────────────────────────

const NativeATHLTCameraView = requireNativeViewManager('ATHLTCameraView');

export interface ATHLTCameraViewProps {
  style?: ViewStyle;
}

/**
 * Renders the live camera preview (AVCaptureVideoPreviewLayer).
 * Active as soon as startSession() resolves.
 * Place this as a full-screen flex:1 view behind your HUD overlays.
 */
export function ATHLTCameraView(props: ATHLTCameraViewProps) {
  return React.createElement(NativeATHLTCameraView, props);
}
