"""
Trains the real, small, linear classification head on real frozen Prithvi-
EO-2.0-tiny-TL features extracted from the real multi-temporal-crop-
classification chips downloaded by download_chips.py.

Split: the dataset's OWN official train/validation split is used
end-to-end (see manifests/training_data.txt / validation_data.txt) — no
chip that appears in the official validation split is ever used for
training. This is a field/chip-level split (each chip is one disjoint
224x224 area of CONUS), not a random pixel split, so there is no spatial
leakage between the two sets.

Run: python ml/src/train.py
Outputs:
  ml/checkpoints/head.pt              (trained head weights only)
  ml/manifests/model_manifest.json    (full reproducibility record)
  ml/manifests/evaluation_report.json (real metrics on the real validation split)
"""
import hashlib
import json
import platform
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

from dataset import LABEL_CLASSES, CLASS_NAMES, load_split
from metrics import classification_report
from model import LinearHead, extract_features, load_frozen_encoder

ML_ROOT = Path(__file__).resolve().parent.parent
SEED = 42
ABSTENTION_CONFIDENCE_THRESHOLD = 0.5
FEATURE_BATCH_SIZE = 8
EPOCHS = 300
LEARNING_RATE = 1e-2


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def chip_ids_in(manifest: dict, split: str) -> list[str]:
    return [e["chipId"] for e in manifest["splits"][split]]


def batched_features(encoder, images: torch.Tensor) -> torch.Tensor:
    feats = []
    for i in range(0, images.shape[0], FEATURE_BATCH_SIZE):
        feats.append(extract_features(encoder, images[i : i + FEATURE_BATCH_SIZE]))
    return torch.cat(feats, dim=0)


