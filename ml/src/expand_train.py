"""
ONE-OFF audit-driven experiment: adds MORE training chips to the existing
dataset_manifest.json WITHOUT touching the validation split in any way.

Why a separate script instead of re-running download_chips.py: that script's
sampler draws train_sample and val_sample from Random state in sequence, so
changing N_TRAIN there — even after decoupling the two Random instances —
means re-deriving the manifest from scratch, which risks silently producing a
different validation set than the one already downloaded, verified, and used
for the reported 93.15% baseline (frozen fingerprint recorded below). This
script instead: keeps the current manifest's validation entries byte-for-byte
identical, and extends train_sample with NEW chip ids (not already
downloaded) drawn deterministically from the remaining official training
pool.

Run: python ml/src/expand_train.py
"""
import hashlib
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from download_chips import BASE_URL, MANIFEST_DIR, DATA_DIR, download, sha256_of, load_split  # noqa: E402

SEED = 42
N_TRAIN_TOTAL = 1600  # up from 720 — the single variable this experiment isolates
FROZEN_VAL_FINGERPRINT = "d7212c7f8353aa1edb0341c5573a963c6528aba57c05f934deb46f65020a3f31"


def main() -> None:
    manifest = json.loads((MANIFEST_DIR / "dataset_manifest.json").read_text())

    val_ids = sorted(e["chipId"] for e in manifest["splits"]["validation"])
    fingerprint = hashlib.sha256(json.dumps(val_ids).encode()).hexdigest()
    assert fingerprint == FROZEN_VAL_FINGERPRINT, "Validation set on disk does not match the frozen baseline — refusing to proceed, this experiment must not touch validation."
    print(f"Validation set verified untouched: {len(val_ids)} chips, fingerprint matches.", file=sys.stderr)

    all_train_ids = load_split("training_data.txt")
    existing_train_ids = {e["chipId"] for e in manifest["splits"]["train"]}
    print(f"Existing train chips: {len(existing_train_ids)}", file=sys.stderr)

    # Same seed/sampling logic as the original download_chips.py train draw, so this is
    # a deterministic superset of the original 720 (not a fresh independent resample).
    rng = random.Random(SEED)
    target_sample = set(rng.sample(all_train_ids, N_TRAIN_TOTAL))
    new_ids = sorted(target_sample - existing_train_ids)
    print(f"New chips to download: {len(new_ids)}", file=sys.stderr)

    skipped = list(manifest.get("skippedChips", []))
    entries = list(manifest["splits"]["train"])
    for chip_id in new_ids:
        image_url = f"{BASE_URL}/hls/{chip_id}_merged.tif"
        mask_url = f"{BASE_URL}/masks/{chip_id}.mask.tif"
        image_path = DATA_DIR / "train" / "hls" / f"{chip_id}_merged.tif"
        mask_path = DATA_DIR / "train" / "masks" / f"{chip_id}.mask.tif"
        print(f"[train+] {chip_id}", file=sys.stderr)
        try:
            download(image_url, image_path)
            download(mask_url, mask_path)
        except RuntimeError as e:
            print(f"  SKIPPING {chip_id}: {e}", file=sys.stderr)
            skipped.append({"chipId": chip_id, "split": "train", "reason": str(e)})
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

    manifest["splits"]["train"] = entries
    manifest["skippedChips"] = skipped
    # Re-verify validation entries are untouched before writing.
    assert sorted(e["chipId"] for e in manifest["splits"]["validation"]) == val_ids
    (MANIFEST_DIR / "dataset_manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"Wrote manifest: {len(entries)} train chips, {len(manifest['splits']['validation'])} validation chips (unchanged).", file=sys.stderr)


if __name__ == "__main__":
    main()
