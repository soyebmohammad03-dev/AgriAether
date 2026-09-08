"""
Loads the real ibm-nasa-geospatial/Prithvi-EO-2.0-tiny-TL checkpoint
(Apache-2.0) as a FROZEN encoder and wraps it with a small trainable
classification head. The encoder architecture code (prithvi_mae.py) is
vendored verbatim from that model's own Hugging Face repository — this
project does not reimplement Prithvi's transformer internals.

Checkpoint: Prithvi_EO_V2_tiny_TL.pt (129MB, 12-layer/embed_dim=192 ViT),
the smallest official Prithvi-EO-2.0 variant — chosen specifically because
it is the smallest checkpoint that still represents the real Prithvi-EO-2.0
architecture family, appropriate for CPU-only, 8GB-RAM development
hardware (see ml/README.md for the full checkpoint-size comparison this
choice was based on).
"""
import json
from pathlib import Path

import torch
import torch.nn as nn

from prithvi_mae import PrithviViT

ML_ROOT = Path(__file__).resolve().parent.parent


def load_frozen_encoder(config_path: Path, checkpoint_path: Path) -> tuple[PrithviViT, dict]:
    config = json.loads(config_path.read_text())["pretrained_cfg"]
    encoder = PrithviViT(
        img_size=config["img_size"],
        patch_size=tuple(config["patch_size"]),
        num_frames=config["num_frames"],
        in_chans=config["in_chans"],
        embed_dim=config["embed_dim"],
        depth=config["depth"],
        num_heads=config["num_heads"],
        mlp_ratio=config["mlp_ratio"],
        coords_encoding=config["coords_encoding"],
        coords_scale_learn=config["coords_scale_learn"],
    )

    state_dict = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
    encoder_state = {k[len("encoder.") :]: v for k, v in state_dict.items() if k.startswith("encoder.")}
    missing, unexpected = encoder.load_state_dict(encoder_state, strict=True)
    assert not missing and not unexpected, f"Unexpected checkpoint/architecture mismatch: missing={missing} unexpected={unexpected}"

    for p in encoder.parameters():
        p.requires_grad = False
    encoder.eval()
    return encoder, config


class LinearHead(nn.Module):
    """The one trainable component in this pipeline — a single linear layer over mean-pooled frozen Prithvi patch embeddings. Deliberately not an MLP: with ~80 training chips, a larger head would overfit long before it learned anything real."""

    def __init__(self, in_dim: int, num_classes: int):
        super().__init__()
        self.linear = nn.Linear(in_dim, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.linear(x)


class MLPHead(nn.Module):
    """A slightly more capable head for the model-capacity experiment: one hidden
    layer + dropout, still small relative to n=368 training samples. Used only when
    testing whether the tiny-TL encoder's frozen features (not the linear head) were
    the capacity bottleneck — pairs with a materially larger frozen encoder (embed_dim
    768 vs 192), never with the tiny encoder, to isolate the encoder-capacity variable."""

    def __init__(self, in_dim: int, num_classes: int, hidden_dim: int = 128, dropout: float = 0.3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


@torch.no_grad()
def extract_features(encoder: PrithviViT, pixels: torch.Tensor) -> torch.Tensor:
    """
    pixels: (B, C=6, T, H, W) already normalized. Returns one mean-pooled
    feature vector per sample (B, embed_dim) — mean pooling over all patch
    tokens (no cls-token-only shortcut, no learned pooling: the simplest
    defensible aggregation for a frozen encoder feeding a linear head).
    Runs the real transformer forward pass; not a shortcut/mock.
    """
    latent, _mask, _ids_restore = encoder.forward(pixels, temporal_coords=None, location_coords=None, mask_ratio=0.0)
    # latent: (B, 1 + num_patches, embed_dim) — drop the cls token, mean-pool the rest.
    patch_tokens = latent[:, 1:, :]
    return patch_tokens.mean(dim=1)
