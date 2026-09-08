"""
Model-capacity experiment (audit-driven): does a materially larger frozen
Prithvi-EO-2.0 encoder (100M-TL, embed_dim 768) + a more capable head beat the
93.15% tiny-TL (embed_dim 192) + linear-head baseline, on the EXACT SAME 368
train / 73 validation purity-filtered samples? Isolates encoder capacity as
the only changed variable — same task, same split, same purity filter, same
seed, same abstention threshold, same class weighting.

The 368 training chip ids are regenerated deterministically (same seed/N_TRAIN
as the original download) rather than re-derived from the now-larger 1600-chip
pool on disk, so this is the identical training set the 93.15% baseline used —
not a coincidentally-similar-sized one.

Run: python ml/src/capacity_experiment.py
"""
import hashlib
import json
import random
import resource
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

from dataset import BINARY_CLASS_NAMES, load_split
from metrics import classification_report
from model import MLPHead, extract_features, load_frozen_encoder

ML_ROOT = Path(__file__).resolve().parent.parent
SEED = 42
ORIGINAL_N_TRAIN = 720  # the pool the 93.15% baseline's 368 samples were purity-filtered from
MIN_PURITY = 0.6
ABSTENTION_CONFIDENCE_THRESHOLD = 0.5
FEATURE_BATCH_SIZE = 8
EPOCHS = 300
LEARNING_RATE = 1e-2
FROZEN_VAL_FINGERPRINT = "d7212c7f8353aa1edb0341c5573a963c6528aba57c05f934deb46f65020a3f31"


def batched_features(encoder, images, device):
    feats = []
    for i in range(0, images.shape[0], FEATURE_BATCH_SIZE):
        batch = images[i : i + FEATURE_BATCH_SIZE].to(device)
        feats.append(extract_features(encoder, batch).cpu())
    return torch.cat(feats, dim=0)


def main():
    torch.manual_seed(SEED)
    np.random.seed(SEED)

    # MPS was tried first (measured available) but the vendored prithvi_mae.py has a
    # pos_embed device-placement bug under MPS (RuntimeError: mps:0 vs cpu) — not
    # patching vendored third-party code for this; CPU is slower but correct, and with
    # 8 cores + 368+73 samples this stays well within a tractable single-digit-minutes run.
    device = "cpu"
    print(f"Using device: {device} (MPS has a vendored-code device-placement bug, see comment)")

    manifest = json.loads((ML_ROOT / "manifests" / "dataset_manifest.json").read_text())

    def load_split_ids(name):
        return [l.strip() for l in (ML_ROOT / "manifests" / name).read_text().splitlines() if l.strip()]

    all_train_ids = load_split_ids("training_data.txt")
    train_ids = sorted(random.Random(SEED).sample(all_train_ids, ORIGINAL_N_TRAIN))
    val_ids = sorted(e["chipId"] for e in manifest["splits"]["validation"])

    fingerprint = hashlib.sha256(json.dumps(val_ids).encode()).hexdigest()
    assert fingerprint == FROZEN_VAL_FINGERPRINT, "Validation set does not match the frozen baseline fingerprint."
    print(f"Validation set verified: {len(val_ids)} chips, matches frozen baseline fingerprint.")

    train_images, train_labels, train_purity, train_dropped = load_split(
        ML_ROOT / "data" / "train", train_ids, min_purity=MIN_PURITY, binary=True
    )
    val_images, val_labels, val_purity, val_dropped = load_split(
        ML_ROOT / "data" / "validation", val_ids, min_purity=MIN_PURITY, binary=True
    )
    print(f"train samples: {train_images.shape[0]} (expect 368), validation samples: {val_images.shape[0]} (expect 73)")
    assert train_images.shape[0] == 368, f"Train set does not match baseline size — expected 368, got {train_images.shape[0]}"
    assert val_images.shape[0] == 73, f"Validation set does not match baseline size — expected 73, got {val_images.shape[0]}"

    config_path = ML_ROOT / "checkpoints_100m" / "config.json"
    checkpoint_path = ML_ROOT / "checkpoints_100m" / "Prithvi_EO_V2_100M_TL.pt"
    encoder, cfg = load_frozen_encoder(config_path, checkpoint_path)
    encoder = encoder.to(device)
    embed_dim = cfg["embed_dim"]

    frozen_params = sum(p.numel() for p in encoder.parameters())
    print(f"Encoder: embed_dim={embed_dim}, depth={cfg['depth']}, frozen params={frozen_params:,}")

    t0 = time.time()
    train_features = batched_features(encoder, train_images, device)
    val_features = batched_features(encoder, val_images, device)
    feature_extraction_seconds = time.time() - t0
    print(f"Feature extraction: {feature_extraction_seconds:.1f}s on {device}")

    num_classes = len(BINARY_CLASS_NAMES)
    head = MLPHead(embed_dim, num_classes, hidden_dim=128, dropout=0.3)
    trainable_params = sum(p.numel() for p in head.parameters())
    print(f"Head: MLP(768->128->2), trainable params={trainable_params:,}")

    class_counts = torch.bincount(train_labels, minlength=num_classes).float()
    class_weight = torch.where(class_counts > 0, 1.0 / class_counts.clamp(min=1), torch.zeros_like(class_counts))
    class_weight = class_weight * (num_classes / class_weight.sum().clamp(min=1e-8))
    criterion = nn.CrossEntropyLoss(weight=class_weight)
    optimizer = torch.optim.Adam(head.parameters(), lr=LEARNING_RATE, weight_decay=1e-4)

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

    train_report = classification_report(train_labels.numpy(), train_pred.numpy(), num_classes)
    val_report = classification_report(val_labels.numpy(), val_pred.numpy(), num_classes)

    peak_rss_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 / 1024  # macOS: bytes -> MB

    result = {
        "experiment": "model_capacity_100M_TL_frozen_mlp_head",
        "encoder": {"name": "Prithvi-EO-2.0-100M-TL", "embedDim": embed_dim, "depth": cfg["depth"], "frozenParams": frozen_params},
        "head": {"type": "MLP(768->128->2, dropout=0.3)", "trainableParams": trainable_params},
        "device": device,
        "trainSamples": int(train_images.shape[0]),
        "validationSamples": int(val_images.shape[0]),
        "trainMetrics": train_report,
        "validationMetrics": val_report,
        "abstention": {"threshold": ABSTENTION_CONFIDENCE_THRESHOLD, "abstainedCount": int(abstained.sum()), "totalValidationCount": int(len(val_labels))},
        "classIndexToName": BINARY_CLASS_NAMES,
        "runtime": {
            "featureExtractionSeconds": round(feature_extraction_seconds, 2),
            "trainingSeconds": round(training_seconds, 2),
            "peakRssMb": round(peak_rss_mb, 1),
        },
    }
    out_path = ML_ROOT / "manifests" / "capacity_experiment_100m.json"
    out_path.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()
