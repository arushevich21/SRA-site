# SRA Site — Claude Code Context

## What this is

The rebuilt platform for the **Sim Racing Alliance (SRA)**, a North American PC
sim racing league running organized championships across multiple titles:
**ACC, Le Mans Ultimate (LMU), iRacing, and Assetto Corsa Evo (AC Evo)**.

This replaces the old simracingalliance.com. It is a public-facing league site
plus the operational tooling behind it (standings, results ingestion, and — in
progress — driver/team registration).

## The core architectural reality (read this before assuming anything)

SRA controls its own servers and domain again. Data reaches the site by
**multiple paths depending on the sim**, not a single source:

- **ACC + AC Evo** run on **SRA's own servers** (Emperor Servers, self-hosted).
  Results and championship standings come from **Emperor's read-only Web API**.
- **LMU + iRacing** run on **SimGrid** (proprietary, can't self-host). Live
  standings come from the **SimGrid GridOS API** where available.
- For championships without an API standings source, an **admin upload page**
  writes standings manually into our own store.

> The old "we are a thin read-only layer over SimGrid" framing is obsolete.
> SimGrid is now **one** of several data sources. The site is sim-first and
> multi-source.

We never write to SimGrid. Our durable truth (standings snapshots, driver
identity, registrations, penalty/points state) lives in **our own store
(Supabase + `packages/store`)**.

## Architecture at a glance

**Monorepo** (pnpm workspaces). Key packages/apps:

- `apps/cockpit` — the Next.js (App Router) public site + admin tooling,
  deployed on Vercel. Renders data; does not recompute standings that a source
  already computed. Sim-first routing via dynamic `/[sim]/...` segments
  validated against a central `sims.ts` config.
- `apps/api` — orchestration/glue, auth/permissions, stable REST endpoints.
  [VERIFY: confirm current responsibilities against the tree.]
- `packages/domain` — pure functions only (points engine, penalty ledger,
  parsers like the AC Evo session parser). No network, no DB. Heavily tested.
- `packages/simgrid-client` — the only thing that knows GridOS's wire format.
  Returns normalized view models, never raw payloads.
- `packages/emperor-client` — typed client for Emperor Servers' Web API
  (healthcheck, results list, result download, championship standings).
  Rate-limit aware. Emperor's results API is **0-indexed** (pagination).
- `packages/shared-types` — the type contract between layers. Changes require
  care. Includes the normalized AC Evo result types.
- `packages/store` — persistence for everything the racing platforms can't give
  us (standings snapshots, driver identity, registrations).
  [VERIFY: confirm which store logic lives here vs. inline Supabase in cockpit.]

## Sim-first structure

- Central config: `apps/cockpit/src/content/sims.ts` — slug, displayName, game,
  accent color per sim. Accents: ACC red `#E04040`, LMU blue `#3B82F6`,
  iRacing silver `#C0C8D4`, AC Evo orange `#F27A1A`. These are wayfinding
  accents, NOT full page themes — gold stays the SRA brand color.
- Routes: `/acc`, `/lmu`, `/iracing`, `/acevo`, each with sub-nav
  (championships / calendar / standings / leaderboards / register).
  [VERIFY: exact current sub-nav set; "results" was removed per admin feedback.]
- Championship content lives in a typed content layer (`championships.ts`) with
  `classes: string[]` and `formatTag` fields, joined against live source data
  at render time; degrades gracefully when a source has no data.
- Legacy flat pages (`/championships`, `/calendar`, `/about/*`) still exist and
  coexist during transition. [VERIFY: reconciliation status.]

## Data sources & key facts

- **Emperor (AC Evo/ACC):** base e.g. `https://sram1acevo.emperorservers.com`.
  Public read-only endpoints: `/healthcheck.json`, `/api/results/list.json`
  (0-indexed), `/server/{id}/results/download/{file}.json`,
  `/api/championship/{id}/standings.json` (returns fully computed championship
  standings — we display, we don't recompute). Driver identity in raw results
  is `{a,b}` GUID pairs; `player_id` / `DriverGUID` is the **SteamID** (the
  stable identity anchor). MX5 Cup championship id:
  `3a2e4266-ff5f-4c5c-b575-2a268c75f7e7`.
- **AC Evo lap validity (confirmed, tested 776/776):**
  `isValidLap(flags) = (flags & 1) === 0`. Bit 0 set = invalid. This is the
  single source of truth — export one function; never duplicate the rule.
- **AC Evo race classification is lap-count-first:** trust `driver_standings`
  for finishing order; do NOT re-derive from `time_standings`.
- **Standings storage:** Supabase (`standings` table, jsonb keyed by
  `standings_key`). Filesystem storage fails on Vercel (read-only runtime);
  pages reading live/uploaded standings use `export const dynamic = 'force-dynamic'`.
- **Supabase tables:** `standings` (in use), `drivers` and `team_registrations`
  (for the registration feature — [VERIFY current schema]).

## In progress

**Team registration** (Doug's priority). Design: Discord login (primary
identity, Supabase Auth Discord OAuth) + SteamID linked during registration
(results key on SteamID). Admin-assigned divisions; a driver registers a team
(name + car) and selects an available same-division, unpartnered teammate
(no consent step); claimed drivers can self-leave. Target: ACC GT3 Team Series
first (team standings come later, since ACC results pipeline isn't built yet).
A members JSON (Discord+SteamID) exists and can pre-seed the `drivers` table.
Build order: (1) auth + identity, (2) division admin UI, (3) registration flow.

## Conventions

- **Conventional Commits:** `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- **Trunk-based:** short branch → PR → squash-merge → `main`. `main` is
  protected — no direct pushes.
- **Resolve merge conflicts LOCALLY** (VS Code), never GitHub's web editor —
  "accept both" has silently created duplicate declarations that broke the
  build. Run `pnpm --filter cockpit build` after resolving; the build catches
  merge artifacts that lint/typecheck miss. **Green CI does not guarantee a
  passing Vercel build.**
- **Test-first on `packages/domain`** — it's pure and its tests catch the bugs
  that matter most.
- **Before committing:** `pnpm typecheck`, `pnpm lint`, `pnpm --filter cockpit build`.
- **Secrets discipline:** API keys and the Supabase **service-role** key never
  in the repo, never client-side, never in any `NEXT_PUBLIC_` var. `.env.local`
  is git-ignored. **gitleaks** runs as a pre-commit hook and in CI.
- **Env vars** (in `.env.local` + Vercel, both Production and Preview):
  `GRIDOS_API_KEY`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`. [VERIFY full current list.]
- **Windows/WSL:** avoid committing `*Zone.Identifier` NTFS metadata files
  (they break Windows checkouts — gitignored). Some pnpm/dev commands must run
  with `--filter cockpit` rather than from root.

## Working style

Prefer complete file replacements over partial patches when asked. For any
multi-part or security-sensitive build (auth, RLS, ingestion), present the plan
and proposed types/schema for review BEFORE implementing.