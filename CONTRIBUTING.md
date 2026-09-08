# Contributing to AgriAether

Thanks for your interest in AgriAether. This project cares a lot about
honesty in what's real vs. simulated vs. staged — please read the
"Real / staged / simulated" section of the README before contributing so
your changes fit that standard.

## Setup

```bash
git clone https://github.com/soyebmohammad03-dev/AgriAether.git
cd AgriAether
npm install
npm run dev        # Vite dev server
```

For the ML pipeline (`ml/`), see `ml/README.md` — it's a separate Python
environment, not part of the npm workflow.

## Before opening a PR

```bash
npm run typecheck   # tsc --noEmit
npm run test        # vitest
npm run build       # typecheck + production build
```

All three must pass. If you touch `ml/`, also re-run the relevant script
(`train.py`, `infer.py`) and update `ml/manifests/*.json` if metrics
change — never hand-edit a manifest's numbers.

## Coding expectations

- **Provenance is load-bearing.** Every `Observation`, `PredictionRecord`,
  and `ModelRecord` in this codebase carries an explicit provenance/status
  field (`MEASURED | SIMULATED | ESTIMATED | PREDICTED | ...`,
  `REAL | STAGED | SIMULATED`, etc.) for a reason — never add a code path
  that lets simulated or estimated data claim to be measured or real.
- **No fabricated agricultural claims.** Don't hardcode a threshold,
  accuracy number, or diagnosis that isn't backed by a real dataset,
  model, or cited source. If you don't have real data for something, the
  existing pattern is to return `UNSUPPORTED` / `INSUFFICIENT_DATA` /
  `null`, not a plausible-looking guess.
- **Small, focused PRs.** Prefer one logical change per PR over a large
  mixed one.
- Match the existing TypeScript style (no new linter/formatter is
  imposed — follow what's already in the file you're editing).

## Issues and PRs

- For bugs, use the bug report template and include a real reproduction.
- For features, explain the problem first — not every idea fits this
  project's scope (see the README's Roadmap and Limitations sections).
- PRs should note any impact on data, models, or provenance/status
  fields explicitly, even if the impact is "none."

## Questions

Open a GitHub issue — there's no separate mailing list or chat for this
project.
