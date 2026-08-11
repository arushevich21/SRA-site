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

## Database schema — always read this first

**`supabase/schema.sql` is the authoritative schema reference.** It's a full
`pg_dump --schema-only` of the `public` schema: every table, column, type,
index, function, trigger, and RLS policy. Treat it as ground truth over any
assumption about what a table contains.

Regenerate after **every** migration — a stale snapshot is worse than none,
because it produces confident reasoning against columns that no longer exist:

```powershell
.\scripts\dump-schema.ps1
```

Connection notes (these took a while to pin down, don't re-derive them):

- Server is **PostgreSQL 17.6**. The local `pg_dump` client must be 17.x or
  newer — an older client refuses to dump a newer server.
- The **direct** host `db.<ref>.supabase.co` does not resolve from this
  network. Use the **session pooler**:
  `aws-1-us-west-2.pooler.supabase.com:5432`, user `postgres.<project-ref>`.
- Session pooler (5432), **not** transaction pooler (6543) — `pg_dump` needs a
  real session with prepared statements.
- `supabase db dump` via the CLI requires Docker, which isn't installed. Use
  `pg_dump` directly.
- The DB password is a **separate credential** from the service-role key. It
  lives as `SUPABASE_DB_PASSWORD` in `apps/cockpit/.env.local` (git-ignored).

`supabase/schema.sql` contains no credentials and **is committed** — schema
changes then show up as reviewable diffs in PRs, which catches drift.

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

## Driver identity — the join rule

**SteamID is the stable identity anchor across every source.** But it is
stored in two different formats, and getting this wrong silently produces zero
matches:

- `drivers.steam_id` — `text`, stored **bare**: `76561198129073265`
- `player_id` on ratings/leaderboard tables — `text`, **`S`-prefixed**:
  `S76561198129073265` (ACC's native format)

So the join is:

```sql
join public.drivers d on d.steam_id = substring(r.player_id from 2)
```

Never assume the prefix convention — check both sides before writing a
migration. Some tables may store it either way.

Known identity gaps as of this writing:

- 5 rows in `drivers` have a **NULL `steam_id`**. These can never match a
  `player_id` join. They group together in a `count(*) > 1` duplicate check and
  look like a duplicate — they aren't.
- Orphans exist: `player_id` values with no corresponding `drivers` row at all.

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
  [VERIFY: `force-dynamic` disables caching entirely — confirm it's still
  needed on every standings route, or whether some can be cached.]

### Supabase tables (partial inventory — `schema.sql` is authoritative)

- `standings` — jsonb standings snapshots keyed by `standings_key`
- `drivers` — driver identity; `steam_id text`, `steam_verified boolean`
- `driver_ratings` — PK `player_id text`, FK `driver_id uuid`
- `srating_history` — same `player_id` / `driver_id` column pair
- `acc_hotlap_leaderboard`, `acc_hotstint_leaderboard` — `steam_id text`
- `acevo_round_points_cache`, `acevo_round_points_cache_v2` —
  `pole_steam_id`, `fastest_lap_steam_id`
- `team_registrations` — registration feature [VERIFY current schema]

## In progress

**Team registration** (Doug's priority). Design: Discord login (primary
identity, Supabase Auth Discord OAuth) + SteamID linked during registration
(results key on SteamID). Admin-assigned divisions; a driver registers a team
(name + car) and selects an available same-division, unpartnered teammate
(no consent step); claimed drivers can self-leave. Target: ACC GT3 Team Series
first (team standings come later, since ACC results pipeline isn't built yet).
A members JSON (Discord+SteamID) exists and can pre-seed the `drivers` table.
Build order: (1) auth + identity, (2) division admin UI, (3) registration flow.

**`driver_id` backfill.** `driver_ratings` is **done** — 714 of 750 null rows
linked, 36 orphans remain unlinked. Still outstanding:

1. `srating_history` — same backfill, not yet run. Dry-run the counts first;
   don't assume the orphan population matches `driver_ratings` (history tables
   reach further back and pick up drivers since removed).
2. Resolve the 36 orphans — either create `drivers` rows or accept a permanent
   null, and confirm site queries tolerate it.
3. Investigate the 5 NULL-`steam_id` driver rows; some may *be* orphans whose
   `steam_id` was simply never populated, fixable without new records.
4. **Prevent recurrence.** Nothing currently stops a new `driver_ratings` row
   from landing with a null `driver_id`. Once orphans are cleared, a `NOT NULL`
   FK turns a silent data problem into a loud insert failure at the point it
   happens. Decide whether resolution belongs in the ingest path or a trigger.

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
- **Wrap destructive SQL in a transaction.** `begin;` → run → check the affected
  row count against the dry-run estimate → `commit;` or `rollback;`. A mismatch
  usually means a duplicate join key silently picked an arbitrary row.
- **Dry-run before any backfill.** Count `matchable` vs `orphans` with a `LEFT
  JOIN` before writing the `UPDATE`. Diagnose in SQL before changing schema —
  more than one issue here has been misdiagnosed before the data was checked.
- **Secrets discipline:** API keys, the Supabase **service-role** key, and the
  **database password** never in the repo, never client-side, never in any
  `NEXT_PUBLIC_` var. `.env.local` is git-ignored. **gitleaks** runs as a
  pre-commit hook and in CI. Never paste a full connection string into a
  terminal you might screenshot — the password is embedded in it.
- **Env vars** (in `apps/cockpit/.env.local` + Vercel, both Production and
  Preview): `GRIDOS_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD` (local schema dumps only),
  `DISCORD_INTEGRATION_WEBHOOK_URL` (optional — unset disables the SRA-Bot
  nick/role resync nudge). [VERIFY full current list.]
- **Windows/WSL:** avoid committing `*Zone.Identifier` NTFS metadata files
  (they break Windows checkouts — gitignored). Some pnpm/dev commands must run
  with `--filter cockpit` rather than from root. In PowerShell, backtick line
  continuations break easily on paste — keep long commands on one line.

## Working style

Prefer complete file replacements over partial patches when asked. For any
multi-part or security-sensitive build (auth, RLS, ingestion), present the plan
and proposed types/schema for review BEFORE implementing.s