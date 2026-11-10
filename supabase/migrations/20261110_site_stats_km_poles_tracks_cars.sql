-- About→Statistics: Kilometers, Pole Positions, Tracks and Cars boards, plus
-- the profile's "Laps by car" list. Builds on
-- 20261012_acc_lap_ledger_and_site_stats.sql and
-- 20261012d_race_participation_head_to_head.sql.
--
-- ACC only, same as the rest of the ledger. Safe to re-run.

-- ── Track lengths (Kilometers Driven) ─────────────────────────────────────

-- ACC's published layout lengths, metres. A track the ledger sees without a
-- length is left out of km (never counted as 0) and reported by
-- sra_stats_global.laps_without_length so the gap is visible.
alter table public.acc_tracks add column if not exists length_m integer
  check (length_m is null or length_m > 0);

update public.acc_tracks t
set length_m = v.length_m
from (values
  ('barcelona',        4655),
  ('brands_hatch',     3908),
  ('cota',             5513),
  ('donington',        4020),
  ('hungaroring',      4381),
  ('imola',            4959),
  ('indianapolis',     4167),
  ('kyalami',          4522),
  ('laguna_seca',      3602),
  ('misano',           4226),
  ('monza',            5793),
  ('mount_panorama',   6213),
  ('nurburgring',      5137),
  ('nurburgring_24h', 25378),
  ('oulton_park',      4307),
  ('paul_ricard',      5770),
  ('red_bull_ring',    4318),
  ('silverstone',      5891),
  ('snetterton',       4779),
  ('spa',              7004),
  ('suzuka',           5807),
  ('valencia',         4005),
  ('watkins_glen',     5552),
  ('zandvoort',        4259),
  ('zolder',           4011)
) as v (track_key, length_m)
where t.track_key = v.track_key;

-- ── Qualifying results (Pole Positions) ───────────────────────────────────

-- One row per leaderboard line of an ACC qualifying file the ledger has
-- recorded. Written by the cockpit cron for new Q sessions and, for history,
-- by scripts/backfill-acc-qualifying.ts (only the Q files paired with a GT3
-- race — see gt3_race_qualifying). best_lap_ms is null for a car with no
-- valid lap; such a line can't hold pole.
create table if not exists public.acc_qualifying_results (
  file_id      bigint  not null references public.acc_lap_ledger_files (id) on delete cascade,
  position     integer not null check (position > 0),
  steam_id     text    not null,               -- S-prefixed, like the ledger
  best_lap_ms  integer check (best_lap_ms is null or best_lap_ms > 0),
  primary key (file_id, position)
);

alter table public.acc_qualifying_results enable row level security;
revoke all on public.acc_qualifying_results from anon, authenticated;

