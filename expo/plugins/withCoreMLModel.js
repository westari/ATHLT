/**
 * withCoreMLModel — Expo config plugin
 *
 * Copies a .mlpackage directory into the iOS Xcode project during prebuild
 * and adds it to the "Copy Bundle Resources" build phase so the model is
 * bundled inside the .app and accessible via Bundle.main at runtime.
 *
 * Usage in app.json:
 *   "plugins": [
 *     ["./plugins/withCoreMLModel", { "modelPath": "./cv/best.mlpackage" }]
 *   ]
 *
 * The modelPath is relative to the project root (same directory as package.json).
 * Keep it commented out in app.json until you have the actual .mlpackage file
 * from the Colab training run.
 *
 * Reference: andrei-zgirvaci/expo-stable-diffusion uses this same pattern
 * to bundle large CoreML model assets in a managed Expo workflow.
 */

const { withXcodeProject } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/**
 * Recursively copy a directory (for .mlpackage which is a directory, not a file).
 */
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source path does not exist: ${src}`);
  }
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

/**
 * Remove a path (file or directory) if it exists.
 */
function removeIfExists(p) {
  if (!fs.existsSync(p)) return;
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    fs.rmSync(p, { recursive: true, force: true });
  } else {
    fs.unlinkSync(p);
  }
}

function withCoreMLModel(config, { modelPath } = {}) {
  if (!modelPath) {
    console.warn('[withCoreMLModel] No modelPath provided — skipping CoreML model integration.');
    return config;
  }

  return withXcodeProject(config, (config) => {
    const projectRoot   = config.modRequest.projectRoot;
    const platformRoot  = config.modRequest.platformProjectRoot; // ios/
    const projectName   = config.modRequest.projectName;
    const xcodeProject  = config.modResults;

    const resolvedModelPath = path.resolve(projectRoot, modelPath);
    const modelFileName     = path.basename(modelPath);
    const destModelPath     = path.join(platformRoot, modelFileName);

    if (!fs.existsSync(resolvedModelPath)) {
      console.warn(
        `[withCoreMLModel] Model not found at ${resolvedModelPath}.\n` +
        `  Run the Colab training notebook first, download best.mlpackage,\n` +
        `  and place it at: ${modelPath}`
      );
      return config;
    }

    // Copy model into ios/ directory (replaces any previous copy)
    removeIfExists(destModelPath);
    copyRecursive(resolvedModelPath, destModelPath);
    console.log(`[withCoreMLModel] Copied ${modelFileName} → ios/${modelFileName}`);

    // Find the main app target
    const targets = xcodeProject.pbxNativeTargetSection();
    let mainTargetKey = null;
    for (const [key, target] of Object.entries(targets)) {
      if (typeof target === 'object' && target.name === projectName) {
        mainTargetKey = key;
        break;
      }
    }

    if (!mainTargetKey) {
      // Fallback: use the first native target
      for (const [key, target] of Object.entries(targets)) {
        if (typeof target === 'object' && target.productType) {
          mainTargetKey = key;
          break;
        }
      }
    }

    if (!mainTargetKey) {
      console.warn('[withCoreMLModel] Could not find main Xcode target — model copied but not added to build phase.');
      return config;
    }

    // Add the model file reference to the Xcode project
    // xcodeProject.addResourceFile handles adding to PBXResourcesBuildPhase
    xcodeProject.addResourceFile(
      modelFileName,
      { target: mainTargetKey },
      xcodeProject.pbxGroupByName(projectName)
    );

    console.log(`[withCoreMLModel] Added ${modelFileName} to Xcode build resources.`);
    return config;
  });
}

module.exports = withCoreMLModel;
