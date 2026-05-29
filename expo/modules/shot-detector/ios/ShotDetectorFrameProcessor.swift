import VisionCamera
import CoreMedia

/// VisionCamera v5 frame processor plugin — runs YOLOv11n inference per frame.
///
/// Registered as "detectShots" via ShotDetectorFrameProcessorRegister.m (+load).
///
/// Return shape:
///   {
///     detections:  Array<{ className, confidence, bbox: { x, y, width, height } }>,
///     timestampMs: number,
///     frameWidth:  number,
///     frameHeight: number,
///   }

@objc(ShotDetectorFrameProcessor)
public class ShotDetectorFrameProcessor: FrameProcessorPlugin {

  // MARK: - Init

  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
    super.init(proxy: proxy, options: options)
    NSLog("[ShotDetectorFP] plugin initialized")
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

    // Guard: model must be loaded before attempting inference
    guard ShotDetectorPipeline.shared.isLoaded else {
      // Log once so device console confirms the plugin is firing but model isn't ready
      NSLog("[ShotDetectorFP] frame arrived but model not loaded yet — skipping")
      return emptyResult(ts: timestampMs, w: frameWidth, h: frameHeight)
    }

    // Parse optional minConfidence argument (default 0.35)
    let minConfidence: Float
    if let args = arguments, let mc = args["minConfidence"] as? NSNumber {
      minConfidence = mc.floatValue
    } else {
      minConfidence = 0.35
    }

    // Extract CVPixelBuffer — guard prevents crash if buffer is invalid
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(buffer) else {
      NSLog("[ShotDetectorFP] CMSampleBufferGetImageBuffer returned nil — skipping frame")
      return emptyResult(ts: timestampMs, w: frameWidth, h: frameHeight)
    }

    // Run inference through the serial-queue-protected pipeline.
    // Any errors are caught here; the frame processor must never throw.
    let detections: [[String: Any]]
    do {
      detections = try ShotDetectorPipeline.shared.runInference(
        on: pixelBuffer,
        minConfidence: minConfidence
      )
    } catch {
      NSLog("[ShotDetectorFP] runInference error: %@", error.localizedDescription)
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
