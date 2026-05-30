import ExpoModulesCore
import CoreML
import Vision

// MARK: - Errors

enum ShotDetectorError: Error, LocalizedError {
  case modelNotFound(String)
  case modelNotLoaded
  case compilationFailed(String)
  case inferenceFailed(String)

  var errorDescription: String? {
    switch self {
    case .modelNotFound(let name):
      return "CoreML model '\(name)' not found in app bundle. Run EAS build with the CoreML config plugin."
    case .modelNotLoaded:
      return "Model not loaded. Call loadModel() before running inference."
    case .compilationFailed(let detail):
      return "Model compilation failed: \(detail)"
    case .inferenceFailed(let detail):
      return "Inference failed: \(detail)"
    }
  }
}

// MARK: - Shared Inference Pipeline

public final class ShotDetectorPipeline {
  public static let shared = ShotDetectorPipeline()

  private var coreMLModel: VNCoreMLModel?
  private(set) var isLoaded = false
  private(set) var modelName = ""

  // Serial queue — VNCoreMLModel / VNRequest are NOT thread-safe.
  // VisionCamera delivers frames on a worklet thread; without serialization,
  // concurrent calls corrupt Vision internal state → EXC_BAD_ACCESS.
  private let inferenceQueue = DispatchQueue(
    label: "com.athlt.shotdetector.inference",
    qos: .userInteractive
  )

  private init() {
    NSLog("[ShotDetector] pipeline singleton created")
  }

  // MARK: loadModel

  func loadModel(named resourceName: String = "best", extension ext: String = "mlpackage") throws -> String {
    NSLog("[ShotDetector] loadModel — searching for %@.mlmodelc", resourceName)

    guard let modelURL = Bundle.main.url(forResource: resourceName, withExtension: "mlmodelc")
                      ?? Bundle.main.url(forResource: resourceName, withExtension: ext) else {
      let bundleContents = (Bundle.main.urls(forResourcesWithExtension: "mlmodelc", subdirectory: nil) ?? [])
        .map { $0.lastPathComponent }.joined(separator: ", ")
      NSLog("[ShotDetector] ERROR: model not found. mlmodelc files in bundle: [%@]", bundleContents)
      throw ShotDetectorError.modelNotFound("\(resourceName).mlmodelc")
    }

    NSLog("[ShotDetector] model URL: %@", modelURL.path)

    let config = MLModelConfiguration()
    config.computeUnits = .all
    NSLog("[ShotDetector] MLModelConfiguration set — computeUnits: all")

    let mlModel: MLModel
    do {
      mlModel = try MLModel(contentsOf: modelURL, configuration: config)
      NSLog("[ShotDetector] MLModel loaded OK")
    } catch {
      NSLog("[ShotDetector] MLModel load FAILED: %@", error.localizedDescription)
      throw ShotDetectorError.compilationFailed(error.localizedDescription)
    }

    do {
      coreMLModel = try VNCoreMLModel(for: mlModel)
      NSLog("[ShotDetector] VNCoreMLModel wrapped OK")
    } catch {
      NSLog("[ShotDetector] VNCoreMLModel wrap FAILED: %@", error.localizedDescription)
      throw ShotDetectorError.compilationFailed(error.localizedDescription)
    }

    isLoaded = true
    modelName = "\(resourceName).\(ext)"
    NSLog("[ShotDetector] model ready — modelName: %@", modelName)
    return modelName
  }

  // MARK: runInference

