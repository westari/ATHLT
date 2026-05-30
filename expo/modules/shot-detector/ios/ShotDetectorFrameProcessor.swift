import VisionCamera
import CoreMedia

/// VisionCamera v4 frame processor plugin — runs YOLOv11n inference per frame.
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

  // MARK: - State

  // Throttle: only run CoreML inference every Nth frame.
  // At 30fps / skip=3 → ~10 inference calls/sec, giving ~100ms per call.
  // This prevents blocking the VisionCamera worklet thread too frequently.
  private var frameCounter: Int = 0
  private let frameSkip: Int = 3

  // Log the first frame once to confirm the plugin is receiving frames
  private var hasLoggedFirstFrame = false

  // MARK: - Init

  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
    super.init(proxy: proxy, options: options)
    NSLog("[ShotDetectorFP] plugin initialized — frameSkip: %d", frameSkip)
  }

  // MARK: - Per-frame callback

  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any {
    let buffer: CMSampleBuffer = frame.buffer

    // Timestamp: CMSampleBuffer presentation time → milliseconds
    let pts = CMSampleBufferGetPresentationTimeStamp(buffer)
    let timestampMs: Double = pts.timescale > 0
      ? Double(pts.value) / Double(pts.timescale) * 1000.0
      : Double(Date().timeIntervalSince1970 * 1000.0)

    let frameWidth  = Int(frame.width)
    let frameHeight = Int(frame.height)

    // Extract pixel buffer early so we can log its format before throttle check
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(buffer) else {
      NSLog("[ShotDetectorFP] CMSampleBufferGetImageBuffer returned nil — skipping frame")
      return emptyResult(ts: timestampMs, w: frameWidth, h: frameHeight)
    }

    // Log first frame to confirm size and pixel format
    if !hasLoggedFirstFrame {
      let fmt = CVPixelBufferGetPixelFormatType(pixelBuffer)
      NSLog("[ShotDetectorFP] first frame — size: %dx%d, pixelFormat: %u (875704422=420YpCbCr8BiPlanar)",
            frameWidth, frameHeight, fmt)
      hasLoggedFirstFrame = true
    }

    // Throttle: skip frames that aren't on the inference boundary
    frameCounter += 1
    guard frameCounter % frameSkip == 0 else {
      return emptyResult(ts: timestampMs, w: frameWidth, h: frameHeight)
    }

    // Model must be loaded before attempting inference
    guard ShotDetectorPipeline.shared.isLoaded else {
      NSLog("[ShotDetectorFP] frame #%d — model not loaded, skipping", frameCounter)
      return emptyResult(ts: timestampMs, w: frameWidth, h: frameHeight)
    }

    // Parse optional minConfidence (default 0.35)
    let minConfidence: Float
    if let args = arguments, let mc = args["minConfidence"] as? NSNumber {
      minConfidence = mc.floatValue
    } else {
      minConfidence = 0.35
    }

    NSLog("[ShotDetectorFP] frame #%d — running inference (conf >= %.2f)", frameCounter, minConfidence)

    // Run inference through the serial-queue-protected pipeline.
    // The worklet thread blocks here until inference completes.
    // Frame throttling (above) ensures this is at most ~10x/sec.
    let detections: [[String: Any]]
    do {
      detections = try ShotDetectorPipeline.shared.runInference(
        on: pixelBuffer,
        minConfidence: minConfidence
      )
      NSLog("[ShotDetectorFP] frame #%d — inference OK, detections: %d", frameCounter, detections.count)
    } catch {
      NSLog("[ShotDetectorFP] frame #%d — runInference error: %@", frameCounter, error.localizedDescription)
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
