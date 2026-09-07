"""
Downloads a small, deterministic, seeded subset of the real
ibm-nasa-geospatial/multi-temporal-crop-classification dataset (CC-BY-4.0)
directly from its Source Cooperative S3 mirror — individual chip objects,
never the 10.6GB training_chips.tgz — so this stays disk-safe.

Preserves the dataset's OWN official train/validation split
(training_data.txt / validation_data.txt, committed under ml/manifests/) to
avoid any spatial/temporal leakage: every chip used for evaluation here was
never seen during head training, exactly as the dataset's authors intended.

Nothing downloaded here is committed to git — see ml/.gitignore. Only the
manifest this script writes (chip ids actually used + checksums) is
committed, so the exact experiment is reproducible without vendoring the
data itself.
"""
import hashlib
import json
import random
import sys
import urllib.request
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ML_ROOT / "data"
MANIFEST_DIR = ML_ROOT / "manifests"

BASE_URL = "https://data.source.coop/clarkcga/multi-temporal-crop-classification"
SEED = 42
N_TRAIN = 80
N_VAL = 40


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def download(url: str, dest: Path) -> None:
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    # The Source Cooperative CDN rejects the default urllib User-Agent (403) — a real browser-like UA is required, not a workaround around any access control this dataset actually intends (it's a public, unauthenticated CC-BY-4.0 bucket).
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 AgriAether-ML-Pipeline/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        dest.write_bytes(resp.read())


def load_split(name: str) -> list[str]:
    return [line.strip() for line in (MANIFEST_DIR / name).read_text().splitlines() if line.strip()]


def main() -> None:
    train_ids = load_split("training_data.txt")
    val_ids = load_split("validation_data.txt")

    rng = random.Random(SEED)
    train_sample = sorted(rng.sample(train_ids, N_TRAIN))
    val_sample = sorted(rng.sample(val_ids, N_VAL))

    manifest = {"seed": SEED, "source": BASE_URL, "license": "CC-BY-4.0", "splits": {}}

    for split_name, chip_ids in (("train", train_sample), ("validation", val_sample)):
        entries = []
        for chip_id in chip_ids:
            image_url = f"{BASE_URL}/hls/{chip_id}_merged.tif"
            mask_url = f"{BASE_URL}/masks/{chip_id}.mask.tif"
            image_path = DATA_DIR / split_name / "hls" / f"{chip_id}_merged.tif"
            mask_path = DATA_DIR / split_name / "masks" / f"{chip_id}.mask.tif"
            print(f"[{split_name}] {chip_id}", file=sys.stderr)
            download(image_url, image_path)
            download(mask_url, mask_path)
            entries.append(
                {
                    "chipId": chip_id,
                    "imageSha256": sha256_of(image_path),
                    "maskSha256": sha256_of(mask_path),
                    "imageBytes": image_path.stat().st_size,
                    "maskBytes": mask_path.stat().st_size,
                }
            )
        manifest["splits"][split_name] = entries

    (MANIFEST_DIR / "dataset_manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"Wrote manifest for {len(train_sample)} train + {len(val_sample)} validation chips.", file=sys.stderr)


if __name__ == "__main__":
    main()
