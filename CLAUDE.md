# SRA Control Center — Claude Code Context

## Read this first

**Before creating or modifying anything, read `docs/PROJECT_BRIEF.md` in full.** It is the authoritative source for architecture decisions, domain rules, and the phased roadmap.

## Project summary

A race director's operational cockpit for the Sim Racing Alliance ACC league, sitting as a **thin, read-only layer over the SimGrid GridOS API**. GridOS provides series, events, entries, teams, drivers, and results via REST/JSON with read-only access. This app applies league-owned business logic (points engine, penalty ledger, eligibility), snapshots results for audit, and publishes to a cockpit frontend and Discord.

## Core principle

**SimGrid is the racing platform. We are the race director's cockpit. We never write to SimGrid.**

Our durable truth — driver mappings, manual overrides, result snapshots, penalty ledger state — lives in our own store (`packages/store`). All scoring and standings computation is deterministic, versioned, and auditable.

## Architecture at a glance

- `packages/simgrid-client` — the only thing that knows GridOS's wire format. Returns Normalized View Models, never raw payloads.
- `packages/shared-types` — the type contract between all layers. Changes here require careful review.
- `packages/domain` — the reason the product exists. Pure functions only: data in, standings/ledger state out. No network, no DB. Heavily tested.
- `packages/store` — persistence for everything SimGrid can't give us.
- `apps/api` — orchestration glue, auth/permissions, stable REST endpoints.
- `apps/cockpit` — frontend race-director tool. Renders only — never computes standings itself.

## Conventions

- **Conventional Commits:** `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- **Trunk-based flow:** short branch → PR → squash-merge → `main`. No direct pushes to `main`.
- **Test-first on `packages/domain`:** it's pure and its tests catch the bugs that matter most.
- **Secrets discipline:** GridOS API key never in the repo, Slack, or Discord. `.env` is git-ignored.
- **gitleaks** runs as a pre-commit hook and in CI.
