/**
 * withCoreMLModel — Expo config plugin
 *
 * Copies a .mlpackage directory into the iOS Xcode project during prebuild
 * and wires it into the "Copy Bundle Resources" build phase so the model is
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
 * Why not addResourceFile()?
 * The xcode npm package's addResourceFile() calls correctForResourcesPath()
 * which calls correctForPath(), and that function cannot handle directory-based
 * bundles (.mlpackage is a directory, not a file). It crashes with:
 *   "Cannot read properties of null (reading 'path')"
 *
 * Fix: bypass addResourceFile entirely. Directly write the PBXFileReference +
 * PBXBuildFile entries into the pbxproj hash and push to the resources phase.
 * This is the same approach used by @expo/config-plugins internally for other
 * directory bundles.
 */

const { withXcodeProject } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// ─── helpers ──────────────────────────────────────────────────────────────────

function copyDir(src, dst) {
  if (fs.existsSync(dst)) {
    fs.rmSync(dst, { recursive: true, force: true });
  }
  // fs.cpSync requires Node 16.7+. EAS Build uses Node 18+ so this is safe.
  fs.cpSync(src, dst, { recursive: true });
}

/**
 * Check whether a file/directory reference already exists in the pbxproj by
 * matching the path string (with or without surrounding pbxproj quotes).
 */
function alreadyInProject(xcodeProject, fileName) {
  const fileRefs = xcodeProject.pbxFileReferenceSection();
  return Object.values(fileRefs).some(
    ref =>
      ref &&
      typeof ref === 'object' &&
      (ref.path === fileName || ref.path === `"${fileName}"`)
  );
}

/**
 * Add a .mlpackage (directory bundle) to the Xcode project.
 *
 * Does NOT call addResourceFile() — that method uses correctForPath() which
 * is broken for directories. Instead we write pbxproj entries directly.
 *
 * @param {object} xcodeProject  The parsed pbxProject from withXcodeProject
 * @param {string} modelFileName  e.g. "best.mlpackage"
 * @param {string} mainTargetKey  UUID of the app's PBXNativeTarget
 */
function addModelToXcodeProject(xcodeProject, modelFileName, mainTargetKey) {
  if (alreadyInProject(xcodeProject, modelFileName)) {
    console.log(`[withCoreMLModel] ${modelFileName} already in Xcode project — skipping.`);
    return;
  }

  const objects = xcodeProject.hash.project.objects;

  // In raw .pbxproj, string values are wrapped in double-quotes.
  // The xcode npm package stores them that way in the parsed hash too.
  const quotedName = `"${modelFileName}"`;
  const quotedSrcTree = '"<group>"';

  // 1. Generate UUIDs ─────────────────────────────────────────────────────────
  const fileRefUUID  = xcodeProject.generateUuid();
  const buildFileUUID = xcodeProject.generateUuid();

  // 2. PBXFileReference ───────────────────────────────────────────────────────
  //    wrapper.mlpackage is the correct lastKnownFileType for CoreML packages.
  const pbxFileRef = objects['PBXFileReference'] || (objects['PBXFileReference'] = {});
  pbxFileRef[fileRefUUID] = {
    isa: 'PBXFileReference',
    lastKnownFileType: 'wrapper.mlpackage',
    name: quotedName,
    path: quotedName,
    sourceTree: quotedSrcTree,
  };
  // _comment keys are how the xcode package tracks human-readable labels
  pbxFileRef[`${fileRefUUID}_comment`] = modelFileName;

  // 3. Add file ref to the main project group so it shows up in Xcode's
  //    file navigator. Using the project's mainGroup (root group).
  const mainGroupUUID = xcodeProject.getFirstProject().firstProject.mainGroup;
  const pbxGroup = objects['PBXGroup'] || {};
  const mainGroup = pbxGroup[mainGroupUUID];
  if (mainGroup && Array.isArray(mainGroup.children)) {
    mainGroup.children.push({ value: fileRefUUID, comment: modelFileName });
  } else {
    console.warn('[withCoreMLModel] Could not locate main PBXGroup. Model will still build but may not appear in navigator.');
  }

  // 4. PBXBuildFile ───────────────────────────────────────────────────────────
  const pbxBuildFile = objects['PBXBuildFile'] || (objects['PBXBuildFile'] = {});
  pbxBuildFile[buildFileUUID] = {
    isa: 'PBXBuildFile',
    fileRef: fileRefUUID,
    fileRef_comment: modelFileName,
  };
  pbxBuildFile[`${buildFileUUID}_comment`] = `${modelFileName} in Resources`;

  // 5. Append to Copy Bundle Resources phase of the main target ───────────────
  const nativeTarget = (objects['PBXNativeTarget'] || {})[mainTargetKey];
  if (!nativeTarget || !Array.isArray(nativeTarget.buildPhases)) {
    console.warn('[withCoreMLModel] Target has no buildPhases — model copied but not added to bundle.');
    return;
  }

  const resourcesPhases = objects['PBXResourcesBuildPhase'] || {};
  let addedToPhase = false;

  for (const phaseRef of nativeTarget.buildPhases) {
    const phase = resourcesPhases[phaseRef.value];
    if (phase && phase.isa === 'PBXResourcesBuildPhase') {
      if (!Array.isArray(phase.files)) phase.files = [];
      phase.files.push({
        value: buildFileUUID,
        comment: `${modelFileName} in Resources`,
      });
      addedToPhase = true;
      break;
    }
  }

  if (!addedToPhase) {
    console.warn('[withCoreMLModel] PBXResourcesBuildPhase not found for target — model copied but not added to bundle.');
  }
}

