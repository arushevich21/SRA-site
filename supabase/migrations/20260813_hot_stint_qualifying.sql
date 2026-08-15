-- Hot Stint Qualifying: pre-season classification event on a dedicated
-- 24/7 open-practice server at one track, over a multi-week window, before
-- divisions exist. Four tables and one view, all new — nothing here touches
-- the existing ACC ingest pipeline (acc_race_sessions, acc_hotlap_leaderboard).
--
-- Lap-level data is NOT added to the global ingest: see the discussion in
-- the PR/commit message this migration ships with. hot_stint_laps only ever
-- holds one event's laps at a time, not the whole session archive.
--
-- PRIVACY (hard requirement, not a preference): per-driver lap counts,
-- the winning window's individual lap times, and consistency spread must
-- never be readable by anyone but an admin — not the public, not the driver
-- themself, permanently (no post-season release path). hot_stint_laps and
-- hot_stint_results both get RLS enabled with NO policies at all, matching
-- the existing service-role-only pattern (see acc_hotlap_refresh_state,
-- bot_jobs) — NOT the select-own pattern used elsewhere for driver data,
-- which this rule specifically excludes. Every read in this app, public and
-- admin alike, goes through the same server-only service-role client, which
-- bypasses RLS — so the zero-policy design alone does not keep lap counts
-- out of the public leaderboard. The actual enforcement is
-- hot_stint_results_public, a view (see below) that was never given the
-- admin-only columns; the public query selects from that view, the admin
-- query selects from hot_stint_results directly.

create table public.hot_stint_events (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  sim text not null default 'ACC',
  label text not null,
  track_key text not null references public.acc_tracks(track_key),
  -- Raw trackName as it appears in ACCSM result JSON — matches sessions the
  -- same way championship_rounds.emperor_track does; track_key above is our
  -- own curated key, not guaranteed to be the literal source string.
  emperor_track text not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  -- Rolling-average window size (packages/domain's computeHotStintResults
  -- windowSize param) — a column, not a hardcoded 5, per the original spec.
  -- Named window_size, NOT lap_count, specifically to not collide with
  -- hot_stint_processed_files.lap_count below — that one means "how many
  -- laps this result file produced", a different quantity entirely; two
  -- same-named columns meaning different things in one migration is a
  -- guaranteed future misread.
  window_size int not null default 5,
  created_at timestamptz not null default now(),
  constraint hot_stint_events_window_check check (closes_at > opens_at),
  constraint hot_stint_events_window_size_check check (window_size > 0),
  -- Rows are inserted by hand, and this is a duplicate/mistyped-insert guard,
  -- not a real range-overlap check (that would need a gist exclusion
  -- constraint + btree_gist, an extension not otherwise needed here) — the
  -- actual invariant wanted is "one hot stint event per season per sim per
  -- track", which a plain unique constraint already captures. If a season
  -- ever legitimately needs two hot stints at the same track, drop this.
  constraint hot_stint_events_one_per_season_track unique (season, sim, track_key)
);

comment on table public.hot_stint_events is
  'One row per Hot Stint Qualifying window: a track + [opens_at, closes_at) '
  'range scoped to a single pre-season classification event. Not '
  'championship_rounds — this runs before divisions/championship rounds '
  'exist. Not keyed by acc_race_sessions.event_key either — that buckets by '
  'calendar day, and this window spans many days/event_keys.';

create index hot_stint_events_track_window_idx
  on public.hot_stint_events (track_key, opens_at, closes_at);

