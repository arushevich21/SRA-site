-- ACC lap ledger + site-wide stat rollups.
--
-- Replaces the hardcoded front-page / About→Statistics counters and the
-- static All-Time Laps board (apps/cockpit/src/content/stats-leaderboards.ts),
-- and backs the per-driver stats on profile pages.
--
-- Why a ledger rather than summing acc_hotlap_leaderboard.total_laps: those
-- are per-board running sums (a lap can land on a persistent AND a seasonal
-- board), persistent counting only began 2026-07-29, and pre-S7 / off-season
-- practice is missing — summing them comes out ~55-60% of the real totals.
--
-- SEVERAL WRITERS, ONE KEY. The same ACC result file is reachable three
-- ways: Emperor's API (cockpit cron + backfill script, '/server/N/...'),
-- the mail box CIFS mounts (SRA-Bot, '.../servers/server_N/results/...'),
-- and the win-box disks directly. 1,013 sessions were already ingested twice
-- under different paths in acc_processed_sessions. So the ledger is keyed by
-- a canonical file_key every writer derives identically:
--
--   <source>:<server dir>/<filename stem>
--   accsm1:server_0/260801_225206_R      (Emperor /server/0/... == disk server_0 —
--                                         verified on all 1,015 overlapping files)
--   accweb:1666572128/251231_002733_Q    (accweb config id dir)
--
-- and a session is counted once no matter who records it first.
--
-- ACC only (not AC Evo / LMU / iRacing) by decision.
-- Safe to re-run: idempotent DDL throughout.

-- ── Ledger ────────────────────────────────────────────────────────────────

-- One row per result file the ledger has read — doubles as the ingest's
-- "already processed" set. Files nobody drove in (server restarts, empty
-- practice) are kept with laps = 0 so they aren't re-parsed every cycle, but
-- don't count as sessions in the rollups.
create table if not exists public.acc_lap_ledger_files (
  id            bigint generated always as identity primary key,
  file_key      text        not null unique,   -- canonical, see header
  source        text        not null check (source in ('accweb', 'accsm1', 'accsm2')),
  session_type  text        not null,          -- raw ACC: FP / Q / R / R1 / R2 ...
  track_key     text        not null,          -- no FK: the bot may see a track before acc_tracks does
  session_at    timestamptz not null,          -- from the YYMMDD_HHMMSS filename
  laps          integer     not null default 0 check (laps >= 0),
  drivers       integer     not null default 0 check (drivers >= 0),
  processed_at  timestamptz not null default now()
);

-- One row per (file, driver, car). Keyed by the files table's bigint id, not
-- the file_key — repeating an ~40-80 byte key on every row roughly doubles the
-- table, which matters under the 500 MB plan cap. Laps are attributed by
-- each lap's driverIndex (who actually drove it), not the car's
-- currentDriver, so shared endurance cars split correctly.
create table if not exists public.acc_lap_ledger (
  file_id       bigint  not null references public.acc_lap_ledger_files (id) on delete cascade,
  steam_id      text    not null,              -- S-prefixed, same as every other acc_* table
  car_model_id  integer not null,
  laps          integer not null check (laps >= 0),
  valid_laps    integer not null check (valid_laps >= 0 and valid_laps <= laps),
  primary key (file_id, steam_id, car_model_id)
);
-- The PK leads with file_id, so it already covers the FK / cascade lookup.

-- Latest display name per SteamID. Kept out of the ledger rows for size;
-- only ever moves forward in time (see acc_lap_ledger_ingest).
create table if not exists public.acc_driver_names (
  steam_id      text        primary key,       -- S-prefixed
  driver_name   text        not null,
  last_seen_at  timestamptz not null
);

-- Bot-only tables: RLS on with no policies, so anon/authenticated see
-- nothing; the bot's service-role key bypasses RLS. The site reads only the
-- rollups below, server-side.
alter table public.acc_lap_ledger_files enable row level security;
alter table public.acc_lap_ledger       enable row level security;
alter table public.acc_driver_names     enable row level security;
revoke all on public.acc_lap_ledger_files, public.acc_lap_ledger, public.acc_driver_names
  from anon, authenticated;

-- ── Ingest RPC ────────────────────────────────────────────────────────────

