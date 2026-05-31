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

  // Throttle: only run CoreML inference every Nth frame.
  // At 30fps / skip=3 → ~10 inference calls/sec, ~100ms per inference window.
  private var frameCounter: Int = 0
  private let frameSkip: Int = 3
  private var hasLoggedFirstFrame = false

  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
    super.init(proxy: proxy, options: options)
    NSLog("[ShotDetectorFP] plugin initialized — frameSkip: %d", frameSkip)
  }

  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any {
    let buffer: CMSampleBuffer = frame.buffer

    let pts = CMSampleBufferGetPresentationTimeStamp(buffer)
    let timestampMs: Double = pts.timescale > 0
      ? Double(pts.value) / Double(pts.timescale) * 1000.0
      : Double(Date().timeIntervalSince1970 * 1000.0)

    let frameWidth  = Int(frame.width)
    let frameHeight = Int(frame.height)

    guard let pixelBuffer = CMSampleBufferGetImageBuffer(buffer) else {
      NSLog("[ShotDetectorFP] CMSampleBufferGetImageBuffer nil — skip")
      return emptyResult(ts: timestampMs, w: frameWidth, h: frameHeight)
    }

    if !hasLoggedFirstFrame {
      let fmt = CVPixelBufferGetPixelFormatType(pixelBuffer)
      NSLog("[ShotDetectorFP] first frame — size: %dx%d, pixelFormat: %u (1111970369=BGRA, 875704422=YUV)",
            frameWidth, frameHeight, fmt)
      hasLoggedFirstFrame = true
    }

    frameCounter += 1
    guard frameCounter % frameSkip == 0 else {
      return emptyResult(ts: timestampMs, w: frameWidth, h: frameHeight)
    }

    guard ShotDetectorPipeline.shared.isLoaded else {
      return emptyResult(ts: timestampMs, w: frameWidth, h: frameHeight)
    }

    let minConfidence: Float = {
      if let args = arguments, let mc = args["minConfidence"] as? NSNumber {
        return mc.floatValue
      }
      return 0.35
    }()

    // runInference never throws — returns [] on any error.
    // The app cannot crash from this call.
    let detections = ShotDetectorPipeline.shared.runInference(
      on: pixelBuffer,
      minConfidence: minConfidence
    )

    if detections.count > 0 {
      NSLog("[ShotDetectorFP] frame #%d — %d detections", frameCounter, detections.count)
    }

    return [
      "detections":  detections,
      "timestampMs": timestampMs,
      "frameWidth":  frameWidth,
      "frameHeight": frameHeight,
    ] as [String: Any]
  }

  private func emptyResult(ts: Double, w: Int, h: Int) -> [String: Any] {
    return [
      "detections":  [] as [[String: Any]],
      "timestampMs": ts,
      "frameWidth":  w,
      "frameHeight": h,
    ]
  }
}
