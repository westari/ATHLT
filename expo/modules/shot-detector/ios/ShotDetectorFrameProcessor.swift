import VisionCamera
import CoreMedia

/// VisionCamera v5 frame processor plugin — runs YOLOv11n inference per frame.
///
/// Registered as "detectShots". Call from a JS useFrameProcessor worklet:
///
///   const frameProcessor = useFrameProcessor((frame) => {
///     'worklet';
///     const result = detectShots(frame, { minConfidence: 0.35 });
///     runOnJS(onDetections)(result.detections, result.timestampMs);
///   }, []);
///
/// Return shape:
///   {
///     detections:  Array<{ className, confidence, bbox: { x, y, width, height } }>,
///     timestampMs: number,   // milliseconds since device boot
///     frameWidth:  number,   // pixels
///     frameHeight: number,
///   }
///
/// VisionCamera v5 frame processor API:
///   - Extend FrameProcessorPlugin
///   - Override callback(_:withArguments:) returning Any
///   - Register via FrameProcessorPluginRegistry in a +load ObjC method
///   - Import: import VisionCamera (not react_native_vision_camera)

@objc(ShotDetectorFrameProcessor)
public class ShotDetectorFrameProcessor: FrameProcessorPlugin {

  // MARK: - Init

  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
    super.init(proxy: proxy, options: options)
  }

  // MARK: - Per-frame callback

  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any {
    let buffer: CMSampleBuffer = frame.buffer

    // Timestamp: nanoseconds from CMSampleBuffer → milliseconds
    let pts = CMSampleBufferGetPresentationTimeStamp(buffer)
    let timestampMs: Double = pts.timescale > 0
      ? Double(pts.value) / Double(pts.timescale) * 1000.0
      : Double(Date().timeIntervalSince1970 * 1000.0)

    let frameWidth  = Int(frame.width)
    let frameHeight = Int(frame.height)

    // Parse optional minConfidence argument (default 0.35)
    let minConfidence: Float
    if let args = arguments, let mc = args["minConfidence"] as? NSNumber {
      minConfidence = mc.floatValue
    } else {
      minConfidence = 0.35
    }

    // Extract CVPixelBuffer from CMSampleBuffer
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(buffer) else {
      return emptyResult(ts: timestampMs, w: frameWidth, h: frameHeight)
    }

    // Run YOLOv11n inference via the shared pipeline
    let detections: [[String: Any]]
    do {
      detections = try ShotDetectorPipeline.shared.runInference(
        on: pixelBuffer,
        minConfidence: minConfidence
      )
    } catch {
      // Model not yet loaded or inference error — return empty, don't crash
      return emptyResult(ts: timestampMs, w: frameWidth, h: frameHeight)
    }

    return [
      "detections":  detections,
      "timestampMs": timestampMs,
      "frameWidth":  frameWidth,
      "frameHeight": frameHeight,
    ] as [String: Any]
  }

  // MARK: - Helpers

  private func emptyResult(ts: Double, w: Int, h: Int) -> [String: Any] {
    return [
      "detections":  [] as [[String: Any]],
      "timestampMs": ts,
      "frameWidth":  w,
      "frameHeight": h,
    ]
  }
}

