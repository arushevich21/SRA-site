# SRA Control Center — Repo Kickoff Brief

## What we're building

A **thin, read-only operational layer over the SimGrid GridOS API** for running the Sim Racing Alliance ACC league. GridOS is the racing platform (series, events, entries, teams, drivers, results — REST/JSON, **read access only**). Our app is the race director's cockpit: it aggregates that data, applies **league-owned business logic** (points, penalties, eligibility) that SimGrid does not provide, snapshots results for audit, and publishes to the frontend and Discord.

**Core principle:** SimGrid is the racing platform. This app is the race director's cockpit. We never write to SimGrid. Our durable truth (mappings, overrides, snapshots, ledger) lives in our own store.

**Hard constraint:** SimGrid is read-only. All scoring/penalty/standings computation is ours and must be deterministic, versioned, and auditable.

---

## Open decision to confirm before running

**Stack.** Recommended default: **TypeScript end-to-end** in a pnpm monorepo. Rationale — the Normalized View Model types are the spine of the whole system; TS lets every layer import one type definition instead of redefining it and drifting. If the team prefers a Python/FastAPI backend, swap the `apps/api` and domain packages accordingly, but keep the shared-types contract.

---

## Monorepo layout

```
sra-control-center/
├── packages/
│   ├── simgrid-client/      # GridOS integration: auth, retry/backoff, pagination, rate-limit handling, error taxonomy
│   ├── shared-types/        # Normalized View Models — our internal types, decoupled from GridOS payloads (anti-corruption layer)
│   ├── domain/              # League-owned logic: points engine + penalty ledger + eligibility. PURE. No I/O. Heavily tested.
│   └── store/               # Durable layer: mappings (SimGrid IDs <-> ours), overrides, snapshots, history/audit log
├── apps/
│   ├── api/                 # Thin backend. Exposes domain via stable endpoints. Read endpoints first.
│   └── cockpit/             # Frontend race-director tool (NOT the public marketing site)
├── fixtures/                # Recorded GridOS responses + hand-authored domain test scenarios
├── docs/
│   ├── domain/              # Executable specs (see seeds below)
│   └── adr/                 # Architecture Decision Records
├── .github/
│   ├── workflows/ci.yml
│   ├── CODEOWNERS
│   └── pull_request_template.md
├── .gitignore
├── .env.example
├── CONTRIBUTING.md
└── README.md
```

### Package responsibilities (one line each)
- **simgrid-client** — only thing that knows GridOS's actual shape. Returns Normalized View Models, never raw payloads.
- **shared-types** — the contract. Changes here are reviewed carefully.
- **domain** — the reason the product exists. Pure functions: data in → standings/ledger state out. No network, no DB.
- **store** — persistence for everything SimGrid can't give us.
- **api** — orchestration glue, auth/permissions, stable endpoints (`/dashboard`, `/teams`, `/standings/audit`, `/rounds/:id/ops`, `/announcements`).
- **cockpit** — renders; never computes standings itself.

---

## Collaboration setup (do this in the first session)

1. **Host on GitHub.** Create the repo (org or personal + collaborators).
2. **Protect `main`:** require a PR, ≥1 review, and passing CI. No direct pushes to `main`.
3. **Trunk-based flow:** short-lived feature branches → PR → squash-merge. No GitFlow.
4. **CODEOWNERS:** require review on `packages/domain/**` and `packages/shared-types/**` from a maintainer — that's the high-stakes logic; wrong standings erode trust instantly.
5. **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `test:`). Add a PR template that asks "what did you change and how was it tested."
6. **CONTRIBUTING.md** so collaborators self-onboard (clone, install, env setup, run tests).
7. **Issues/Project board** tracking the phased roadmap (Phase 0 spike → spine → domain → api → cockpit → discord).

## Secrets discipline (non-negotiable — partner API key involved)

- `.env` is git-ignored from commit zero. Commit `.env.example` with key *names* only, no values.
- The **GridOS API key never touches the repo, Slack, or Discord.** Prefer per-developer keys; if you must share one, use a secrets manager.
- Add **gitleaks** as a pre-commit hook (and a CI job) so a key can't be committed by accident. Cleaning a leaked key out of git history is genuinely painful — prevent it.

## CI (`.github/workflows/ci.yml`)

Run on every PR: install → lint → typecheck → **unit tests**. The `domain` package is pure, so its tests are cheap and catch the bugs that matter most — make it the priority target. Keep fixtures committed so CI is deterministic and never calls the live API.

---

## Seeded domain specs (create these in `docs/domain/`)

### `points-engine.md` (deterministic; pure function)

**Pipeline position:** consumes the **adjusted** classification (after steward time penalties / DQs are applied), NOT raw SimGrid finishing order.

