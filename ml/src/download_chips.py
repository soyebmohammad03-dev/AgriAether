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
# Bumped from 80/40 (2% of the 3,854-chip dataset) — the root cause of the
# 35% validation accuracy was mostly sample size + chip-level label noise,
# not model choice. 720/180 (~23% of the dataset) is the largest sample that
# fits this machine's disk budget (~1.7GB) alongside the venv/checkpoints
# already using most of an 8GB-free disk. Still the dataset's own official
# train/validation split, still a per-chip (not per-pixel) disjoint sample.
N_TRAIN = 720
N_VAL = 180


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def download(url: str, dest: Path, attempts: int = 4) -> None:
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    # The Source Cooperative CDN rejects the default urllib User-Agent (403) — a real browser-like UA is required, not a workaround around any access control this dataset actually intends (it's a public, unauthenticated CC-BY-4.0 bucket).
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 AgriAether-ML-Pipeline/1.0"})
    # Retries a flaky read (this batch hit real SSL read timeouts twice over ~900 sequential
    # HTTPS requests) — without this, one bad request kills the whole run with no checkpoint
    # beyond whatever was already written to disk.
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            tmp = dest.with_suffix(dest.suffix + ".part")
            tmp.write_bytes(data)
            tmp.rename(dest)
            return
        except (TimeoutError, OSError) as e:
            last_error = e
            print(f"  retry {attempt + 1}/{attempts} for {url}: {e}", file=sys.stderr)
    raise RuntimeError(f"Failed to download {url} after {attempts} attempts") from last_error


def load_split(name: str) -> list[str]:
    return [line.strip() for line in (MANIFEST_DIR / name).read_text().splitlines() if line.strip()]


def main() -> None:
    train_ids = load_split("training_data.txt")
    val_ids = load_split("validation_data.txt")

    # Separate Random instances per split — a single shared instance means sample()'s
    # internal state after drawing train_sample depends on N_TRAIN, so changing N_TRAIN
    # would silently reshuffle val_sample too, even with N_VAL unchanged (verified: this
    # was a real bug, not theoretical — confirmed val_sample differs when only N_TRAIN
    # changes with a shared rng). The validation set must be stable under any N_TRAIN change.
    train_sample = sorted(random.Random(SEED).sample(train_ids, N_TRAIN))
    val_sample = sorted(random.Random(SEED + 1).sample(val_ids, N_VAL))

    manifest = {"seed": SEED, "source": BASE_URL, "license": "CC-BY-4.0", "splits": {}, "skippedChips": []}

    for split_name, chip_ids in (("train", train_sample), ("validation", val_sample)):
        entries = []
        for chip_id in chip_ids:
            image_url = f"{BASE_URL}/hls/{chip_id}_merged.tif"
            mask_url = f"{BASE_URL}/masks/{chip_id}.mask.tif"
            image_path = DATA_DIR / split_name / "hls" / f"{chip_id}_merged.tif"
            mask_path = DATA_DIR / split_name / "masks" / f"{chip_id}.mask.tif"
            print(f"[{split_name}] {chip_id}", file=sys.stderr)
            try:
                download(image_url, image_path)
                download(mask_url, mask_path)
            except RuntimeError as e:
                # A single chip failing after retries (e.g. server-side rate limiting after
                # ~900 sequential requests) shouldn't discard the rest of a long batch —
                # skip it and record it, never silently drop it from the manifest's account.
                print(f"  SKIPPING {chip_id}: {e}", file=sys.stderr)
                manifest["skippedChips"].append({"chipId": chip_id, "split": split_name, "reason": str(e)})
                continue
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
    print(
        f"Wrote manifest for {len(manifest['splits']['train'])} train + "
        f"{len(manifest['splits']['validation'])} validation chips "
        f"({len(manifest['skippedChips'])} skipped after retries).",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
