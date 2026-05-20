# ==============================================================================
# ATHLT — YOLOv8 Basketball Detection Training Script
# Production-ready. Run in Google Colab on a T4 GPU.
#
# OUTPUT:
#   best.pt                → YOLOv8 checkpoint (keep as backup/retrain base)
#   best_float32.tflite    → Float32 TFLite (accurate, ~6MB)
#   best_int8.tflite       → INT8 TFLite (smaller, faster on iPhone, ~2MB)
#   → Drop the .tflite you choose into expo/assets/models/basketball_detector.tflite
#
# ─────────────────────────────────────────────────────────────────────────────
# HOW TO RUN IN GOOGLE COLAB — READ THIS FIRST
# ─────────────────────────────────────────────────────────────────────────────
#
#  1. Go to https://colab.research.google.com
#     New notebook → Runtime → Change runtime type → T4 GPU → Save
#
#  2. Upload this file OR copy-paste each CELL into separate Colab cells.
#     (Cells are marked with  ── CELL N ─────────────────  headers below.)
#     Shortcut to add a cell: click + Code in the toolbar.
#
#  3. Run cells IN ORDER, top to bottom. Each cell must finish (green check)
#     before the next. Do NOT skip cells.
#
#  4. Cell 2 (Mount Drive) is strongly recommended. Colab disconnects after
#     ~90 min of idle. If it disconnects mid-training, best.pt is lost unless
#     it's backed up to Drive first.
#
#  5. Cell 3 (Install) may prompt "Restart runtime". If it does, restart,
#     then re-run Cell 3 and continue. Do NOT re-run earlier cells.
#
#  6. Training (Cell 7) takes ~45 min on T4 for 100 epochs. Watch the
#     progress bar. mAP@0.5 > 0.70 is the target — anything above is great.
#
#  7. After training completes, Cell 9 exports two .tflite files.
#     Download them from the Colab file browser (left sidebar → Files icon).
#     Right-click the file → Download.
#
#  8. Drop the downloaded .tflite into:
#       expo/assets/models/basketball_detector.tflite
#     Use best_int8.tflite for production (faster on iPhone A-series chips).
#     Fall back to best_float32.tflite if INT8 causes detection issues.
#
#  DATASET INFO:
#    Source:  Roboflow Universe — roboflow-universe-projects/basketball-player-detection-3
#    Classes: ball, hoop, player (+ made/missed in some versions — we use ball + hoop at inference)
#    Format:  YOLOv8 (YOLO .txt annotations + data.yaml)
#    Version: 3 (latest stable at time of writing — bump if accuracy is low)
#
#  TROUBLESHOOTING:
#    "CUDA out of memory" → Change batch=16 to batch=8 in Cell 7
#    "No module named ultralytics" → Re-run Cell 3, then restart runtime
#    "Dataset not found" → Check ROBOFLOW_API_KEY is correct and not expired
#    "mAP@0.5 < 0.50" → Try yolov8s.pt instead of yolov8n.pt in Cell 7
#    TFLite export fails → Run Cell 9 standalone; try int8=False first
#
# ==============================================================================


# ── CELL 1: Configuration — set your values here ─────────────────────────────
#
# This is the only cell you need to edit. Set ROBOFLOW_API_KEY.
# Everything else has sensible defaults documented below.

# ── Your Roboflow API key ──
# Get it at: https://app.roboflow.com → top-right profile → API Keys
ROBOFLOW_API_KEY = "PASTE_YOUR_API_KEY_HERE"  # ← REQUIRED: replace this

# ── Dataset config ──
# These match the Roboflow universe project for basketball detection.
# If the project URL changes, update workspace + project + version.
ROBOFLOW_WORKSPACE = "roboflow-universe-projects"
ROBOFLOW_PROJECT   = "basketball-player-detection-3"
ROBOFLOW_VERSION   = 3  # bump to 4+ if a newer version is available

# ── Model config ──
# yolov8n.pt (nano)  — recommended for iPhone on-device inference (~30fps A15)
# yolov8s.pt (small) — better accuracy, ~18fps A15. Use if mAP is below target.
BASE_MODEL = "yolov8n.pt"

# ── Training hyperparameters ──
EPOCHS      = 100    # 100 for production. 50 for a quick accuracy check.
BATCH       = 16     # T4 16GB handles batch=16 comfortably. Drop to 8 if OOM.
IMG_SIZE    = 640    # Standard YOLOv8 input size. Do not change.
PATIENCE    = 15     # Early stopping: stop if val loss doesn't improve for N epochs.
WORKERS     = 4      # Dataloader workers. 4 is safe for Colab T4.