-- Batch ingest, one call per batch of result files, one transaction — a
-- failed batch leaves nothing half-written. Idempotent: a file_key already
-- in acc_lap_ledger_files is skipped entirely (rows included), so replaying a
-- batch — or a second writer recording the same session — is a no-op.
-- Returns how many files were newly recorded.
--
-- Deadlock-safe with concurrent writers (the backfill runs one per ACCSM
-- host; the cron and SRA-Bot write too): acc_driver_names is updated ONCE per
-- batch, in a single statement sorted by steam_id, so every writer takes
-- those row locks in the same order. Updating it per driver as files were
-- walked deadlocked two backfill batches that shared drivers in different
-- orders. Ledger rows themselves never conflict (new file ids only).
--
-- p_files: [{ file_key, source, session_type, track_key, session_at,
--             drivers: [{ steam_id, car_model_id, driver_name, laps, valid_laps }] }]
create or replace function public.acc_lap_ledger_ingest(p_files jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  f        jsonb;
  d        jsonb;
  v_id     bigint;
  v_at     timestamptz;
  v_laps   integer;
  v_new    text[] := '{}';
  inserted integer := 0;
begin
  for f in select * from jsonb_array_elements(p_files) loop
    v_at := (f->>'session_at')::timestamptz;
    select coalesce(sum((x->>'laps')::int), 0) into v_laps
      from jsonb_array_elements(coalesce(f->'drivers', '[]'::jsonb)) x;

    insert into public.acc_lap_ledger_files
      (file_key, source, session_type, track_key, session_at, laps, drivers)
    values
      (f->>'file_key', f->>'source', f->>'session_type', f->>'track_key', v_at,
       v_laps, jsonb_array_length(coalesce(f->'drivers', '[]'::jsonb)))
    on conflict (file_key) do nothing
    returning id into v_id;

    continue when v_id is null;  -- already recorded
    inserted := inserted + 1;
    v_new := v_new || (f->>'file_key');

    for d in select * from jsonb_array_elements(coalesce(f->'drivers', '[]'::jsonb)) loop
      insert into public.acc_lap_ledger (file_id, steam_id, car_model_id, laps, valid_laps)
      values (v_id, d->>'steam_id', (d->>'car_model_id')::int,
              (d->>'laps')::int, (d->>'valid_laps')::int);
    end loop;
  end loop;

  -- Latest name per driver across the newly recorded files, one sorted
  -- upsert (see header). Only ever moves forward in time.
  insert into public.acc_driver_names as n (steam_id, driver_name, last_seen_at)
  select steam_id, driver_name, seen_at
  from (
    select distinct on (dr->>'steam_id')
           dr->>'steam_id' as steam_id, dr->>'driver_name' as driver_name,
           (fl->>'session_at')::timestamptz as seen_at
    from jsonb_array_elements(p_files) fl
    cross join jsonb_array_elements(coalesce(fl->'drivers', '[]'::jsonb)) dr
    where fl->>'file_key' = any (v_new) and coalesce(dr->>'driver_name', '') <> ''
    order by dr->>'steam_id', (fl->>'session_at')::timestamptz desc
  ) latest
  order by steam_id
  on conflict (steam_id) do update
    set driver_name = excluded.driver_name, last_seen_at = excluded.last_seen_at
    where excluded.last_seen_at > n.last_seen_at;

  return inserted;
end;
$$;

revoke execute on function public.acc_lap_ledger_ingest(jsonb) from public, anon, authenticated;

-- ── Rollups ───────────────────────────────────────────────────────────────
-- Materialized views, refreshed nightly by pg_cron (bottom of file). Not
-- exposed to anon/authenticated: cockpit reads them server-side with the
-- service-role client, same as the rest of the site. Each carries
-- computed_at so pages can show "as of" and a stalled refresh is visible.

-- Front page + About→Statistics. Exactly one row (id = 1).
drop materialized view if exists public.sra_stats_global;
create materialized view public.sra_stats_global as
select
  1                                               as id,
  count(*) filter (where f.laps > 0)              as sessions,
  coalesce(sum(f.laps), 0)::bigint                as laps,
  (select count(distinct steam_id) from public.acc_lap_ledger) as drivers,
  min(f.session_at) filter (where f.laps > 0)     as first_session_at,
  now()                                           as computed_at
from public.acc_lap_ledger_files f;

create unique index sra_stats_global_id_idx on public.sra_stats_global (id);

-- All-Time Laps board + the profile "Mileage" block. One row per SteamID.
drop materialized view if exists public.driver_lap_totals;
create materialized view public.driver_lap_totals as
with per_driver as (
  select l.steam_id,
         sum(l.laps)::bigint         as laps,
         sum(l.valid_laps)::bigint   as valid_laps,
         count(distinct l.file_id)   as sessions,
         min(f.session_at)           as first_seen,
         max(f.session_at)           as last_seen
  from public.acc_lap_ledger l
  join public.acc_lap_ledger_files f on f.id = l.file_id
  group by l.steam_id
),
top_track as (
  select distinct on (l.steam_id) l.steam_id, f.track_key, sum(l.laps) as laps
  from public.acc_lap_ledger l
  join public.acc_lap_ledger_files f on f.id = l.file_id
  group by l.steam_id, f.track_key
  order by l.steam_id, sum(l.laps) desc, f.track_key
),
top_car as (
  select distinct on (steam_id) steam_id, car_model_id, sum(laps) as laps
  from public.acc_lap_ledger
  group by steam_id, car_model_id
  order by steam_id, sum(laps) desc, car_model_id
)
select p.steam_id,
       n.driver_name,
       p.laps,
       p.valid_laps,
       p.sessions,
       p.first_seen,
       p.last_seen,
       t.track_key     as top_track_key,
       t.laps::bigint  as top_track_laps,
       c.car_model_id  as top_car_model_id,
       c.laps::bigint  as top_car_laps,
       rank() over (order by p.laps desc) as laps_rank,
       now()           as computed_at
from per_driver p
left join public.acc_driver_names n using (steam_id)
left join top_track t using (steam_id)
left join top_car   c using (steam_id);

create unique index driver_lap_totals_steam_id_idx on public.driver_lap_totals (steam_id);
create index driver_lap_totals_rank_idx on public.driver_lap_totals (laps_rank);

-- Profile "Racing record". One row per (player_id, series) from
-- srating_history, whose finish_position is within-division.
--
-- Which rows count:
--   * not excluded                      → yes
--   * exclude_reason 'Legacy exclusion' → yes (real finishes, excluded from
--     SRating only)
--   * exclude_reason 'Server crash'     → only if it has a position AND the
--     event's leader covered >= 90% of a normal full race at that track
--     (median leader laps across non-excluded events there). Per Anton:
--     count a crashed race when it ran close to its full 60 min. As of
--     writing the only such event is S17 R7 Kyalami — three divisions ran
--     the full 36 laps (counted), the crashed one has no positions (not).
--   * anything else                     → no
drop materialized view if exists public.driver_race_stats;
create materialized view public.driver_race_stats as
with event_leader as (
  select series, season, event, track, max(laps) as leader_laps
  from public.srating_history
  group by series, season, event, track
),
full_distance as (
  select series, track,
         percentile_cont(0.5) within group (order by leader_laps) as full_laps
  from (
    select h.series, h.season, h.event, h.track, max(h.laps) as leader_laps
    from public.srating_history h
    where not h.excluded
    group by h.series, h.season, h.event, h.track
  ) e
  group by series, track
),
counted as (
  select h.*
  from public.srating_history h
  left join event_leader el using (series, season, event, track)
  left join full_distance fd using (series, track)
  where h.finish_position is not null
    and (
      not h.excluded
      or h.exclude_reason = 'Legacy exclusion'
      or (h.exclude_reason = 'Server crash'
          and fd.full_laps > 0
          and el.leader_laps >= 0.9 * fd.full_laps)
    )
)
select player_id,
       series,
       max(driver_id::text)::uuid                       as driver_id,
       count(*)                                          as starts,
       count(*) filter (where finish_position = 1)       as wins,
       count(*) filter (where finish_position <= 3)      as podiums,
       count(*) filter (where finish_position <= 10)     as top10s,
       min(finish_position)                              as best_finish,
       round(avg(finish_position), 1)                    as avg_finish,
       count(distinct season)                            as seasons,
       min(event_date)                                   as first_race,
       max(event_date)                                   as last_race,
       now()                                             as computed_at
from counted
group by player_id, series;

create unique index driver_race_stats_pk_idx on public.driver_race_stats (player_id, series);

revoke all on public.sra_stats_global, public.driver_lap_totals, public.driver_race_stats
  from anon, authenticated;

-- ── Nightly refresh ───────────────────────────────────────────────────────

-- CONCURRENTLY (hence the unique indexes above) so pages keep reading the
-- previous snapshot while a refresh runs instead of blocking on it.
create or replace function public.refresh_site_stats()
returns void
language plpgsql
set search_path = ''
as $$
begin
  refresh materialized view concurrently public.sra_stats_global;
  refresh materialized view concurrently public.driver_lap_totals;
  refresh materialized view concurrently public.driver_race_stats;
end;
$$;

revoke execute on function public.refresh_site_stats() from public, anon, authenticated;

create extension if not exists pg_cron;

-- 09:15 UTC ≈ 5 am Eastern: well after the night's races have finished.
-- cron.schedule upserts by job name, so re-running this is safe.
select cron.schedule('refresh-site-stats', '15 9 * * *', $$select public.refresh_site_stats()$$);
