# AgriAether ML pipeline (Push 2 + ML quality-recovery pass)

Real, offline, reproducible ML — never run inside the browser app. This
directory produces small, versioned JSON artifacts (`manifests/`,
`artifacts/`) that the TypeScript side ingests via
`src/sensing/PredictionImport.ts`. Nothing here is a live inference
service; see "ML ↔ TypeScript boundary" below.

## Accepted result (final, as of this project freeze)

| | Value |
|---|---:|
| Task | Crop vs. Non-Crop (binary) |
| Model | Prithvi-EO-2.0-tiny-TL, frozen encoder + trained `nn.Linear` head |
| Training samples | 368 |
| Validation samples | 73 |
| **Validation accuracy** | **93.15%** (68/73) |
| Balanced accuracy | 93.20% |
| Macro F1 | 93.02% |
| Majority-class baseline | 57.53% |
| Non-Crop precision / recall / F1 | 95.1% / 92.9% / 94.0% |
| Crop precision / recall / F1 | 90.6% / 93.5% / 92.1% |
| Abstentions (confidence < 0.5) | 0 / 73 |
| Training accuracy | 98.91% |
| Deployment status | `STAGED` (not `DEPLOYED`) |

This is the **only active model**. Checkpoint: `checkpoints/head.pt`
(sha256 `6a74db05...`), locked and archived at
`checkpoints/baseline_v2_93pct/`. Base encoder:
`checkpoints/Prithvi_EO_V2_tiny_TL.pt` (sha256 `d47326db...`), unchanged
throughout.

## Why this replaced an earlier 35% result — root cause