# ── Output and backup ──
PROJECT_DIR = "runs/detect"
RUN_NAME    = "basketball_v1"
SAVE_DRIVE  = True   # Mount and backup to Google Drive (strongly recommended)
DRIVE_DIR   = "/content/drive/MyDrive/ATHLT_models"  # Drive path for backups

# ── Export config ──
EXPORT_FLOAT32 = True  # Always export float32 (safe baseline)
EXPORT_INT8    = True  # Export INT8 quantized (smaller, faster on iPhone A-series)
                       # Set False if INT8 export fails; use float32 model instead

print("Config loaded.")
print(f"  Model:   {BASE_MODEL}")
print(f"  Epochs:  {EPOCHS}")
print(f"  Batch:   {BATCH}")
print(f"  Dataset: {ROBOFLOW_WORKSPACE}/{ROBOFLOW_PROJECT} v{ROBOFLOW_VERSION}")


# ── CELL 2: Mount Google Drive (recommended, not required) ───────────────────
#
# Saves weights to Drive so they survive a Colab disconnect.
# If you skip this, set SAVE_DRIVE = False in Cell 1.

import os

if SAVE_DRIVE:
    from google.colab import drive
    drive.mount('/content/drive')
    os.makedirs(DRIVE_DIR, exist_ok=True)
    print(f"Drive mounted. Backups will go to: {DRIVE_DIR}")
else:
    print("Skipping Drive mount. Set SAVE_DRIVE=True to enable backup.")


# ── CELL 3: Install dependencies ─────────────────────────────────────────────
#
# If Colab prompts "Restart runtime after install", do it.
# Then re-run this cell and continue from Cell 4.

import subprocess, sys

def pip_install(*packages):
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", *packages])

pip_install("ultralytics>=8.0.0", "roboflow")

# Verify versions
import ultralytics, roboflow
print(f"ultralytics: {ultralytics.__version__}")
print(f"roboflow:    {roboflow.__version__}")


# ── CELL 4: Verify GPU ────────────────────────────────────────────────────────
#
# Must show a GPU (T4, A100, etc.). If it shows "cpu" you're on CPU —
# go to Runtime → Change runtime type → T4 GPU and re-run from Cell 1.

import torch

device = "cuda" if torch.cuda.is_available() else "cpu"
if device == "cpu":
    raise RuntimeError(
        "No GPU detected. Go to Runtime → Change runtime type → T4 GPU."
    )