def main() -> None:
    torch.manual_seed(SEED)
    np.random.seed(SEED)

    manifest = json.loads((ML_ROOT / "manifests" / "dataset_manifest.json").read_text())
    train_ids = chip_ids_in(manifest, "train")
    val_ids = chip_ids_in(manifest, "validation")

    print(f"Loading {len(train_ids)} train + {len(val_ids)} validation chips...")
    train_images, train_labels, train_purity = load_split(ML_ROOT / "data" / "train", train_ids)
    val_images, val_labels, val_purity = load_split(ML_ROOT / "data" / "validation", val_ids)
    print(f"After excluding all-nodata chips: {train_images.shape[0]} train, {val_images.shape[0]} validation samples.")

    config_path = ML_ROOT / "manifests" / "prithvi_tiny_config.json"
    checkpoint_path = ML_ROOT / "checkpoints" / "Prithvi_EO_V2_tiny_TL.pt"
    encoder, cfg = load_frozen_encoder(config_path, checkpoint_path)
    embed_dim = cfg["embed_dim"]

    print("Extracting frozen encoder features (real forward passes, no shortcuts)...")
    t0 = time.time()
    train_features = batched_features(encoder, train_images)
    val_features = batched_features(encoder, val_images)
    feature_extraction_seconds = time.time() - t0

    num_classes = len(LABEL_CLASSES)
    head = LinearHead(embed_dim, num_classes)

    class_counts = torch.bincount(train_labels, minlength=num_classes).float()
    class_weight = torch.where(class_counts > 0, 1.0 / class_counts.clamp(min=1), torch.zeros_like(class_counts))
    class_weight = class_weight * (num_classes / class_weight.sum().clamp(min=1e-8))
    criterion = nn.CrossEntropyLoss(weight=class_weight)
    optimizer = torch.optim.Adam(head.parameters(), lr=LEARNING_RATE)

    t0 = time.time()
    head.train()
    for epoch in range(EPOCHS):
        optimizer.zero_grad()
        logits = head(train_features)
        loss = criterion(logits, train_labels)
        loss.backward()
        optimizer.step()
    training_seconds = time.time() - t0
    print(f"Trained {EPOCHS} epochs, final loss {loss.item():.4f}, in {training_seconds:.1f}s")

    head.eval()
    with torch.no_grad():
        train_logits = head(train_features)
        val_logits = head(val_features)
        val_probs = torch.softmax(val_logits, dim=1)
        val_confidence, val_pred = val_probs.max(dim=1)
        train_pred = train_logits.argmax(dim=1)

    abstained = (val_confidence < ABSTENTION_CONFIDENCE_THRESHOLD).numpy()
    covered_mask = ~abstained

    train_report = classification_report(train_labels.numpy(), train_pred.numpy(), num_classes)
    val_report_all = classification_report(val_labels.numpy(), val_pred.numpy(), num_classes)
    val_report_covered = (
        classification_report(val_labels.numpy()[covered_mask], val_pred.numpy()[covered_mask], num_classes)
        if covered_mask.any()
        else None
    )

    class_index_to_name = {i: CLASS_NAMES[LABEL_CLASSES[i]] for i in range(num_classes)}

    # Majority-class baseline — the honest bar this model must clear to mean anything (predicting the single most common training class for every validation sample, real computation, not a guess).
    majority_class = int(torch.bincount(train_labels, minlength=num_classes).argmax().item())
    majority_baseline_accuracy = float((val_labels.numpy() == majority_class).mean())

    checkpoints_dir = ML_ROOT / "checkpoints"
    checkpoints_dir.mkdir(parents=True, exist_ok=True)
    head_path = checkpoints_dir / "head.pt"
    torch.save(head.state_dict(), head_path)

    trained_at = int(time.time() * 1000)
    model_manifest = {
        "modelName": "agriaether-crop-classification-head-v1",
        "task": "CHIP_LEVEL_CROP_CLASSIFICATION",
        "baseEncoder": {
            "name": "Prithvi-EO-2.0-tiny-TL",
            "source": "https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-tiny-TL",
            "checkpointFile": "Prithvi_EO_V2_tiny_TL.pt",
            "checkpointSha256": sha256_of(checkpoint_path),
            "license": "Apache-2.0",
            "frozen": True,
            "embedDim": embed_dim,
            "depth": cfg["depth"],
        },
        "head": {
            "type": "linear",
            "inputDim": embed_dim,
            "outputClasses": num_classes,
            "trainable": True,
            "checkpointFile": "head.pt",
            "checkpointSha256": sha256_of(head_path),
        },
        "dataset": {
            "name": "ibm-nasa-geospatial/multi-temporal-crop-classification",
            "license": "CC-BY-4.0",
            "manifest": "dataset_manifest.json",
            "trainSamples": int(train_images.shape[0]),
            "validationSamples": int(val_images.shape[0]),
            "splitStrategy": "dataset's own official chip-level train/validation split (training_data.txt / validation_data.txt) — no chip appears in both.",
        },
        "classes": [{"classIndex": i, "cdlClassId": LABEL_CLASSES[i], "name": class_index_to_name[i]} for i in range(num_classes)],
        "training": {
            "seed": SEED,
            "epochs": EPOCHS,
            "learningRate": LEARNING_RATE,
            "optimizer": "Adam",
            "lossFunction": "CrossEntropyLoss (inverse-frequency class-weighted)",
            "featureAggregation": "mean-pool over all frozen encoder patch tokens (cls token excluded)",
            "abstentionConfidenceThreshold": ABSTENTION_CONFIDENCE_THRESHOLD,
        },
        "runtime": {
            "platform": platform.platform(),
            "pythonVersion": platform.python_version(),
            "torchVersion": torch.__version__,
            "device": "cpu",
            "featureExtractionSeconds": round(feature_extraction_seconds, 2),
            "trainingSeconds": round(training_seconds, 2),
        },
        "trainedAt": trained_at,
        "evaluatedAt": trained_at,
    }
    (ML_ROOT / "manifests" / "model_manifest.json").write_text(json.dumps(model_manifest, indent=2))

    evaluation_report = {
        "trainMetrics": train_report,
        "validationMetrics_allPredictions": val_report_all,
        "validationMetrics_confidenceCoveredOnly": val_report_covered,
        "abstention": {
            "threshold": ABSTENTION_CONFIDENCE_THRESHOLD,
            "abstainedCount": int(abstained.sum()),
            "totalValidationCount": int(len(val_labels)),
            "coverageFraction": float(covered_mask.mean()) if len(covered_mask) else None,
        },
        "classIndexToName": class_index_to_name,
        "majorityClassBaseline": {
            "majorityClassIndex": majority_class,
            "majorityClassName": class_index_to_name[majority_class],
            "validationAccuracyPredictingMajorityClassAlways": majority_baseline_accuracy,
        },
        "chipPurity": {
            "trainMeanDominantClassFraction": float(np.mean(train_purity)) if train_purity else None,
            "validationMeanDominantClassFraction": float(np.mean(val_purity)) if val_purity else None,
        },
        "warnings": [
            "This evaluates CHIP-LEVEL dominant-class classification (one label per 224x224 chip), not per-pixel segmentation.",
            "Sample size is small (tens of chips per split, real numbers in trainMetrics/validationMetrics above) — a real, valid, but small experiment, not a production-scale evaluation.",
            "Several of the dataset's 13 documented classes may be absent from this small sample — see classesAbsentFromEvaluation in each report.",
        ],
    }
    (ML_ROOT / "manifests" / "evaluation_report.json").write_text(json.dumps(evaluation_report, indent=2))

    print(json.dumps({"train": train_report, "validation_all": val_report_all, "validation_covered": val_report_covered}, indent=2))


if __name__ == "__main__":
    main()