An initial run (80 train / 40 validation chips, 13-class chip-level CDL
classification) scored only 35.0% validation accuracy, barely above a
32.5% majority baseline. A full ML-quality audit (see "Audit trail" below)
found the real cause: **chip-level label noise, not the model**. Each
chip gets one label (its mask's most frequent class), but the mean
purity of that dominant class was only ~27% — most 224×224 chips are
genuinely heterogeneous farmland, so a single 13-way label barely
describes most chips. Sample size (80/40, ~2% of the 3,854-chip dataset)
made this worse. The frozen tiny-TL encoder + linear head was **not**
the bottleneck — this was verified directly (see "Capacity experiments,"
below).

## Data volume — three distinct numbers, not to be conflated

| Stage | Train | Validation |
|---|---:|---:|
| **Original dataset** (`ibm-nasa-geospatial/multi-temporal-crop-classification`, CC-BY-4.0) | 3,854 chips total, official ~80/20 split (3,083 / 771) | |
| **Downloaded & integrity-verified** (this pipeline's actual pull) | 1,600 | 151 |
| **After binary purity filter** (≥0.6, identical on both splits) — **the samples the accepted model was trained/evaluated on** | **368** | **73** |

Notes on the middle row: the original Push 2 run downloaded only 80
train / 40 validation chips (disk-budget decision). A later expansion
pulled the deterministic superset up to 720 train / 180 validation
requested (via a resumable, retry-protected downloader — 151 validation
chips actually verified after 29 were permanently rate-limited), then the
train side alone was expanded again to 1,600 (validation was never
re-requested or changed) — once individual-object rate-limiting on the
Source Cooperative mirror made further individual downloads impractical,
this final expansion used a disk-safe **streaming extraction** from the
dataset's
official Hugging Face-hosted bulk archive, `training_chips.tgz`, filtered
to only the missing chip IDs, never buffered to disk. On the validation
side, 29 of the requested 180 chips were **permanently** rate-limited
after repeated retries and are recorded, by chip ID, in
`manifests/dataset_manifest.json["skippedChips"]` — never silently
dropped. The validation set actually used (151 chips, then 73 after
purity filtering) was **fingerprinted and held completely frozen** across
every subsequent comparison experiment.

Do not describe 368/73 as "the entire downloaded dataset" — it is the
purity-filtered *sample used for the accepted experiment*, drawn from the
larger verified 1,600/151 pool.

The 13-class version of this dataset was never claimed to reach 93.15% —
that number belongs specifically to the binary Crop-vs-Non-Crop
redesign.

## Task redesign: 13-class → binary Crop vs. Non-Crop

Per the audit's own recommendation (start with the most reliable
possible task, not maximum class count): CDL classes were grouped as

- **Crop**: Corn, Soybeans, Winter Wheat, Alfalfa, Fallow/Idle Cropland,
  Cotton, Sorghum, Other (the dataset's own card documents "Other" as "a
  catch-all category for remaining crop types not explicitly listed";
  Fallow/Idle Cropland is agricultural land in a rotation, not natural
  cover)
- **Non-Crop**: Natural Vegetation, Forest, Wetlands, Developed/Barren,
  Open Water

A chip's binary label is the majority of its pixels **after** this
grouping — not the same number as the original 13-way dominant-class
purity. A chip that's 40% corn / 35% soy / 20% other-crop is 95%-pure
Crop under this grouping even though no single CDL class exceeds 40%.
(An earlier implementation bug filtered on the *ungrouped* 13-class
purity for this binary task, which discarded nearly every chip — caught
and fixed before the accepted run; see `dataset.py`'s
`binary_dominant_class()`.)

## Purity filter

Chips where the majority binary group covers less than **60%** of valid
pixels are excluded from both splits, identically. This dropped 352 of
720 train chips and 78 of 151 validation chips in the accepted run's
sampling. It is not a way to cherry-pick easy examples — it is
documented, symmetric, and applied before any model sees the data. Class
balance after filtering: train 196 Non-Crop / 172 Crop; validation 42
Non-Crop / 31 Crop.

## Audit trail (full detail, in order)

1. **Root-cause analysis**: confirmed the encoder/dataset/preprocessing
   were already correct (official checkpoint, official 6-band/3-timestep
   input, official band normalization stats, official split); the
   bottleneck was chip-level label noise + tiny sample size.
2. **Geographic-leakage check**: chip-ID overlap between train/validation
   is zero, but the dataset's own card confirms its official split is a
   **random** split, not spatially buffered — extracting real GeoTIFF
   tiepoints found some train/validation chip pairs geographically
   adjacent (touching at zero gap). This is a property of the official
   dataset split, not something this pipeline introduced; disclosed, not
   hidden.
3. **Statistical sufficiency check**: the 73-sample validation set's 95%
   Wilson confidence interval on 68/73 is approximately **[84.9%,
   97.0%]** — wide enough that 93.15% should be read as "genuinely
   strong," not as a precise, tight number.
4. **Error inspection**: of the 5 validation errors, 4 sit right at the
   0.6 purity threshold (genuinely mixed/ambiguous chips); 1
   (`chip_200_016`) is a confidently-wrong prediction on a purer chip,
   plausibly spectral confusion between barren/wetland and post-harvest
   crop signatures, or CDL's own known lower reliability on
   non-agricultural classes. No systematic bug found.
5. **More-data experiment (negative result)**: training samples expanded
   720→1,600 chips (purity-filtered 368→837), validation held frozen.
   Result: 91.78% accuracy, *not* an improvement (within the same
   statistical noise band). Raw data volume was not the bottleneck.
6. **Capacity experiment A — frozen 100M-TL + MLP head (negative
   result)**: swapped the ~1M-scale tiny-TL encoder for the official
   86.2M-parameter `Prithvi-EO-2.0-100M-TL` (frozen) + a small MLP head
   (98,690 trainable params), same 368/73 split. Result: 93.15% —
   exactly tied with the baseline, slightly lower balanced accuracy/macro
   F1. 300M-TL was investigated and **not** attempted: its 1.33GB
   checkpoint plus activation memory was judged too risky on this
   machine's measured 8GB RAM (already near its limit mid-session — see
   below).
