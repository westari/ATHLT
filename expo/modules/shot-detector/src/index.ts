/**
 * JS bindings for the ShotDetector native module.
 *
 * The native module exposes two things:
 *  1. ShotDetectorModule — Expo native module with loadModel() for startup init
 *  2. detectShots — VisionCamera frame processor plugin for per-frame inference
 *
 * Usage:
 *   import { loadModel, detectShots } from '@/modules/shot-detector';
 *
 *   // At app startup (e.g., in _layout.tsx or when CV session starts):
 *   const result = await loadModel();
 *
 *   // Inside a VisionCamera useFrameProcessor:
 *   const frameProcessor = useFrameProcessor((frame) => {
 *     'worklet';
 *     const result = detectShots(frame, { minConfidence: 0.35 });
 *     onResult(result.detections);
 *   }, []);
 */

import { requireNativeModule, requireOptionalNativeModule } from 'expo-modules-core';
import type { ModelLoadResult, Detection, FrameProcessorResult, FrameProcessorArgs } from './ShotDetector.types';

// ---- Native Module (Expo Modules API) ----
// Gracefully no-ops when the native module isn't compiled in (Expo Go, web).

const ShotDetectorNative = requireOptionalNativeModule<{
  loadModel(): Promise<ModelLoadResult>;
}>('ShotDetector');

/**
 * Load the CoreML model into memory. Call this once before starting any CV
 * session. The model is bundled via the withCoreMLModel config plugin.
 *
 * Returns { loaded: true } on success, { loaded: false, error: '...' } on failure.
 * On platforms without the native module (Expo Go, web), returns a stub result.
 */
export async function loadModel(): Promise<ModelLoadResult> {
  if (!ShotDetectorNative) {
    console.warn('[ShotDetector] Native module not available. Running in stub mode.');
    return { loaded: false, modelName: 'stub', error: 'Native module not compiled in. Use EAS dev client build.' };
  }
  try {
    return await ShotDetectorNative.loadModel();
  } catch (e: any) {
    return { loaded: false, modelName: 'unknown', error: e?.message ?? String(e) };
  }
}

// ---- Frame Processor Plugin (VisionCamera) ----
// The `detectShots` function is registered as a VisionCamera frame processor
// plugin in ShotDetectorFrameProcessor.swift. It runs synchronously on the
// VisionCamera JS-Runtime thread (not main thread, not UI thread).
//
// The `plugin()` import from 'react-native-vision-camera' creates a worklet-
// compatible function reference backed by the native Swift implementation.

let _detectShots: ((frame: any, args?: FrameProcessorArgs) => FrameProcessorResult) | null = null;

try {
  // Only import if VisionCamera is installed
  const VisionCamera = require('react-native-vision-camera');
  if (VisionCamera.VisionCameraProxy) {
    _detectShots = VisionCamera.VisionCameraProxy.initFrameProcessorPlugin('detectShots', {});
  }
} catch {
  // VisionCamera not installed yet — this is fine, will be installed before EAS build
}

/**
 * VisionCamera frame processor plugin.
 *
 * Must be called inside a `useFrameProcessor` worklet:
 *   const frameProcessor = useFrameProcessor((frame) => {
 *     'worklet';
 *     const result = detectShots(frame, { minConfidence: 0.4 });
 *     ...
 *   }, []);
 *
 * Returns detections array + frame metadata.
 * Returns empty detections when the model is not loaded or plugin is unavailable.
 */
export function detectShots(frame: any, args?: FrameProcessorArgs): FrameProcessorResult {
  'worklet';
  if (_detectShots == null) {
    return { detections: [], timestampMs: 0, frameWidth: 0, frameHeight: 0 };
  }
  return _detectShots(frame, args) as FrameProcessorResult;
}

export type { ModelLoadResult, Detection, FrameProcessorResult, FrameProcessorArgs };
export type { DetectionClassName, BBox, InferenceResult } from './ShotDetector.types';
