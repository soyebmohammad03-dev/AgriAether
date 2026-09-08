# Third-Party Notices

AgriAether's own source code is [MIT licensed](LICENSE). This file records
the external models, datasets, and data services this project uses or is
built against. None of them are relicensed, redistributed in bulk, or
claimed as this project's own — see each entry for how it's actually
used here.

## Machine learning model

**Prithvi-EO-2.0** (`Prithvi-EO-2.0-tiny-TL`, and `Prithvi-EO-2.0-100M-TL`
in a documented negative experiment) — © IBM & NASA
(`ibm-nasa-geospatial`), licensed **Apache License 2.0**. Used here as a
frozen encoder; `ml/src/prithvi_mae.py` vendors the model's own
architecture code verbatim with its original license header intact.
Checkpoint weights are downloaded at reproduction time
(`ml/README.md`) and are gitignored — never committed to this
repository.

## Dataset

**`ibm-nasa-geospatial/multi-temporal-crop-classification`** — © Clark
University Center for Geospatial Analysis / IBM-NASA, licensed
**CC-BY-4.0**. Attribution: "Contains Harmonized Landsat-Sentinel data
processed by IBM/NASA/Clark University; labels derived from USDA
Cropland Data Layer." This project downloads a verified subset at
reproduction time (`ml/README.md`); the dataset itself is never vendored
or committed to this repository (`ml/data/` is gitignored).

## Satellite imagery

**Sentinel-2 L2A** imagery — © Copernicus / European Space Agency (ESA),
made available under the Copernicus open-data policy, accessed here via
**Microsoft Planetary Computer**'s public STAC API
(`src/satellite/`). AgriAether does not cache or redistribute bulk
Sentinel-2 imagery in this repository.

## Weather data

**Open-Meteo** (`src/weather/OpenMeteoProvider.ts`) — a free, keyless
weather API. See [open-meteo.com](https://open-meteo.com/) for its terms.

## Software dependencies

All npm dependencies (see `package.json`) and Python dependencies (see
`ml/requirements.txt`) retain their own individual licenses as declared
by their respective packages/authors. Notable direct dependencies:
Three.js, Turf.js, `geotiff`, `proj4` (npm); PyTorch, `timm`, `tifffile`
(Python). This project does not modify or vendor any of these beyond the
one explicitly-noted exception above (`prithvi_mae.py`).

---

If you believe an attribution here is missing or incorrect, please open
an issue.