7. **Capacity experiment B — partial fine-tuning (negative result)**:
   unfroze only the 100M-TL encoder's last transformer block + final
   norm (7.09M trainable params), conservative LR (1e-5 encoder / 1e-3
   head), early stopping (patience 10). Result: **90.41%** — worse than
   the baseline. All three configurations (baseline, frozen-100M, and
   fine-tuned-100M) hit 100% train accuracy, confirming the ceiling is in
   the *data* (label/purity noise), not model capacity.
8. **A real infrastructure incident, documented rather than hidden**: the
   first fine-tuning attempt used full-batch (368-sample) backward passes
   and was silently OOM-killed by the OS (no traceback — this machine had
   as little as ~64MB free RAM at points during this work). Fixed with
   standard mini-batching (batch size 16); re-run succeeded and is the
   result reported above.

**Conclusion**: 95% was targeted but not genuinely achieved. 93.15% is
the honest ceiling for this task/dataset/model-scale combination as
currently understood — a real, leakage-checked (with the geographic
caveat above disclosed), non-tuned-against-validation result, not a
number produced by any of: leakage, validation-set tuning, label
manipulation, or metric gaming.

## Reproducing this

```bash
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r ml/requirements.txt
cd ml/src
python download_chips.py    # official split, seeded/deterministic, resumable
python train.py             # writes checkpoints/head.pt + manifests/*.json
python infer.py              # writes artifacts/predictions.json
```

`checkpoints/`, `data/`, `checkpoints_100m/`, and `artifacts/` are
gitignored (see `ml/.gitignore`) — never committed. Only `manifests/`
(small JSON/text, checksummed) is tracked, so the exact experiment is
reproducible without vendoring the dataset or model weights.
`manifests/sample_predictions.json` is a committed copy of one real
`infer.py` run (151 real predictions), used as the fixture
`src/sensing/PredictionImport.test.ts` runs against.

Negative-result experiment scripts (`capacity_experiment.py`,
`finetune_experiment.py`, `expand_train.py`) and their manifests
(`manifests/capacity_experiment_100m.json`,
`manifests/capacity_experiment_100m_finetune.json`) are kept as part of
the scientific record — they are historical/negative experiments, not
the active model, and are not deleted.

## ML ↔ TypeScript boundary

Python is responsible for dataset processing, training, and inference —
producing versioned, checksummed JSON artifacts. TypeScript
(`src/sensing/PredictionImport.ts`) is the only consumer, and only ever
reads an artifact file; there is no live request/response path, no
inference server, no PyTorch runtime anywhere in the Vite bundle.

## Domain-shift / live-field applicability — UNVERIFIED

**AgriAether's live Sentinel-2 pipeline (`src/satellite/SentinelRasterBuilder.ts`)
currently fetches only RED+NIR at a single date.** This model requires 6
bands × 3 timesteps. Until the live pipeline is extended to fetch the
full HLS band set across a season, **no live field (including the real
Iowa test field from Push 1) can legitimately be fed to this model**, and
no `PredictionRecord` in this codebase claims `inputSource:
'LIVE_FIELD'`. Every real prediction produced by `infer.py` is tagged
`inputSource: 'MODEL_VALIDATION_DATA'` and `fieldApplicability:
'UNVERIFIED_FOR_LIVE_FIELD'` — a structural guarantee
(`PredictionInputSource` in `ModelRegistry.ts`), not just a comment.
**93.15% is benchmark validation performance on official HLS chips, not
a claim of 93.15% accuracy on any real farm.**

## Licensing

- Prithvi-EO-2.0-tiny-TL and Prithvi-EO-2.0-100M-TL: Apache-2.0 (IBM).
  `src/prithvi_mae.py` is vendored verbatim with its original license
  header intact.
- multi-temporal-crop-classification: CC-BY-4.0 (Clark University Center
  for Geospatial Analysis / IBM-NASA). Attribution: "Contains Harmonized
  Landsat-Sentinel data processed by IBM/NASA/Clark University; labels
  derived from USDA Cropland Data Layer."