// ─── main plugin ──────────────────────────────────────────────────────────────

function withCoreMLModel(config, { modelPath } = {}) {
  if (!modelPath) {
    console.warn('[withCoreMLModel] No modelPath provided — skipping CoreML model integration.');
    return config;
  }

  return withXcodeProject(config, (config) => {
    const projectRoot  = config.modRequest.projectRoot;
    const platformRoot = config.modRequest.platformProjectRoot; // ios/
    const projectName  = config.modRequest.projectName;
    const xcodeProject = config.modResults;

    const resolvedSrc = path.resolve(projectRoot, modelPath);
    const modelFileName = path.basename(modelPath);   // "best.mlpackage"
    const resolvedDst = path.join(platformRoot, modelFileName);

    // ── 1. Guard: model must exist ──────────────────────────────────────────
    if (!fs.existsSync(resolvedSrc)) {
      console.warn(
        `[withCoreMLModel] Model not found: ${resolvedSrc}\n` +
        `  Run the Colab training notebook, download best.mlpackage,\n` +
        `  and place it at: ${modelPath}`
      );
      return config;
    }

    // ── 2. Copy model into ios/ (always refresh) ────────────────────────────
    copyDir(resolvedSrc, resolvedDst);
    console.log(`[withCoreMLModel] Copied ${modelFileName} → ios/${modelFileName}`);

    // ── 3. Find the main app native target ──────────────────────────────────
    const targets = xcodeProject.pbxNativeTargetSection();
    let mainTargetKey = null;

    // Prefer a target whose name matches the project name
    for (const [key, target] of Object.entries(targets)) {
      if (typeof target === 'object' && target.name === `"${projectName}"`) {
        mainTargetKey = key;
        break;
      }
    }
    // Also try without quotes (some Expo versions omit them)
    if (!mainTargetKey) {
      for (const [key, target] of Object.entries(targets)) {
        if (typeof target === 'object' && target.name === projectName) {
          mainTargetKey = key;
          break;
        }
      }
    }
    // Last resort: first target with a productType
    if (!mainTargetKey) {
      for (const [key, target] of Object.entries(targets)) {
        if (typeof target === 'object' && target.productType) {
          mainTargetKey = key;
          break;
        }
      }
    }

    if (!mainTargetKey) {
      console.warn('[withCoreMLModel] Could not find main Xcode target — model copied but not wired into build phase.');
      return config;
    }

    // ── 4. Write pbxproj entries (avoids addResourceFile which crashes on dirs)
    addModelToXcodeProject(xcodeProject, modelFileName, mainTargetKey);
    console.log(`[withCoreMLModel] Wired ${modelFileName} into Xcode build resources.`);

    return config;
  });
}

module.exports = withCoreMLModel;
