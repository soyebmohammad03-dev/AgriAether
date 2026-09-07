# AgriAether ML pipeline (Push 2)

Real, offline, reproducible ML — never run inside the browser app. This
directory produces small, versioned JSON artifacts (`manifests/`,
`artifacts/`) that the TypeScript side ingests via
`src/sensing/PredictionImport.ts`. Nothing here is a live inference
service; see "ML ↔ TypeScript boundary" below.

## What's real here

- **Base model**: [`ibm-nasa-geospatial/Prithvi-EO-2.0-tiny-TL`](https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-tiny-TL)
  (Apache-2.0), the smallest official Prithvi-EO-2.0 checkpoint (129MB;
  compared before choosing: Prithvi-EO-2.0-300M is 1.24GB, -600M larger
  still — the tiny-TL variant is the only one that fits this development
  environment's 8GB RAM / ~8GB free disk without threatening the rest of
  the repository's disk budget). 12-layer ViT, embed_dim 192, frozen in
  full — zero gradient ever flows into it.
- **Trainable component**: one `nn.Linear(192, 13)` head. Nothing else is
  trained. With 80 real training samples, anything larger overfits before
  it generalizes — this is a deliberate, documented scope limit, not an
  oversight.
- **Dataset**: [`ibm-nasa-geospatial/multi-temporal-crop-classification`](https://huggingface.co/datasets/ibm-nasa-geospatial/multi-temporal-crop-classification)
  (CC-BY-4.0). Real Harmonized Landsat-Sentinel (HLS) imagery, 3 timesteps
  x 6 bands (Blue/Green/Red/NIR/SWIR1/SWIR2), 224x224px @ 30m, over CONUS,
  2022, labeled from the USDA Cropland Data Layer. 3,854 chips total; this
  pipeline downloads a **seeded, deterministic 80-train / 40-validation
  subset** (`download_chips.py`, seed 42) directly from the dataset's
  Source Cooperative S3 mirror — individual chip objects, never the
  10.6GB `training_chips.tgz` (this machine had ~8GB free disk; that file
  alone wouldn't fit).
- **Split**: the dataset's own official `training_data.txt` /
  `validation_data.txt` chip-id lists (committed under `manifests/`) are
  used as-is. Every chip is one disjoint 224x224 CONUS area, so there is
  no spatial leakage between the two sets — no chip used for training ever
  appears in validation.
- **Task**: chip-level dominant-class classification (the mask's most
  frequent non-nodata class becomes the chip's one label), NOT per-pixel
  segmentation. A genuine simplification: chip "purity" (how much of the
  chip its dominant class actually covers) averages only ~27% in this
  sample — most chips are heterogeneous, so this task is intentionally
  coarse, not a claim of segmentation-grade accuracy.

## Real results (not manufactured)

See `manifests/evaluation_report.json` and `manifests/model_manifest.json`
for the full record. Headline numbers from the actual run:

| | Train (n=80) | Validation (n=40, official held-out split) |
|---|---|---|
| Accuracy | 97.5% | **35.0%** |
| Balanced accuracy | 99.4% | 23.7% |
| Macro F1 | 99.0% | 34.7% |
| Majority-class baseline accuracy | — | 32.5% |

**Honest read**: training accuracy is high because a linear head over a
strong frozen encoder can nearly memorize 80 examples. Validation accuracy
(35%) is only ~2.5 points above the majority-class baseline (always
predicting "Natural Vegetation": 32.5%) — this model is real, genuinely
evaluated on genuinely unseen data, and **not fit for any production
agricultural decision**. `ModelRegistry.ts`'s `TRAINED_MODELS` entry is
therefore `deploymentStatus: 'STAGED'`, not `'DEPLOYED'`, even though it
structurally satisfies the DEPLOYED gate (real artifact/metrics/
timestamps) — STAGED is the honest call given how weak the real numbers
are.

With a softmax-confidence abstention threshold of 0.5, the model abstains
on 17/40 (42.5%) of validation chips rather than forcing a low-confidence
guess; among the 23 chips it does answer, accuracy is 30.4% — abstention
does not "fix" the weak performance, and is reported as such.

## Reproducing this

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r ml/requirements.txt
cd ml/src
python download_chips.py   # ~230MB, seeded/deterministic, ~5 min
python train.py            # writes checkpoints/head.pt + manifests/*.json
python infer.py            # writes artifacts/predictions.json
```

`checkpoints/`, `data/`, and `artifacts/` are gitignored (see `ml/.gitignore`)
— never committed. Only `manifests/` (small JSON/text, checksummed) is
tracked, so the exact experiment is reproducible without vendoring the
dataset or model weights. `manifests/sample_predictions.json` is a
committed copy of one real `infer.py` run, used as the fixture
`src/sensing/PredictionImport.test.ts` runs against.

## ML ↔ TypeScript boundary

Python is responsible for dataset processing, training, and inference —
producing versioned, checksummed JSON artifacts. TypeScript
(`src/sensing/PredictionImport.ts`) is the only consumer, and only ever
reads an artifact file; there is no live request/response path, no
inference server, no PyTorch runtime anywhere in the Vite bundle. This is
deliberate: see the Push 2 brief's explicit "no giant PyTorch runtime in
the browser, no unnecessary microservice."

## Domain-shift / live-field applicability — UNVERIFIED

**AgriAether's live Sentinel-2 pipeline (`src/satellite/SentinelRasterBuilder.ts`)
currently fetches only RED+NIR at a single date.** This model requires 6
bands x 3 timesteps. Until the live pipeline is extended to fetch the full
HLS band set across a season, **no live field (including the real Iowa
test field from Push 1) can legitimately be fed to this model**, and no
`PredictionRecord` in this codebase claims `inputSource: 'LIVE_FIELD'`.
Every real prediction produced by `infer.py` is tagged
`inputSource: 'MODEL_VALIDATION_DATA'` and `fieldApplicability:
'UNVERIFIED_FOR_LIVE_FIELD'` — this is a structural guarantee
(`PredictionInputSource` in `ModelRegistry.ts`), not just a comment.

## Licensing

- Prithvi-EO-2.0-tiny-TL: Apache-2.0 (IBM). `src/prithvi_mae.py` is
  vendored verbatim with its original license header intact.
- multi-temporal-crop-classification: CC-BY-4.0 (Clark University Center
  for Geospatial Analysis / IBM-NASA). Attribution: "Contains Harmonized
  Landsat-Sentinel data processed by IBM/NASA/Clark University; labels
  derived from USDA Cropland Data Layer."
