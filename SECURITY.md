# Security Policy

## Reporting a vulnerability

If you find a security vulnerability in AgriAether, please report it
privately rather than opening a public issue — use GitHub's
[private vulnerability reporting](https://github.com/soyebmohammad03-dev/AgriAether/security/advisories/new)
(Security tab → "Report a vulnerability") on this repository. This lets
maintainers review and fix the issue before it's publicly disclosed.

Please include:

- A clear description of the vulnerability and its impact
- Steps to reproduce
- Affected version/commit

## Supported versions

This project is pre-1.0 research/demo software. Security fixes are made
against the `main` branch; there is no long-term-support branch.

## Scope

AgriAether has no backend server and no live inference service — it's a
client-side TypeScript app plus an offline Python ML pipeline (see the
README's "ML ↔ TypeScript boundary"). Realistic concerns are things like
dependency vulnerabilities (`npm audit`, Dependabot), XSS in the UI
rendering path, or unsafe handling of user-supplied CSV/GeoJSON in the
import pipeline (`src/ingest/`).

## A note for contributors and users

**Never commit API keys, credentials, access tokens, or private datasets
to this repository.** `.env` is gitignored for exactly this reason — copy
`.env.example` to `.env` locally and keep real values out of Git. If you
accidentally commit a secret, rotate/revoke it immediately in addition to
removing it from the repository (removing it from a later commit does not
remove it from Git history).
