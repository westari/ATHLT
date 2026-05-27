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

  private init() {}

  /// Load and compile the CoreML model. Safe to call multiple times —
  /// iOS caches the compiled artifact after the first run (~200–400 ms).
  func loadModel(named resourceName: String = "best", extension ext: String = "mlpackage") throws -> String {
    guard let modelURL = Bundle.main.url(forResource: resourceName, withExtension: ext) else {
      throw ShotDetectorError.modelNotFound("\(resourceName).\(ext)")
    }

    let compiledURL: URL
    do {
      compiledURL = try MLModel.compileModel(at: modelURL)
    } catch {
      throw ShotDetectorError.compilationFailed(error.localizedDescription)
    }

    let config = MLModelConfiguration()
    config.computeUnits = .all   // uses Neural Engine on iPhone 11+

    let mlModel: MLModel
    do {
      mlModel = try MLModel(contentsOf: compiledURL, configuration: config)
    } catch {
      throw ShotDetectorError.compilationFailed(error.localizedDescription)
    }

    do {
      coreMLModel = try VNCoreMLModel(for: mlModel)
    } catch {
      throw ShotDetectorError.compilationFailed(error.localizedDescription)
    }

    isLoaded = true
    modelName = "\(resourceName).\(ext)"
    return modelName
  }

  /// Run synchronous inference on a CVPixelBuffer.
  ///
  /// Vision's perform(_:) is synchronous — the completion handler fires during
  /// the call and results are in request.results when it returns. No semaphore needed.
  func runInference(on pixelBuffer: CVPixelBuffer, minConfidence: Float = 0.35) throws -> [[String: Any]] {
    guard let model = coreMLModel else {
      throw ShotDetectorError.modelNotLoaded
    }

    let request = VNCoreMLRequest(model: model)
    request.imageCropAndScaleOption = .scaleFit

    let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:])
    do {
      try handler.perform([request])
    } catch {
      throw ShotDetectorError.inferenceFailed(error.localizedDescription)
    }

    guard let observations = request.results as? [VNRecognizedObjectObservation] else {
      return []
    }

    return observations.compactMap { obs -> [String: Any]? in
      guard let label = obs.labels.first, label.confidence >= minConfidence else {
        return nil
      }
      // VNRecognizedObjectObservation bbox has origin at bottom-left.
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
}

// MARK: - Expo Module

/// Exposes loadModel(), isLoaded(), and getModelName() to JavaScript.
/// Per-frame inference runs through ShotDetectorFrameProcessor (VisionCamera plugin).
public class ShotDetectorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ShotDetector")

    /// Load the CoreML model. Safe to call multiple times.
    /// Returns { loaded: Bool, modelName: String, error?: String }
    ///
    /// AsyncFunction runs on a background thread automatically — no manual
    /// DispatchQueue dispatch needed.
    AsyncFunction("loadModel") { () -> [String: Any] in
      do {
        let name = try ShotDetectorPipeline.shared.loadModel()
        return ["loaded": true, "modelName": name]
      } catch {
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