-- p_files: [{ file_key, results: [{ position, steam_id, best_lap_ms }] }]
-- The file must already be in acc_lap_ledger_files (the ledger ingest runs
-- first); unknown keys are skipped. Idempotent per (file, position).
-- Returns how many files gained rows.
create or replace function public.acc_qualifying_ingest(p_files jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  f        jsonb;
  v_id     bigint;
  v_rows   integer;
  written  integer := 0;
begin
  for f in select * from jsonb_array_elements(p_files) loop
    select id into v_id from public.acc_lap_ledger_files where file_key = f->>'file_key';
    continue when v_id is null;

    insert into public.acc_qualifying_results (file_id, position, steam_id, best_lap_ms)
    select v_id, x.position, x.steam_id, x.best_lap_ms
    from jsonb_to_recordset(coalesce(f->'results', '[]'::jsonb))
           as x (position integer, steam_id text, best_lap_ms integer)
    where x.steam_id is not null and x.steam_id <> ''
    on conflict (file_id, position) do nothing;

    get diagnostics v_rows = row_count;
    if v_rows > 0 then written := written + 1; end if;
  end loop;
  return written;
end;
$$;

revoke execute on function public.acc_qualifying_ingest(jsonb) from public, anon, authenticated;

-- The qualifying lookup below walks files by time.
create index if not exists acc_lap_ledger_files_session_at_idx
  on public.acc_lap_ledger_files (session_at);

-- Each GT3 race file (a division's race, pinned by race_participation) paired
-- with its qualifying: the latest Q file on the same server in the 90
-- minutes before the race. Checked 2026-11-10: 719 of 721 race files pair.
create or replace view public.gt3_race_qualifying
with (security_invoker = true) as
select rf.id      as race_file_id,
       q.id       as q_file_id,
       q.file_key as q_file_key
from (select distinct file_id from public.race_participation where series = 'GT3') r
join public.acc_lap_ledger_files rf on rf.id = r.file_id
cross join lateral (
  select q.id, q.file_key
  from public.acc_lap_ledger_files q
  where q.session_type like 'Q%'
    and q.laps > 0
    and q.session_at >= rf.session_at - interval '90 minutes'
    and q.session_at <  rf.session_at
    and split_part(q.file_key, '/', 1) = split_part(rf.file_key, '/', 1)
  order by q.session_at desc
  limit 1
) q;

revoke all on public.gt3_race_qualifying from anon, authenticated;

-- What the qualifying backfill still has to fetch. Only ACCSM files —
-- Emperor can serve those; accweb lives on disk.
create or replace function public.acc_qualifying_backfill_targets()
returns table (file_key text)
language sql
stable
set search_path = ''
as $$
  select distinct g.q_file_key
  from public.gt3_race_qualifying g
  where g.q_file_key like 'accsm%'
    and not exists (select 1 from public.acc_qualifying_results r where r.file_id = g.q_file_id)
  order by 1;
$$;

revoke execute on function public.acc_qualifying_backfill_targets() from public, anon, authenticated;

-- ── Rollups ───────────────────────────────────────────────────────────────

-- Recreated to add km + laps_without_length. Nothing depends on it.
drop materialized view if exists public.sra_stats_global;
create materialized view public.sra_stats_global as
select
  1                                                             as id,
  count(*) filter (where f.laps > 0)                            as sessions,
  coalesce(sum(f.laps), 0)::bigint                              as laps,
  (select count(distinct steam_id) from public.acc_lap_ledger)  as drivers,
  coalesce(round(sum(f.laps::numeric * t.length_m) / 1000), 0)::bigint as km,
  coalesce(sum(f.laps) filter (where t.length_m is null), 0)::bigint   as laps_without_length,
  min(f.session_at) filter (where f.laps > 0)                   as first_session_at,
  now()                                                         as computed_at
from public.acc_lap_ledger_files f
left join public.acc_tracks t on t.track_key = f.track_key;

create unique index sra_stats_global_id_idx on public.sra_stats_global (id);

-- Tracks board: every lap at each track, all drivers.
drop materialized view if exists public.site_track_laps;
create materialized view public.site_track_laps as
select f.track_key,
       sum(f.laps)::bigint                                    as laps,
       count(*) filter (where f.laps > 0)                     as sessions,
       (select count(distinct l.steam_id)
          from public.acc_lap_ledger l
          join public.acc_lap_ledger_files f2 on f2.id = l.file_id
         where f2.track_key = f.track_key)                    as drivers,
       now()                                                  as computed_at
from public.acc_lap_ledger_files f
group by f.track_key
having sum(f.laps) > 0;

create unique index site_track_laps_pk_idx on public.site_track_laps (track_key);

-- Cars board: every lap in each car model, all drivers.
drop materialized view if exists public.site_car_laps;
create materialized view public.site_car_laps as
select car_model_id,
       sum(laps)::bigint          as laps,
       count(distinct steam_id)   as drivers,
       now()                      as computed_at
from public.acc_lap_ledger
group by car_model_id
having sum(laps) > 0;

create unique index site_car_laps_pk_idx on public.site_car_laps (car_model_id);

-- Profile "Laps by car": one row per (driver, car). ~40k rows.
drop materialized view if exists public.driver_car_laps;
create materialized view public.driver_car_laps as
select l.steam_id,
       l.car_model_id,
       sum(l.laps)::bigint         as laps,
       sum(l.valid_laps)::bigint   as valid_laps,
       count(distinct l.file_id)   as sessions,
       max(f.session_at)           as last_driven,
       now()                       as computed_at
from public.acc_lap_ledger l
join public.acc_lap_ledger_files f on f.id = l.file_id
group by l.steam_id, l.car_model_id
having sum(l.laps) > 0;

create unique index driver_car_laps_pk_idx on public.driver_car_laps (steam_id, car_model_id);

-- Pole Positions board: P1 (with a valid lap) in the qualifying paired with
-- a GT3 race — per division race, same unit as wins in driver_race_stats.
-- Races from the retired accsm3-7 hosts have no file, so older seasons
-- undercount, as race_participation already does.
drop materialized view if exists public.driver_pole_stats;
create materialized view public.driver_pole_stats as
select r.steam_id                 as player_id,
       count(*)                   as poles,
       now()                      as computed_at
from public.gt3_race_qualifying g
join public.acc_qualifying_results r
  on r.file_id = g.q_file_id and r.position = 1 and r.best_lap_ms is not null
group by r.steam_id;

create unique index driver_pole_stats_pk_idx on public.driver_pole_stats (player_id);

revoke all on public.sra_stats_global, public.site_track_laps, public.site_car_laps,
              public.driver_car_laps, public.driver_pole_stats
  from anon, authenticated;

-- ── Nightly refresh ───────────────────────────────────────────────────────
-- Order matters: driver_pole_stats reads race_participation.
create or replace function public.refresh_site_stats()
returns void
language plpgsql
set search_path = ''
as $$
begin
  refresh materialized view concurrently public.sra_stats_global;
  refresh materialized view concurrently public.driver_lap_totals;
  refresh materialized view concurrently public.driver_race_stats;
  refresh materialized view concurrently public.race_participation;
  refresh materialized view concurrently public.site_track_laps;
  refresh materialized view concurrently public.site_car_laps;
  refresh materialized view concurrently public.driver_car_laps;
  refresh materialized view concurrently public.driver_pole_stats;
end;
$$;

revoke execute on function public.refresh_site_stats() from public, anon, authenticated;