  /// Runs synchronous CoreML inference on a CVPixelBuffer.
  ///
  /// Serialized through inferenceQueue — caller (VisionCamera worklet thread) blocks
  /// until inference completes. Frame throttling in ShotDetectorFrameProcessor ensures
  /// this happens at most every 3rd frame (~10fps) so the worklet thread is never
  /// blocked for more than one inference window.
  ///
  /// Orientation: .right tells Vision the image top points right — correct for
  /// the iPhone rear camera delivering portrait-captured frames. For landscape-locked
  /// sessions the actual correct value may be .up; .right is the safe default that
  /// prevents a 90° sideways YOLO input.
  func runInference(on pixelBuffer: CVPixelBuffer, minConfidence: Float = 0.35) throws -> [[String: Any]] {
    NSLog("[ShotDetector] runInference enter — isLoaded: %d", isLoaded ? 1 : 0)

    guard isLoaded else {
      NSLog("[ShotDetector] runInference bailing — model not loaded")
      throw ShotDetectorError.modelNotLoaded
    }

    var result: [[String: Any]] = []
    var thrownError: Error? = nil

    NSLog("[ShotDetector] entering inferenceQueue.sync")

    inferenceQueue.sync {
      NSLog("[ShotDetector] inferenceQueue executing")

      guard let model = coreMLModel else {
        NSLog("[ShotDetector] coreMLModel is nil inside sync — bailing")
        thrownError = ShotDetectorError.modelNotLoaded
        return
      }

      // Lock pixel buffer so VisionCamera cannot recycle it mid-inference
      NSLog("[ShotDetector] locking pixelBuffer — format: %u, size: %dx%d",
            CVPixelBufferGetPixelFormatType(pixelBuffer),
            CVPixelBufferGetWidth(pixelBuffer),
            CVPixelBufferGetHeight(pixelBuffer))
      CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
      defer {
        CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly)
        NSLog("[ShotDetector] pixelBuffer unlocked")
      }

      // Create request each time — VNRequest is not reusable across calls
      NSLog("[ShotDetector] creating VNCoreMLRequest")
      let request = VNCoreMLRequest(model: model)
      request.imageCropAndScaleOption = .scaleFit

      // .right: Vision orientation describing "top of image points to the right"
      // This is the standard iPhone rear camera portrait-capture orientation.
      // For landscape-locked sessions, try changing to .up if detections are rotated.
      NSLog("[ShotDetector] creating VNImageRequestHandler with orientation .right")
      let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .right, options: [:])

      NSLog("[ShotDetector] calling handler.perform")
      do {
        try handler.perform([request])
        NSLog("[ShotDetector] handler.perform succeeded")
      } catch {
        NSLog("[ShotDetector] handler.perform FAILED: %@", error.localizedDescription)
        thrownError = ShotDetectorError.inferenceFailed(error.localizedDescription)
        return
      }

      NSLog("[ShotDetector] casting results to [VNRecognizedObjectObservation]")
      guard let observations = request.results as? [VNRecognizedObjectObservation] else {
        NSLog("[ShotDetector] results cast returned nil — raw type: %@",
              String(describing: type(of: request.results)))
        result = []
        return
      }

      NSLog("[ShotDetector] raw observations count: %d", observations.count)

      result = observations.compactMap { obs -> [String: Any]? in
        guard let label = obs.labels.first, label.confidence >= minConfidence else {
          return nil
        }
        let bb = obs.boundingBox
        return [
          "className":  label.identifier,
          "confidence": Double(label.confidence),
          "bbox": [
            "x":      Double(bb.origin.x),
            "y":      Double(1.0 - bb.origin.y - bb.size.height),
            "width":  Double(bb.size.width),
            "height": Double(bb.size.height),
          ]
        ]
      }

      NSLog("[ShotDetector] filtered detections (conf >= %.2f): %d", minConfidence, result.count)
    }

    NSLog("[ShotDetector] inferenceQueue.sync returned — thrownError: %@",
          thrownError?.localizedDescription ?? "none")

    if let err = thrownError { throw err }
    NSLog("[ShotDetector] runInference returning %d detections", result.count)
    return result
  }
}

// MARK: - Expo Module

public class ShotDetectorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ShotDetector")

    AsyncFunction("loadModel") { () -> [String: Any] in
      do {
        let name = try ShotDetectorPipeline.shared.loadModel()
        return ["loaded": true, "modelName": name]
      } catch {
        NSLog("[ShotDetector] loadModel JS call failed: %@", error.localizedDescription)
        return ["loaded": false, "modelName": "", "error": error.localizedDescription]
      }
    }

    Function("isLoaded") { () -> Bool in
      return ShotDetectorPipeline.shared.isLoaded
    }

    Function("getModelName") { () -> String in
      return ShotDetectorPipeline.shared.modelName
    }
  }
}