-- Raw per-lap log, scoped to one hot_stint_events row at a time — this is
-- deliberately NOT a general-purpose lap table for the whole ACC archive
-- (see migration header). Ingest runs repeatedly over the 3-4 week window
-- and reprocesses recent result files, so the unique constraint + upsert is
-- what makes re-ingestion safe: without it, a re-run duplicates rows, which
-- both inflates the admin-visible lap-attempt count AND corrupts island
-- detection (a re-ingested run of 5 laps becomes a run of 10 with a fake
-- window straddling the seam).
create table public.hot_stint_laps (
  id bigint generated always as identity primary key,
  hot_stint_event_id uuid not null references public.hot_stint_events(id) on delete cascade,
  source_url text not null,
  session_date timestamptz not null,
  car_id int not null,
  driver_index int not null default 0,
  -- Bare SteamID64 (no "S" prefix) — matches drivers.steam_id, NOT
  -- driver_ratings.player_id's "S"-prefixed format. See
  -- parseAccHotStintLaps (packages/domain) for where the prefix is stripped.
  steam_id text not null,
  -- Snapshot at ingest time, so the admin view has a name even for a
  -- steam_id with no drivers row yet (see hot_stint identity gaps).
  driver_name text not null,
  driver_id uuid references public.drivers(id),
  -- Position among ALL of this car's laps in the flat laps[] array — one
  -- counter per (source_url, car_id), spanning every driver who piloted that
  -- car, NOT reset per driver_index. This is deliberate, not incidental: it
  -- is what leaves a real gap in a returning driver's own lap_index sequence
  -- across a mid-session driver swap (see AccHotStintRawLap.lapIndex's
  -- comment in packages/domain/src/acc/acc-parser.ts, and the driver-swap
  -- test in acc-parser.test.ts) — the correctness of island detection across
  -- a swap rests on THIS sequencing, not on ACCSM happening to flag the
  -- returning driver's out-lap invalid. It's also why driver_index does NOT
  -- need to be part of the unique key below: two different drivers on one
  -- car never receive the same lap_index, because they share one counter.
  --
  -- Not a field the raw JSON provides at all — see the module-level
  -- RawSession.laps doc comment: array position, not an explicit field, so
  -- "in session order" is an assumption about the source, not a schema
  -- guarantee.
  lap_index int not null,
  lap_time_ms int not null,
  is_valid boolean not null,
  ingested_at timestamptz not null default now(),
  constraint hot_stint_laps_unique unique (source_url, car_id, lap_index)
);

comment on table public.hot_stint_laps is
  'Admin-only (RLS: no policies, service-role only) — per-lap data for the '
  'current Hot Stint Qualifying window. Never exposed to the public or the '
  'driver who set the laps; see hot_stint_results for the public-safe '
  'aggregate.';

create index hot_stint_laps_event_steam_idx
  on public.hot_stint_laps (hot_stint_event_id, steam_id);

-- "Which source_urls have already been fully consumed for this event" —
-- written for EVERY file the ingest downloads and parses, including ones
-- that produced zero hot_stint_laps rows (empty session, no valid laps, no
-- driver in the window matched any car). A row-existence check against
-- hot_stint_laps itself (e.g. `select distinct source_url`) cannot represent
-- a zero-row file at all, which means every empty/all-invalid session would
-- be re-downloaded on every single cron run for the rest of the 3-4 week
-- window — the same failure shape as the hot-lap cron timeout this whole
-- feature is being built next to (see fix/acc-hotlap-cron-timeout): fine at
-- first, then one day the backlog of "always looks new" files doesn't fit
-- in a run anymore.
--
-- Deliberately NOT the global acc_processed_sessions registry (single PK on
-- session_url): the hot stint server may be one of the same accsm1-7 hosts
-- the regular hot-lap cron already polls, and that cron marking a
-- session_url processed for its own (unrelated) purpose would silently
-- starve this ingest of laps it has never actually parsed. Scoping this
-- registry per hot_stint_event_id avoids that collision without the two
-- crons needing to coordinate.
create table public.hot_stint_processed_files (
  hot_stint_event_id uuid not null references public.hot_stint_events(id) on delete cascade,
  source_url text not null,
  processed_at timestamptz not null default now(),
  lap_count int not null,
  primary key (hot_stint_event_id, source_url)
);

comment on table public.hot_stint_processed_files is
  'Ingest-consumption registry for Hot Stint Qualifying, scoped per event — '
  'written for every result file downloaded, including zero-lap ones, so an '
  'empty/fully-invalid session is never treated as "not yet processed" on '
  'every future cron run.';

