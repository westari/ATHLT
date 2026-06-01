/**
 * athlt-camera — JS bridge for the ATHLTCamera native module.
 *
 * requireNativeModule is wrapped in try/catch so the module never crashes
 * if the native side isn't linked (Expo Go, wrong build, etc.).
 * All exported functions degrade gracefully and return error objects.
 */

import { requireNativeModule, EventEmitter, requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import type { ViewStyle } from 'react-native';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ShotBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShotDetection {
  type: 'make' | 'miss';
  confidence: number;
  timestamp: number;     // ms
  bbox: ShotBBox;
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
  fgPercent: number;
}

// ─── Native module resolution ─────────────────────────────────────────────────
// Wrapped in try/catch: if the native module isn't linked the JS side still
// loads cleanly. All functions return error objects instead of throwing.

let ATHLTCameraNative: Record<string, any> | null = null;
let nativeEmitter: any = null;
let NativeViewManager: any = null;

try {
  ATHLTCameraNative = requireNativeModule('ATHLTCamera');
  nativeEmitter     = new EventEmitter(ATHLTCameraNative as any);
} catch {
  // Module not linked — happens in Expo Go or when a non-native build is used.
  // CameraView.tsx will show the "not linked" placeholder.
}

try {
  NativeViewManager = requireNativeViewManager('ATHLTCameraView');
} catch {
  // View manager also not available — same root cause as above.
}

export const isNativeModuleLinked = () => ATHLTCameraNative !== null;

// ─── Session lifecycle ─────────────────────────────────────────────────────────

export async function startSession(): Promise<StartSessionResult> {
  if (!ATHLTCameraNative) return { success: false, error: 'ATHLTCamera native module not linked. Run EAS build.' };
  return ATHLTCameraNative.startSession();
}

export async function stopSession(): Promise<{ success: boolean }> {
  if (!ATHLTCameraNative) return { success: false };
  return ATHLTCameraNative.stopSession();
}

// ─── Model ────────────────────────────────────────────────────────────────────

export async function loadModel(): Promise<LoadModelResult> {
  if (!ATHLTCameraNative) return { loaded: false, error: 'ATHLTCamera native module not linked.' };
  return ATHLTCameraNative.loadModel();
}

export function isModelLoaded(): boolean {
  if (!ATHLTCameraNative) return false;
  try { return ATHLTCameraNative.isModelLoaded(); } catch { return false; }
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

export async function startTracking(): Promise<void> {
  if (!ATHLTCameraNative) return;
  return ATHLTCameraNative.startTracking();
}

export async function stopTracking(): Promise<SessionStats> {
  if (!ATHLTCameraNative) return { makes: 0, attempts: 0, fgPercent: 0 };
  return ATHLTCameraNative.stopTracking();
}

// ─── Events ───────────────────────────────────────────────────────────────────

type EventSubscription = { remove: () => void };

export function addShotListener(
  callback: (shot: ShotDetection) => void
): EventSubscription {
  if (!nativeEmitter) return { remove: () => {} };
  return nativeEmitter.addListener('onShotDetected', callback);
}

export function addErrorListener(
  callback: (err: { message: string }) => void
): EventSubscription {
  if (!nativeEmitter) return { remove: () => {} };
  return nativeEmitter.addListener('onError', callback);
}

// ─── Native View ──────────────────────────────────────────────────────────────

export interface ATHLTCameraViewProps {
  style?: ViewStyle;
}

/**
 * Renders the live camera preview (AVCaptureVideoPreviewLayer).
 * Returns null if the native module is not linked.
 */
export function ATHLTCameraView(props: ATHLTCameraViewProps): React.ReactElement | null {
  if (!NativeViewManager) return null;
  return React.createElement(NativeViewManager, props);
}