```
SimGrid raw results
  → apply steward penalties/DQs/overrides   (from the ledger + overrides store)
  → adjusted classification
  → points engine  (this spec)
  → drop rounds + tiebreakers
  → standings  → audit snapshot
```

Inputs: adjusted classification per division+split, pole sitter, fastest-lap setter.

Rules — **filled = known, TODO = confirm from the championship tracker "points reference tab" + an organizer huddle:**
- Position points table — **TODO** (exact array per position).
- Pole bonus — **TODO** confirm value/conditions (Endurance used +5).
- Fastest-lap bonus — **TODO** confirm value + conditions (valid lap? must finish? must be classified?).
- Team aggregation — **TODO**: two drivers per team — sum both, best of two, both must finish?
- Drop rounds — **TODO**: count varies per series (GT3 Team Series TBD; League in a Week = 3; Manufacturers Cup = 1); confirm whether bonuses count toward drop math.
- Tiebreaker chain — **TODO**: not published anywhere. This is the classic undocumented gap — pin it down explicitly.

Output: standings table + reference to the audit snapshot it was computed from + ruleset version.

### `penalty-ledger.md` (deterministic state machine — the high-value piece)

This is the most error-prone, most-automatable part of the rulebook. Model it as a per-driver license ledger over a rolling window. (Inputs are the stewards' rulings, which are human decisions captured via the overrides layer — the ledger does not *make* rulings, it tracks consequences.)

Known rules to encode:
- **Warnings:** 2 warnings within a span of 2 races → 1 penalty point (pp).
- **PP lifespan:** 8-race rolling window, carrying across seasons.
- **Consecutive-race accrual:** 2 pp infractions in the same or consecutive races → +1 additional pp.
- **Thresholds, each administered once per season:** 4pp = qualifying ban, 6pp = pit-lane start, 8pp = race ban, 10pp = season ban. PP are NOT cleared after a penalty is served.
- **Threshold cascade (ratified):** if a single pp update crosses multiple thresholds at once (e.g. 5pp -> 9pp crosses both 6pp and 8pp), enqueue the corresponding penalties highest-severity-first: race ban, then pit-lane start, served back to back. The driver serves strictly one penalty at a time, in descending severity order, each under the normal "active 2 races" serving rule.
- **New penalty during an active cascade (ratified):** a new penalty issued while an earlier queued penalty is still being served is appended to the BACK of the queue, regardless of its own severity. It never preempts what's currently being served. FIFO at the queue level; severity ordering only applies within a single multi-threshold crossing.
- **Serving:** a future-race penalty stays active for 2 races; cleared if the driver skips 2 races; does not roll into the next season; must be served *in attendance* (skipping a race ≠ serving). Stacked bans are served across multiple races.
- **Lap-1 incidents:** escalate the penalty one tier; classified `L1AUTO`.
- **Returning position:** downgrades the time penalty, retains any pp, removes the extra warning.
- **Season-ban return / probation:** ban in the first 4 races → minimum 2 races out and stay out until pp < 10, then probation; probation = must not accumulate 3pp in the first 4 races back, else another season ban.
- **Qualifying penalties (separate track):** 2 qualifying warnings in a season → qualifying ban next race; no pp applied.

Output: each driver's current pp total, active bans, and eligibility flags for upcoming races (feeds eligibility checks in `domain`).

> Everything in Rules & Regs Section 5 (overlap, defending, blue flags, rejoins) and the steward's tier decision itself is **human judgment — not modeled here**. The app records and applies those rulings; it never computes them.

### ADRs to seed in `docs/adr/`
- `0001-normalized-view-models.md` — why we decouple internal types from GridOS payloads.
- `0002-monorepo.md` — why one repo with shared types.
- `0003-snapshot-based-auditing.md` — why standings are computed once from an immutable snapshot under a versioned ruleset.

---

## First Claude Code session — task order

1. Scaffold the tree above; add `.gitignore`, `.env.example`, `README.md`, `CONTRIBUTING.md`.
2. `git init`, initial commit (`chore: scaffold monorepo`), push to GitHub, protect `main`, add CODEOWNERS + PR template + gitleaks hook + CI.
3. Drop in the three `docs/domain` + `docs/adr` files from this brief.
4. **Start the `domain` package test-first:** build the penalty ledger against hand-authored fixtures in `fixtures/` (it's the highest-value, fully-specified piece). The points engine follows once the TODO numbers are confirmed.
5. Stub `simgrid-client` + `shared-types` only enough to define the contract; the live integration is the Phase 0 spike, gated on confirming GridOS auth, scopes, rate limits, and webhook-vs-poll.