-- Per-driver aggregate, recomputed (fully replaced) by the ingest job after
-- every run via packages/domain's computeHotStintResults. One row per
-- (event, driver) rather than computed live per page request, so
-- improved_at/first_set_at can be tracked as real history instead of
-- re-derived each time.
--
-- PRIVACY: the public leaderboard reads hot_stint_results_public (below),
-- not this table directly — never total_laps, valid_laps, window_lap_ms, or
-- consistency_spread_ms. Selecting a count column and merely hiding it in
-- the UI still ships it in the network response.
create table public.hot_stint_results (
  id uuid primary key default gen_random_uuid(),
  hot_stint_event_id uuid not null references public.hot_stint_events(id) on delete cascade,
  steam_id text not null,
  driver_id uuid references public.drivers(id),
  driver_name text not null,
  best_avg_ms int not null,
  -- ADMIN-ONLY from here down.
  window_lap_ms int[] not null,
  window_session_source_url text,
  total_laps int not null,
  valid_laps int not null,
  consistency_spread_ms int not null default 0,
  -- Both derive from the SESSION timestamp of the result file containing
  -- the winning window — NOT wall-clock time at recompute — so a driver who
  -- set their time at 2am doesn't display as having improved at whatever
  -- time the cron happened to run next. The `now()` defaults below are only
  -- a safety net for a row inserted outside the ingest path; the ingest
  -- (hot-stint-ingest.ts) always supplies the real session date explicitly.
  first_set_at timestamptz not null default now(),
  improved_at timestamptz not null default now(),
  -- Wall-clock "last recomputed at" — an audit field, deliberately NOT
  -- public-facing (see hot-stint-store.ts's column split); unlike
  -- first_set_at/improved_at this one is genuinely fine as recompute time.
  updated_at timestamptz not null default now(),
  constraint hot_stint_results_unique unique (hot_stint_event_id, steam_id)
);

comment on table public.hot_stint_results is
  'Per-driver Hot Stint Qualifying aggregate. RLS: no policies, service-role '
  'only — the public leaderboard and the admin view are two separately '
  'authored SELECTs against this table with different column lists, not one '
  'query filtered in the UI. See table comment on the column split.';

create index hot_stint_results_event_rank_idx
  on public.hot_stint_results (hot_stint_event_id, best_avg_ms);

-- The real enforcement point for the privacy rule, not just the app-layer
-- column-list constant (apps/cockpit/src/lib/acc/hot-stint-store.ts's
-- PUBLIC_HOT_STINT_COLUMNS): the public leaderboard page's queries run on
-- the SAME service-role client as every admin query in this codebase — RLS's
-- zero-policy design only stops a direct anon-key request, and this app has
-- no such request path. A column-list constant is a promise the app code
-- keeps; this view is a promise the schema keeps regardless of what any
-- future query in this codebase does — select('*') against this view is
-- structurally incapable of returning total_laps/valid_laps/window_lap_ms/
-- window_session_source_url/consistency_spread_ms/updated_at, because the
-- view was never given those columns to select. The public query
-- (getPublicHotStintLeaderboard) selects from this view; the admin query
-- (getAdminHotStintResults) selects from hot_stint_results directly.
-- security_invoker = true (PG15+): without it, a plain view checks
-- privileges AND evaluates RLS as the VIEW OWNER, not the querying role —
-- since this migration runs as a role that bypasses RLS, a default view
-- here would skip hot_stint_results's RLS entirely for anyone who can
-- query it. With security_invoker on, the view re-checks RLS as whoever is
-- actually running the query, so it degrades to the same zero-policy
-- deny-all as the base table for anon/authenticated, and still works fully
-- for service_role (which bypasses RLS globally, not via view ownership).
-- The explicit revoke below is the second, independent layer: Supabase's
-- default privileges grant SELECT on new public-schema objects to anon and
-- authenticated unless revoked, so this view (and the four tables above)
-- would otherwise be grant-reachable even before considering RLS at all.
create view public.hot_stint_results_public
  with (security_invoker = true)
as
  select
    id,
    hot_stint_event_id,
    steam_id,
    driver_id,
    driver_name,
    best_avg_ms,
    first_set_at,
    improved_at
  from public.hot_stint_results;

comment on view public.hot_stint_results_public is
  'Public-safe projection of hot_stint_results — the schema-level enforcement '
  'of the "lap counts are permanently admin-only" rule. Adding a column to '
  'hot_stint_results exposes nothing here by default; a column must be '
  'deliberately added to this view''s SELECT list to become public.';

alter table public.hot_stint_events enable row level security;
alter table public.hot_stint_laps enable row level security;
alter table public.hot_stint_processed_files enable row level security;
alter table public.hot_stint_results enable row level security;
-- No policies on any of the four: every read goes through the server-only
-- service-role client (apps/cockpit/src/lib/supabase.ts), which bypasses
-- RLS. hot_stint_events/hot_stint_processed_files carry no per-driver
-- private data, but stay service-role-only too — nothing here needs a
-- public/anon read path.

-- Explicit revoke, independent of RLS: Supabase grants SELECT (and more) on
-- new public-schema objects to anon/authenticated by default. RLS-enabled-
-- zero-policies already denies anon/authenticated on the four tables
-- regardless of grants, but this makes that not-reachable-by-design
-- guarantee explicit rather than an inferred side effect, and it's the
-- ONLY thing (together with security_invoker above) that protects the view,
-- which has no RLS of its own to fall back on.
revoke all on public.hot_stint_events from anon, authenticated;
revoke all on public.hot_stint_laps from anon, authenticated;
revoke all on public.hot_stint_processed_files from anon, authenticated;
revoke all on public.hot_stint_results from anon, authenticated;
revoke all on public.hot_stint_results_public from anon, authenticated;
