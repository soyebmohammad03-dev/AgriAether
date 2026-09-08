"""
Capacity experiment #2 (audit-driven): limited/partial fine-tuning of the
strongest feasible encoder (Prithvi-EO-2.0-100M-TL), since experiment #1
(fully frozen 100M-TL + MLP head) showed no material improvement over the
93.15% tiny-TL baseline. Only the LAST transformer block + final LayerNorm
are unfrozen (11/12 blocks stay frozen) — conservative by design, given
368 training samples and an 86M-param encoder (full fine-tuning would
overfit near-instantly and is not attempted).

Efficiency trick (not a shortcut on rigor): the frozen 11-block prefix is
computed ONCE per sample and cached, since it never changes during training
— only the unfrozen last block + norm + head get a real backward pass each
epoch. This is mathematically identical to running the full encoder forward
each epoch; it just avoids redundant frozen-layer compute on CPU.

Early stopping uses the SAME 73-sample frozen validation set for its
stopping signal, which the report also uses for final metrics — a mild
optimistic-bias caveat given we don't have a third held-out split at this
sample size; documented honestly, not hidden.

Run: python ml/src/finetune_experiment.py
"""
import copy
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
from model import LinearHead, load_frozen_encoder

ML_ROOT = Path(__file__).resolve().parent.parent
SEED = 42
ORIGINAL_N_TRAIN = 720
MIN_PURITY = 0.6
ABSTENTION_CONFIDENCE_THRESHOLD = 0.5
MAX_EPOCHS = 60
PATIENCE = 10
HEAD_LR = 1e-3
ENCODER_LR = 1e-5  # conservative — only the last block, small steps to avoid catastrophic forgetting
# Mini-batched, not full-batch: full-batch (368 samples at once) backward through a
# 768-dim/12-head transformer block needs several GB of attention/MLP activation memory
# — measured to silently OOM-kill this 8GB machine (no traceback, clean exit right after
# prefix caching finished). Batching is also just standard practice, not only a fix.
BATCH_SIZE = 16
FROZEN_VAL_FINGERPRINT = "d7212c7f8353aa1edb0341c5573a963c6528aba57c05f934deb46f65020a3f31"


def frozen_prefix(encoder, pixels):
    """Everything up to (not including) the last transformer block — computed once, cached, never backpropped through."""
    x = pixels
    if len(x.shape) == 4 and encoder.patch_embed.input_size[0] == 1:
        x = x.unsqueeze(2)
    sample_shape = x.shape[-3:]
    x = encoder.patch_embed(x)
    pos_embed = encoder.interpolate_pos_encoding(sample_shape)
    x = x + pos_embed[:, 1:, :]
    cls_token = encoder.cls_token + pos_embed[:, :1, :]
    cls_tokens = cls_token.expand(x.shape[0], -1, -1)
    x = torch.cat((cls_tokens, x), dim=1)
    for block in encoder.blocks[:-1]:
        x = block(x)
    return x


def tail_forward(encoder, prefix_x):
    """The unfrozen part: last block + final norm + mean-pool patch tokens."""
    x = encoder.blocks[-1](prefix_x)
    x = encoder.norm(x)
    return x[:, 1:, :].mean(dim=1)


