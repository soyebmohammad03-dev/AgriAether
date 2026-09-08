"""
Reads the real downloaded HLS multi-temporal chips (see download_chips.py)
into Prithvi-ready tensors, and reduces each chip's per-pixel CDL-derived
mask into one "dominant class" label — a genuine simplification (this
pipeline classifies a whole 224x224 chip, not per-pixel segmentation),
documented as such rather than silently presented as pixel-level accuracy.
"""
from collections import Counter
from pathlib import Path

import numpy as np
import tifffile
import torch

CLASS_NAMES = {
    0: "No Data",
    1: "Natural Vegetation",
    2: "Forest",
    3: "Corn",
    4: "Soybeans",
    5: "Wetlands",
    6: "Developed/Barren",
    7: "Open Water",
    8: "Winter Wheat",
    9: "Alfalfa",
    10: "Fallow/Idle Cropland",
    11: "Cotton",
    12: "Sorghum",
    13: "Other",
}
# Class 0 ("No Data") is never a valid dominant-class label — see dominant_class().
LABEL_CLASSES = sorted(c for c in CLASS_NAMES if c != 0)

# TASK A (crop vs non-crop) grouping — per the dataset's HF card, "Other" is
# documented as "a catch-all category for remaining crop or land cover types
# not explicitly listed" among the CDL-derived classes, and "Fallow/Idle
# Cropland" is agricultural land in a rotation, not natural land cover — both
# grouped as CROP. Every other class is a natural/developed/water land-cover
# type, not an agricultural production class.
CROP_CLASSES = {3, 4, 8, 9, 10, 11, 12, 13}  # Corn, Soybeans, Winter Wheat, Alfalfa, Fallow/Idle Cropland, Cotton, Sorghum, Other
NONCROP_CLASSES = {1, 2, 5, 6, 7}  # Natural Vegetation, Forest, Wetlands, Developed/Barren, Open Water
assert CROP_CLASSES | NONCROP_CLASSES == set(LABEL_CLASSES)
BINARY_CLASS_NAMES = {0: "Non-Crop", 1: "Crop"}


def to_binary_label(cdl_class_id: int) -> int:
    return 1 if cdl_class_id in CROP_CLASSES else 0

# Real HLS L2 surface-reflectance normalization stats from the Prithvi-EO-2.0-tiny-TL
# checkpoint's own config.json (pretrained_cfg.mean / .std) — not invented here.
BAND_MEAN = np.array([1087.0, 1342.0, 1433.0, 2734.0, 1958.0, 1363.0], dtype=np.float32)
BAND_STD = np.array([2248.0, 2179.0, 2178.0, 1850.0, 1242.0, 1049.0], dtype=np.float32)


def load_chip_tensor(image_path: Path) -> torch.Tensor:
    """Returns a normalized (C=6, T=3, H=224, W=224) tensor — the layout Prithvi's PatchEmbed expects."""
    raw = tifffile.imread(image_path)  # (H, W, 18): 3 timesteps of 6 bands each, per the dataset's documented band order.
    h, w, c = raw.shape
    assert c == 18, f"Expected 18 channels (6 bands x 3 timesteps), got {c} in {image_path}"
    per_time = raw.reshape(h, w, 3, 6).astype(np.float32)  # (H, W, T, C)
    normalized = (per_time - BAND_MEAN) / BAND_STD
    # (H, W, T, C) -> (C, T, H, W)
    chw = np.transpose(normalized, (3, 2, 0, 1))
    return torch.from_numpy(chw.copy())


def dominant_class(mask_path: Path) -> tuple[int, float]:
    """Returns (class_id, fraction_of_valid_pixels) — the most frequent non-"No Data" class in the mask, and how much of the chip it actually covers (never assumed to be 100%)."""
    mask = tifffile.imread(mask_path)
    valid = mask[mask != 0]
    if valid.size == 0:
        return 0, 0.0
    counts = Counter(valid.tolist())
    top_class, top_count = counts.most_common(1)[0]
    return top_class, top_count / valid.size


def binary_dominant_class(mask_path: Path) -> tuple[int | None, float]:
    """Returns (binaryLabel, fraction_of_valid_pixels) computed AFTER grouping every
    pixel's CDL class into crop/non-crop — not the same number as dominant_class()'s
    13-way purity. A chip that's 40% corn / 35% soy / 20% other-crop / 5% forest is
    95%-pure CROP under this grouping even though no single CDL class exceeds 40%;
    filtering on the ungrouped 13-way purity for a binary task discards almost every
    real chip for no reason. Returns (None, 0.0) for an all-nodata chip."""
    mask = tifffile.imread(mask_path)
    valid = mask[mask != 0]
    if valid.size == 0:
        return None, 0.0
    binary_valid = np.vectorize(to_binary_label)(valid)
    counts = Counter(binary_valid.tolist())
    top_label, top_count = counts.most_common(1)[0]
    return top_label, top_count / valid.size


def load_split(
    data_dir: Path, chip_ids: list[str], min_purity: float = 0.0, binary: bool = False
) -> tuple[torch.Tensor, torch.Tensor, list[float], int]:
    """min_purity: drop chips whose dominant class covers less than this fraction of
    valid pixels — a chip that's 40% corn / 35% soy / 25% other is not honestly
    summarized by one label. Returns (images, labels, purities, droppedLowPurityCount)
    so the filtering is auditable, never silent."""
    tensors, labels, purities = [], [], []
    dropped_low_purity = 0
    for chip_id in chip_ids:
        image_path = data_dir / "hls" / f"{chip_id}_merged.tif"
        mask_path = data_dir / "masks" / f"{chip_id}.mask.tif"
        if binary:
            label, purity = binary_dominant_class(mask_path)
            if label is None:
                continue  # entirely nodata chip — excluded, never labeled as a real class
        else:
            cls, purity = dominant_class(mask_path)
            if cls == 0:
                continue
            label = LABEL_CLASSES.index(cls)
        if purity < min_purity:
            dropped_low_purity += 1
            continue
        tensors.append(load_chip_tensor(image_path))
        labels.append(label)
        purities.append(purity)
    if not tensors:
        return torch.empty(0), torch.empty(0, dtype=torch.long), [], dropped_low_purity
    return torch.stack(tensors), torch.tensor(labels, dtype=torch.long), purities, dropped_low_purity