print(f"Device:       {device.upper()}")
print(f"GPU:          {torch.cuda.get_device_name(0)}")
print(f"VRAM:         {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
print(f"PyTorch:      {torch.__version__}")
print(f"CUDA:         {torch.version.cuda}")


# ── CELL 5: Download dataset ──────────────────────────────────────────────────
#
# Downloads basketball-player-detection-3 in YOLOv8 format.
# Creates ./basketball-player-detection-3/ with train/valid/test splits.
# Takes ~1 min on a fresh Colab instance.

from roboflow import Roboflow

if ROBOFLOW_API_KEY == "PASTE_YOUR_API_KEY_HERE":
    raise ValueError("Set ROBOFLOW_API_KEY in Cell 1 before running this cell.")

rf = Roboflow(api_key=ROBOFLOW_API_KEY)
project = rf.workspace(ROBOFLOW_WORKSPACE).project(ROBOFLOW_PROJECT)
dataset = project.version(ROBOFLOW_VERSION).download("yolov8")

DATA_YAML = os.path.join(dataset.location, "data.yaml")
print(f"\nDataset location: {dataset.location}")
print(f"data.yaml path:   {DATA_YAML}")


# ── CELL 6: Validate dataset ──────────────────────────────────────────────────
#
# Checks class names and image counts. Confirms ball + hoop are present.
# If class names don't match expected, we note it — we train on all classes
# and filter to ball + hoop at inference time in the app.

import yaml, glob

with open(DATA_YAML) as f:
    data_cfg = yaml.safe_load(f)

class_names = data_cfg.get("names", [])
nc = data_cfg.get("nc", 0)

print(f"Classes ({nc}): {class_names}")

# Warn if ball or hoop are missing — these are the two we need at inference
for required in ["ball", "hoop"]:
    if required not in class_names:
        print(f"  WARNING: '{required}' not found in class list. "
              f"Check dataset version or class name mapping.")
    else:
        idx = class_names.index(required)
        print(f"  '{required}' → class index {idx}  ✓")

# Count images per split
print()
for split in ["train", "valid", "test"]:
    img_dir = os.path.join(dataset.location, split, "images")
    lbl_dir = os.path.join(dataset.location, split, "labels")
    if os.path.exists(img_dir):
        imgs = len(glob.glob(os.path.join(img_dir, "*.jpg")) +
                   glob.glob(os.path.join(img_dir, "*.png")))
        lbls = len(glob.glob(os.path.join(lbl_dir, "*.txt"))) if os.path.exists(lbl_dir) else 0
        print(f"  {split:8s}: {imgs:4d} images, {lbls:4d} labels")
    else:
        print(f"  {split:8s}: not present")

# Sanity check: label count should roughly match image count
print()
print("If label count is much lower than image count, some images have no annotations.")
print("That's normal for background/negative samples — don't worry about it.")


# ── CELL 7: Train ─────────────────────────────────────────────────────────────
#
# This takes ~45 min for 100 epochs on T4. Watch the mAP@0.5 column.
# Target: mAP@0.5 > 0.70 by epoch 80+. If it plateaus below 0.50, see
# troubleshooting in the header — try yolov8s.pt instead.
#
# Training saves checkpoints every 10 epochs automatically.
# If Colab disconnects, resume with:
#   model = YOLO(f"{PROJECT_DIR}/{RUN_NAME}/weights/last.pt")
#   model.train(resume=True)

from ultralytics import YOLO

# Check if a previous run exists to resume from
resume = False
last_ckpt = os.path.join(PROJECT_DIR, RUN_NAME, "weights", "last.pt")
if os.path.exists(last_ckpt):
    ans = input(f"Found existing run at {last_ckpt}. Resume? [y/N]: ").strip().lower()
    if ans == "y":
        resume = True
        print("Resuming from last checkpoint...")

if resume:
    model = YOLO(last_ckpt)
    results = model.train(resume=True)
else:
    model = YOLO(BASE_MODEL)
    results = model.train(
        data=DATA_YAML,
        epochs=EPOCHS,
        imgsz=IMG_SIZE,
        batch=BATCH,
        device=0,                # GPU 0 (the T4)
        project=PROJECT_DIR,
        name=RUN_NAME,
        exist_ok=True,           # overwrite if RUN_NAME already exists
        patience=PATIENCE,       # early stopping
        workers=WORKERS,
        save=True,
        save_period=10,          # checkpoint every 10 epochs
        plots=True,              # PR curve, confusion matrix, training curves

        # ── Data augmentation ──
        # These are tuned for basketball detection.
        # Ball is small and fast → need scale + blur augmentation.
        # Court lighting varies → HSV augmentation helps.
        # Courts are often wide-angle → degrees rotation helps.
        degrees=5.0,             # small rotation (camera tilt variance)
        translate=0.1,           # 10% translation (camera framing variance)
        scale=0.5,               # 50% scale variance (ball size varies by distance)
        fliplr=0.5,              # horizontal flip (courts are symmetric)
        flipud=0.0,              # no vertical flip (gravity doesn't flip)
        mosaic=1.0,              # mosaic augmentation (helps detect ball in context)
        hsv_h=0.015,             # hue shift (lighting variance)
        hsv_s=0.7,               # saturation shift (indoor vs outdoor, shadow)
        hsv_v=0.4,               # brightness shift (gym vs outdoor lighting)
        blur=0.0,                # motion blur OFF during training; too aggressive

        # ── Anchor/box settings ──
        # Ball is small; hoop is medium. Default anchors handle this fine.
        # If ball detection is poor, lower box loss weight (box=5.0 → 3.0).
        box=7.5,                 # box regression loss weight (default 7.5)
        cls=0.5,                 # classification loss weight (default 0.5)
        dfl=1.5,                 # distribution focal loss weight (default 1.5)

        verbose=True,
    )

BEST_PT = os.path.join(PROJECT_DIR, RUN_NAME, "weights", "best.pt")
print(f"\nTraining complete. Best weights: {BEST_PT}")


# ── CELL 8: Validate + metrics ────────────────────────────────────────────────
#
# Runs the best model on the validation set and prints per-class metrics.
# Target per-class: precision > 0.70, recall > 0.65, mAP@0.5 > 0.70
#
# If ball mAP is low (<0.50):
#   → Ball is small and fast. Try yolov8s.pt, more epochs, or scale=0.7.
# If hoop mAP is low (<0.60):
#   → Hoop may be partially out-of-frame in training data. Normal — hoop is
#     often at the edge. Threshold at inference, don't retrain for this.

best_model = YOLO(BEST_PT)
metrics = best_model.val(data=DATA_YAML, imgsz=IMG_SIZE, device=0)

print("\n── Validation metrics ────────────────────────────────")
print(f"  mAP@0.5:          {metrics.box.map50:.4f}  (target: > 0.70)")
print(f"  mAP@0.5:0.95:     {metrics.box.map:.4f}")
print(f"  Precision (mean): {metrics.box.mp:.4f}")
print(f"  Recall (mean):    {metrics.box.mr:.4f}")
print()

if hasattr(metrics.box, 'ap_class_index') and metrics.box.ap_class_index is not None:
    class_names_local = best_model.names
    print("  Per-class AP@0.5:")
    for i, ap in enumerate(metrics.box.ap50):
        cls_name = class_names_local.get(i, f"class_{i}")
        flag = "✓" if ap >= 0.70 else ("⚠" if ap >= 0.50 else "✗")
        print(f"    {flag} {cls_name:15s}: {ap:.4f}")

print()
if metrics.box.map50 >= 0.70:
    print("  RESULT: Target met — model is ready for integration.")
elif metrics.box.map50 >= 0.55:
    print("  RESULT: Acceptable but below target. Consider yolov8s.pt or more epochs.")
else:
    print("  RESULT: Below threshold. See troubleshooting section in Cell 1 header.")


# ── CELL 9: Export to TFLite ──────────────────────────────────────────────────
#
# Exports two TFLite variants:
#   best_float32.tflite — safe baseline, larger file (~6MB)
#   best_int8.tflite    — INT8 quantized, smaller (~2MB), faster on iPhone A-series
#
# react-native-fast-tflite can use either. Prefer INT8 for production.
#
# INT8 quantization uses the validation set as calibration data.
# It takes ~5 min longer than float32 export.
#
# Output tensors from YOLOv8 TFLite export (for wiring in Step 4 of CV-PLAN):
#   Model output: [1, num_predictions, 4+nc] for detect tasks
#   Columns 0-3:  x_center, y_center, width, height (normalized 0-1)
#   Columns 4+:   class confidence scores (one per class)
#   Parse in JS:  confidence = max(scores); classId = argmax(scores)
#   NMS:          apply manually or use ultralytics post-processing logic

import shutil

weights_dir = os.path.join(PROJECT_DIR, RUN_NAME, "weights")

# ── Float32 export ──
if EXPORT_FLOAT32:
    print("Exporting float32 TFLite...")
    export_path_f32 = best_model.export(
        format="tflite",
        imgsz=IMG_SIZE,
        int8=False,
        device="cpu",   # TFLite export runs on CPU
    )
    # Rename to a stable filename
    dest_f32 = os.path.join(weights_dir, "best_float32.tflite")
    if export_path_f32 and os.path.exists(export_path_f32):
        shutil.copy(export_path_f32, dest_f32)
        size_mb = os.path.getsize(dest_f32) / 1e6
        print(f"  Float32 TFLite: {dest_f32}  ({size_mb:.1f} MB)")
    else:
        print(f"  Float32 export returned: {export_path_f32}")

# ── INT8 quantized export ──
if EXPORT_INT8:
    print("\nExporting INT8 TFLite (uses validation data for calibration — takes ~5 min)...")
    try:
        export_path_i8 = best_model.export(
            format="tflite",
            imgsz=IMG_SIZE,
            int8=True,
            data=DATA_YAML,  # calibration data
            device="cpu",
        )
        dest_i8 = os.path.join(weights_dir, "best_int8.tflite")
        if export_path_i8 and os.path.exists(export_path_i8):
            shutil.copy(export_path_i8, dest_i8)
            size_mb = os.path.getsize(dest_i8) / 1e6
            print(f"  INT8 TFLite:    {dest_i8}  ({size_mb:.1f} MB)")
        else:
            print(f"  INT8 export returned: {export_path_i8}")
    except Exception as e:
        print(f"  INT8 export failed: {e}")
        print("  → Use best_float32.tflite instead. INT8 failures are not uncommon.")
        print("    See: https://docs.ultralytics.com/modes/export/#arguments")

print("\nTo download: left sidebar → Files icon → runs/detect/basketball_v1/weights/")
print("Right-click best_float32.tflite or best_int8.tflite → Download")


# ── CELL 10: Backup to Google Drive ───────────────────────────────────────────
#
# Copies best.pt + both TFLite files to Drive so they survive disconnects.
# Only runs if SAVE_DRIVE=True in Cell 1.

if SAVE_DRIVE:
    files_to_backup = [
        os.path.join(weights_dir, "best.pt"),
        os.path.join(weights_dir, "best_float32.tflite"),
        os.path.join(weights_dir, "best_int8.tflite"),
    ]
    backed_up = []
    for f in files_to_backup:
        if os.path.exists(f):
            dest = os.path.join(DRIVE_DIR, os.path.basename(f))
            shutil.copy(f, dest)
            backed_up.append(os.path.basename(f))

    # Also copy the full training run (metrics, plots, confusion matrix)
    run_dir = os.path.join(PROJECT_DIR, RUN_NAME)
    drive_run_dir = os.path.join(DRIVE_DIR, RUN_NAME)
    if os.path.exists(run_dir):
        if os.path.exists(drive_run_dir):
            shutil.rmtree(drive_run_dir)
        shutil.copytree(run_dir, drive_run_dir)

    print(f"Backed up to {DRIVE_DIR}:")
    for f in backed_up:
        print(f"  {f}")
    print(f"  {RUN_NAME}/ (full run: plots, metrics, confusion matrix)")
else:
    print("Drive backup skipped (SAVE_DRIVE=False).")
    print("Download your .tflite files now before the session ends.")


# ── CELL 11: Quick inference test ─────────────────────────────────────────────
#
# Runs the model on one validation image and prints what was detected.
# Confirms the model is producing ball + hoop detections at reasonable confidence.
# Does NOT save visualizations (to keep things simple).
#
# Expected output: "ball" and/or "hoop" in detected list.
# If neither appears, check confidence threshold or try a different val image.

val_images = glob.glob(os.path.join(dataset.location, "valid", "images", "*.jpg"))
val_images += glob.glob(os.path.join(dataset.location, "valid", "images", "*.png"))

if val_images:
    test_img = val_images[0]
    print(f"Running inference on: {os.path.basename(test_img)}")

    test_results = best_model.predict(test_img, conf=0.25, iou=0.45, verbose=False)
    boxes = test_results[0].boxes

    if boxes is None or len(boxes) == 0:
        print("No detections above conf=0.25 on this image.")
        print("Try a different image or lower conf threshold if overall mAP was good.")
    else:
        print(f"Detected {len(boxes)} objects:")
        for box in boxes:
            cls_id  = int(box.cls[0])
            cls_name = best_model.names[cls_id]
            conf    = float(box.conf[0])
            xyxy    = box.xyxy[0].tolist()
            print(f"  [{cls_name:10s}]  conf={conf:.2f}  box={[round(x,1) for x in xyxy]}")

        detected_names = {best_model.names[int(b.cls[0])] for b in boxes}
        for needed in ["ball", "hoop"]:
            if needed in detected_names:
                print(f"  ✓ '{needed}' detected")
            else:
                print(f"  ⚠ '{needed}' not detected on this image (may not be in frame)")
else:
    print("No validation images found for test inference.")


# ── CELL 12: Summary ──────────────────────────────────────────────────────────
#
# Print a summary of where everything is and what to do next.

print("=" * 60)
print("TRAINING COMPLETE — SUMMARY")
print("=" * 60)
print()
print("Model weights:")
print(f"  best.pt            → {os.path.join(weights_dir, 'best.pt')}")
print(f"  best_float32.tflite→ {os.path.join(weights_dir, 'best_float32.tflite')}")
print(f"  best_int8.tflite   → {os.path.join(weights_dir, 'best_int8.tflite')}")
print()
print("Next steps:")
print("  1. Download best_int8.tflite (prefer) or best_float32.tflite")
print("     from: Files sidebar → runs/detect/basketball_v1/weights/")
print()
print("  2. Drop the file into:")
print("       expo/assets/models/basketball_detector.tflite")
print()
print("  3. In expo/app.json, confirm assetBundlePatterns includes:")
print('       "expo/assets/models/*"')
print()
print("  4. Proceed to CV-PLAN.md Step 4 (add fast-tflite + wire model).")
print()
print(f"  Metrics: mAP@0.5 = {metrics.box.map50:.4f}")
print()
print("Class indices for inference-time filtering (ball + hoop only):")
for i, name in best_model.names.items():
    if name in ("ball", "hoop"):
        print(f"  {name}: class index {i}  ← use this in shotDetection.ts")
print()
print("Training artifacts (plots, confusion matrix) in:")
print(f"  {os.path.join(PROJECT_DIR, RUN_NAME)}/")
if SAVE_DRIVE:
    print(f"  {os.path.join(DRIVE_DIR, RUN_NAME)}/  (Drive backup)")