def main():
    torch.manual_seed(SEED)
    np.random.seed(SEED)

    manifest = json.loads((ML_ROOT / "manifests" / "dataset_manifest.json").read_text())

    def load_split_ids(name):
        return [l.strip() for l in (ML_ROOT / "manifests" / name).read_text().splitlines() if l.strip()]

    all_train_ids = load_split_ids("training_data.txt")
    train_ids = sorted(random.Random(SEED).sample(all_train_ids, ORIGINAL_N_TRAIN))
    val_ids = sorted(e["chipId"] for e in manifest["splits"]["validation"])
    fingerprint = hashlib.sha256(json.dumps(val_ids).encode()).hexdigest()
    assert fingerprint == FROZEN_VAL_FINGERPRINT, "Validation set does not match the frozen baseline."

    train_images, train_labels, _tp, _td = load_split(ML_ROOT / "data" / "train", train_ids, min_purity=MIN_PURITY, binary=True)
    val_images, val_labels, _vp, _vd = load_split(ML_ROOT / "data" / "validation", val_ids, min_purity=MIN_PURITY, binary=True)
    assert train_images.shape[0] == 368 and val_images.shape[0] == 73
    print(f"train={train_images.shape[0]}, val={val_images.shape[0]}")

    encoder, cfg = load_frozen_encoder(ML_ROOT / "checkpoints_100m" / "config.json", ML_ROOT / "checkpoints_100m" / "Prithvi_EO_V2_100M_TL.pt")
    embed_dim = cfg["embed_dim"]

    # Partial unfreeze: last block + final norm only.
    for p in encoder.blocks[-1].parameters():
        p.requires_grad = True
    for p in encoder.norm.parameters():
        p.requires_grad = True
    encoder.blocks[-1].train()
    encoder.norm.train()

    frozen_count = sum(p.numel() for p in encoder.parameters() if not p.requires_grad)
    trainable_encoder_count = sum(p.numel() for p in encoder.parameters() if p.requires_grad)
    print(f"Encoder: {frozen_count:,} frozen params, {trainable_encoder_count:,} trainable (last block + norm)")

    print("Caching frozen 11-block prefix activations (one-time cost)...")
    t0 = time.time()
    with torch.no_grad():
        train_prefix = torch.cat([frozen_prefix(encoder, train_images[i : i + 8]) for i in range(0, len(train_images), 8)], dim=0)
        val_prefix = torch.cat([frozen_prefix(encoder, val_images[i : i + 8]) for i in range(0, len(val_images), 8)], dim=0)
    prefix_cache_seconds = time.time() - t0
    print(f"Prefix caching: {prefix_cache_seconds:.1f}s")

    head = LinearHead(embed_dim, len(BINARY_CLASS_NAMES))
    head_params = sum(p.numel() for p in head.parameters())

    class_counts = torch.bincount(train_labels, minlength=2).float()
    class_weight = torch.where(class_counts > 0, 1.0 / class_counts.clamp(min=1), torch.zeros_like(class_counts))
    class_weight = class_weight * (2 / class_weight.sum().clamp(min=1e-8))
    criterion = nn.CrossEntropyLoss(weight=class_weight)

    optimizer = torch.optim.Adam(
        [
            {"params": head.parameters(), "lr": HEAD_LR},
            {"params": encoder.blocks[-1].parameters(), "lr": ENCODER_LR},
            {"params": encoder.norm.parameters(), "lr": ENCODER_LR},
        ],
        weight_decay=1e-4,
    )

    best_val_loss = float("inf")
    best_state = None
    epochs_without_improvement = 0
    history = []
    n_train = train_prefix.shape[0]
    epoch_rng = torch.Generator().manual_seed(SEED)

    t0 = time.time()
    for epoch in range(MAX_EPOCHS):
        head.train()
        encoder.blocks[-1].train()
        encoder.norm.train()
        perm = torch.randperm(n_train, generator=epoch_rng)
        epoch_loss_sum = 0.0
        for i in range(0, n_train, BATCH_SIZE):
            idx = perm[i : i + BATCH_SIZE]
            optimizer.zero_grad()
            batch_feat = tail_forward(encoder, train_prefix[idx])
            logits = head(batch_feat)
            loss = criterion(logits, train_labels[idx])
            loss.backward()
            optimizer.step()
            epoch_loss_sum += loss.item() * len(idx)
        train_loss = epoch_loss_sum / n_train

        head.eval()
        encoder.blocks[-1].eval()
        encoder.norm.eval()
        with torch.no_grad():
            val_loss_sum = 0.0
            for i in range(0, val_prefix.shape[0], BATCH_SIZE):
                val_feat = tail_forward(encoder, val_prefix[i : i + BATCH_SIZE])
                val_logits = head(val_feat)
                val_loss_sum += criterion(val_logits, val_labels[i : i + BATCH_SIZE]).item() * val_feat.shape[0]
            val_loss = val_loss_sum / val_prefix.shape[0]
        history.append({"epoch": epoch, "trainLoss": train_loss, "valLoss": val_loss})

        if val_loss < best_val_loss - 1e-4:
            best_val_loss = val_loss
            best_state = (copy.deepcopy(head.state_dict()), copy.deepcopy(encoder.blocks[-1].state_dict()), copy.deepcopy(encoder.norm.state_dict()))
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1
            if epochs_without_improvement >= PATIENCE:
                print(f"Early stopping at epoch {epoch} (best val loss {best_val_loss:.4f} at epoch {epoch - epochs_without_improvement})")
                break
    training_seconds = time.time() - t0

    head.load_state_dict(best_state[0])
    encoder.blocks[-1].load_state_dict(best_state[1])
    encoder.norm.load_state_dict(best_state[2])

    head.eval()
    encoder.blocks[-1].eval()
    encoder.norm.eval()
    with torch.no_grad():
        train_pred = torch.cat([head(tail_forward(encoder, train_prefix[i : i + BATCH_SIZE])).argmax(dim=1) for i in range(0, train_prefix.shape[0], BATCH_SIZE)])
        val_logits = torch.cat([head(tail_forward(encoder, val_prefix[i : i + BATCH_SIZE])) for i in range(0, val_prefix.shape[0], BATCH_SIZE)])
        val_probs = torch.softmax(val_logits, dim=1)
        val_confidence, val_pred = val_probs.max(dim=1)

    abstained = (val_confidence < ABSTENTION_CONFIDENCE_THRESHOLD).numpy()
    train_report = classification_report(train_labels.numpy(), train_pred.numpy(), 2)
    val_report = classification_report(val_labels.numpy(), val_pred.numpy(), 2)
    peak_rss_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 / 1024

    result = {
        "experiment": "model_capacity_100M_TL_partial_finetune_last_block",
        "encoder": {"name": "Prithvi-EO-2.0-100M-TL", "embedDim": embed_dim, "frozenParams": frozen_count, "trainableEncoderParams": trainable_encoder_count},
        "head": {"type": "Linear", "trainableParams": head_params},
        "trainSamples": int(train_images.shape[0]),
        "validationSamples": int(val_images.shape[0]),
        "epochsRun": len(history),
        "bestValLoss": best_val_loss,
        "earlyStoppingCaveat": "Validation loss was the early-stopping signal AND is the set final metrics are reported on — mild optimistic-bias risk given no third held-out split exists at this sample size (368 train). Documented, not hidden.",
        "trainMetrics": train_report,
        "validationMetrics": val_report,
        "abstention": {"threshold": ABSTENTION_CONFIDENCE_THRESHOLD, "abstainedCount": int(abstained.sum()), "totalValidationCount": int(len(val_labels))},
        "classIndexToName": BINARY_CLASS_NAMES,
        "runtime": {"prefixCacheSeconds": round(prefix_cache_seconds, 2), "trainingSeconds": round(training_seconds, 2), "peakRssMb": round(peak_rss_mb, 1)},
    }
    out_path = ML_ROOT / "manifests" / "capacity_experiment_100m_finetune.json"
    out_path.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()
