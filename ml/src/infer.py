"""
Runs real inference (frozen Prithvi encoder + trained linear head) over the
real validation chips and writes one PredictionRecord-shaped JSON object per
chip to ml/artifacts/predictions.json — the artifact
src/satellite/PredictionImport.ts (TypeScript side) ingests.

Every prediction here is explicitly `inputSource: "MODEL_VALIDATION_DATA"`
and carries the benchmark dataset's own chip id + native CRS (EPSG:5070,
NAD83/Conus Albers — the dataset's projection, not reprojected to WGS84
here). None of these predictions are tied to, or ever presented as, the
live Iowa field from Push 1 — see ml/README.md's domain-shift section for
why that connection stays explicitly UNVERIFIED in this milestone.

Run: python ml/src/infer.py
"""
import json
import time
import uuid
from pathlib import Path

import tifffile
import torch

from dataset import BINARY_CLASS_NAMES, binary_dominant_class, dominant_class, load_chip_tensor
from model import LinearHead, extract_features, load_frozen_encoder

ML_ROOT = Path(__file__).resolve().parent.parent
ABSTENTION_CONFIDENCE_THRESHOLD = 0.5


def chip_geo_reference(image_path: Path) -> dict:
    with tifffile.TiffFile(image_path) as tif:
        tags = tif.pages[0].tags
        pixel_scale = tags["ModelPixelScaleTag"].value if "ModelPixelScaleTag" in tags else None
        tiepoint = tags["ModelTiepointTag"].value if "ModelTiepointTag" in tags else None
    return {"crs": "EPSG:5070", "crsName": "NAD83 / Conus Albers", "pixelScaleMeters": list(pixel_scale) if pixel_scale else None, "originConusAlbers": list(tiepoint) if tiepoint else None}


def main() -> None:
    manifest = json.loads((ML_ROOT / "manifests" / "dataset_manifest.json").read_text())
    model_manifest = json.loads((ML_ROOT / "manifests" / "model_manifest.json").read_text())
    val_chip_ids = [e["chipId"] for e in manifest["splits"]["validation"]]

    encoder, cfg = load_frozen_encoder(ML_ROOT / "manifests" / "prithvi_tiny_config.json", ML_ROOT / "checkpoints" / "Prithvi_EO_V2_tiny_TL.pt")
    head = LinearHead(cfg["embed_dim"], len(BINARY_CLASS_NAMES))
    head.load_state_dict(torch.load(ML_ROOT / "checkpoints" / "head.pt", map_location="cpu", weights_only=True))
    head.eval()

    predictions = []
    for chip_id in val_chip_ids:
        image_path = ML_ROOT / "data" / "validation" / "hls" / f"{chip_id}_merged.tif"
        mask_path = ML_ROOT / "data" / "validation" / "masks" / f"{chip_id}.mask.tif"
        if not image_path.exists():
            continue

        pixels = load_chip_tensor(image_path).unsqueeze(0)
        with torch.no_grad():
            features = extract_features(encoder, pixels)
            logits = head(features)
            probs = torch.softmax(logits, dim=1)[0]
        confidence, pred_idx = probs.max(dim=0)
        abstained = bool(confidence.item() < ABSTENTION_CONFIDENCE_THRESHOLD)

        actual_cdl_class, _cdl_purity = dominant_class(mask_path) if mask_path.exists() else (None, None)
        actual_binary_class, actual_purity = binary_dominant_class(mask_path) if mask_path.exists() else (None, None)

        predictions.append(
            {
                "predictionId": str(uuid.uuid4()),
                "modelName": model_manifest["modelName"],
                "modelVersion": model_manifest["head"]["checkpointSha256"][:12],
                "baseEncoder": model_manifest["baseEncoder"]["name"],
                "task": model_manifest["task"],
                "inputSource": "MODEL_VALIDATION_DATA",
                "inputChipId": chip_id,
                "inputDataset": model_manifest["dataset"]["name"],
                "inputGeoReference": chip_geo_reference(image_path),
                "predictedClassIndex": int(pred_idx.item()),
                "predictedClassId": int(pred_idx.item()),
                "predictedClassName": BINARY_CLASS_NAMES[int(pred_idx.item())],
                "confidence": float(confidence.item()),
                "probabilityDistribution": {BINARY_CLASS_NAMES[i]: float(p) for i, p in enumerate(probs.tolist())},
                "abstained": abstained,
                "abstentionReason": f"max class confidence {confidence.item():.3f} below threshold {ABSTENTION_CONFIDENCE_THRESHOLD}" if abstained else None,
                "groundTruthClassId": actual_binary_class,
                "groundTruthClassName": BINARY_CLASS_NAMES.get(actual_binary_class) if actual_binary_class is not None else None,
                "groundTruthCdlClassId": actual_cdl_class,
                "groundTruthPurity": actual_purity,
                "predictedAt": int(time.time() * 1000),
                "fieldApplicability": "UNVERIFIED_FOR_LIVE_FIELD",
            }
        )

    artifacts_dir = ML_ROOT / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    (artifacts_dir / "predictions.json").write_text(json.dumps(predictions, indent=2))
    print(f"Wrote {len(predictions)} real predictions to ml/artifacts/predictions.json")


if __name__ == "__main__":
    main()
