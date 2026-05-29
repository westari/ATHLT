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

/// Singleton accessed by both the Expo module (JS loadModel call) and
/// the VisionCamera frame processor plugin (per-frame inference).
public final class ShotDetectorPipeline {
  public static let shared = ShotDetectorPipeline()

  private var coreMLModel: VNCoreMLModel?
  private(set) var isLoaded = false
  private(set) var modelName = ""

  // Serial queue — VNCoreMLModel / VNRequest are NOT thread-safe.
  // Frame processors run on VisionCamera's worklet thread; without serialization
  // concurrent calls corrupt internal Vision state and cause EXC_BAD_ACCESS.
  private let inferenceQueue = DispatchQueue(label: "com.athlt.shotdetector.inference", qos: .userInteractive)

  private init() {
    NSLog("[ShotDetector] pipeline singleton created")
  }

  /// Load the CoreML model from the app bundle.
  ///
  /// Xcode compiles .mlpackage → .mlmodelc at build time, so the bundle
  /// contains best.mlmodelc (not best.mlpackage). We load the compiled
  /// artifact directly — no runtime compilation needed.
  func loadModel(named resourceName: String = "best", extension ext: String = "mlpackage") throws -> String {
    NSLog("[ShotDetector] loadModel called — looking for \(resourceName).mlmodelc")

    guard let modelURL = Bundle.main.url(forResource: resourceName, withExtension: "mlmodelc")
                      ?? Bundle.main.url(forResource: resourceName, withExtension: ext) else {
      NSLog("[ShotDetector] ERROR: model not found in bundle. Contents: %@",
            (Bundle.main.urls(forResourcesWithExtension: "mlmodelc", subdirectory: nil) ?? [])
              .map { $0.lastPathComponent }.joined(separator: ", "))
      throw ShotDetectorError.modelNotFound("\(resourceName).mlmodelc")
    }

    NSLog("[ShotDetector] found model at: %@", modelURL.path)

    let config = MLModelConfiguration()
    config.computeUnits = .all

    let mlModel: MLModel
    do {
      mlModel = try MLModel(contentsOf: modelURL, configuration: config)
      NSLog("[ShotDetector] MLModel loaded OK")
    } catch {
      NSLog("[ShotDetector] MLModel load failed: %@", error.localizedDescription)
      throw ShotDetectorError.compilationFailed(error.localizedDescription)
    }

    do {
      coreMLModel = try VNCoreMLModel(for: mlModel)
      NSLog("[ShotDetector] VNCoreMLModel wrapped OK")
    } catch {
      NSLog("[ShotDetector] VNCoreMLModel wrap failed: %@", error.localizedDescription)
      throw ShotDetectorError.compilationFailed(error.localizedDescription)
    }

    isLoaded = true
    modelName = "\(resourceName).\(ext)"
    NSLog("[ShotDetector] model ready — name: %@", modelName)
    return modelName
  }

  /// Run synchronous inference on a CVPixelBuffer.
  ///
  /// Serialized through inferenceQueue to prevent concurrent Vision calls
  /// on the same VNCoreMLModel instance (not thread-safe → EXC_BAD_ACCESS).
  func runInference(on pixelBuffer: CVPixelBuffer, minConfidence: Float = 0.35) throws -> [[String: Any]] {
    // Capture model ref before entering the queue check
    guard isLoaded else {
      throw ShotDetectorError.modelNotLoaded
    }

    var result: [[String: Any]] = []
    var thrownError: Error? = nil

    inferenceQueue.sync {
      guard let model = coreMLModel else {
        thrownError = ShotDetectorError.modelNotLoaded
        return
      }

      // Lock the pixel buffer for the duration of the Vision request.
      // VNImageRequestHandler retains it internally, but explicit locking
      // prevents the buffer from being recycled by VisionCamera mid-inference.
      CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
      defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

      let request = VNCoreMLRequest(model: model)
      request.imageCropAndScaleOption = .scaleFit

      let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:])
      do {
        try handler.perform([request])
      } catch {
        NSLog("[ShotDetector] inference perform error: %@", error.localizedDescription)
        thrownError = ShotDetectorError.inferenceFailed(error.localizedDescription)
        return
      }

      guard let observations = request.results as? [VNRecognizedObjectObservation] else {
        result = []
        return
      }

      result = observations.compactMap { obs -> [String: Any]? in
        guard let label = obs.labels.first, label.confidence >= minConfidence else {
          return nil
        }
        // VNRecognizedObjectObservation bbox origin is bottom-left.
        // Convert to top-left (UIKit/RN convention).
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
    }

    if let err = thrownError { throw err }
    return result
  }
}

// MARK: - Expo Module

/// Exposes loadModel(), isLoaded(), and getModelName() to JavaScript.
/// Per-frame inference runs through ShotDetectorFrameProcessor (VisionCamera plugin).
public class ShotDetectorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ShotDetector")

    /// Load the CoreML model. Safe to call multiple times.
    /// Returns { loaded: Bool, modelName: String, error?: String }
    AsyncFunction("loadModel") { () -> [String: Any] in
      do {
        let name = try ShotDetectorPipeline.shared.loadModel()
        return ["loaded": true, "modelName": name]
      } catch {
        NSLog("[ShotDetector] loadModel JS call failed: %@", error.localizedDescription)
        return ["loaded": false, "modelName": "", "error": error.localizedDescription]
      }
    }

    /// Returns true if the model has been loaded successfully.
    Function("isLoaded") { () -> Bool in
      return ShotDetectorPipeline.shared.isLoaded
    }

    /// Returns the name of the loaded model, or empty string if not loaded.
    Function("getModelName") { () -> String in
      return ShotDetectorPipeline.shared.modelName
    }
  }
}
