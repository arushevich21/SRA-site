-- Head-to-head between two drivers (/drivers/[id]/vs/[otherId]).
--
-- The problem: srating_history has every driver's within-division finishing
-- position per round, but not WHICH race (division grid) it was. Two drivers
-- in the same round may have raced different divisions — comparing P3 in D1
-- with P2 in D3 is meaningless. The lap ledger knows exactly who was on each
-- race grid, so each srating result is pinned to the ledger race file it came
-- from; two drivers "met" when both results pin to the same file.
--
-- Pinning (race_participation): candidate files are the driver's ledger race
-- sessions (session_type R*) from the day before the round's event_date to 6
-- days after (divisions race on different nights), matched on lap count —
-- srating_history.laps vs the ledger's laps for that driver in that file.
-- That separates the league race from e.g. the Monday practice race, where
-- D1/D2 share one grid. Accepted only when the best candidate is within 1
-- lap AND unique at that distance; anything else stays unpinned and the
-- head-to-head reports it as "couldn't be matched" rather than guessing.
-- Coverage grows as the ledger does (backfill, then the live writers);
-- results from the retired accsm3-7 servers can never pin.
--
-- Safe to re-run.

drop materialized view if exists public.race_participation;
create materialized view public.race_participation as
with h as (
  select id, player_id, series, season, event, event_date, laps
  from public.srating_history
  where finish_position is not null and laps is not null
),
cand as (
  select h.id as srating_id, h.player_id, h.series, h.season, h.event, f.id as file_id,
         abs(l.laps - h.laps) as lap_diff,
         abs(extract(epoch from (f.session_at - h.event_date::timestamptz))) as secs_off
  from h
  join public.acc_lap_ledger l on l.steam_id = h.player_id
  join public.acc_lap_ledger_files f
    on f.id = l.file_id
   and f.session_type like 'R%'
   and f.session_at >= h.event_date - interval '1 day'
   and f.session_at <  h.event_date + interval '7 days'
),
-- A file belongs to at most one round per driver: the round whose date is
-- nearest. Consecutive rounds' windows overlap by a day, and without this a
-- driver whose own race file is missing got pinned to NEXT week's race when
-- a DNF lap count happened to match (S8 R2 → the S8 R3 file).
nearest as (
  select *
  from (select c.*, min(secs_off) over (partition by player_id, file_id) as min_off from cand c) x
  where secs_off = min_off
),
best as (
  select distinct on (srating_id) *,
         count(*) over (partition by srating_id, lap_diff) as ties
  from nearest
  order by srating_id, lap_diff, secs_off
)
select srating_id, player_id, series, season, event, file_id
from best
where lap_diff <= 1 and ties = 1;

create unique index race_participation_srating_idx on public.race_participation (srating_id);
create index race_participation_player_idx on public.race_participation (player_id);

revoke all on public.race_participation from anon, authenticated;

-- Every round both drivers were classified in (same counted-results rule as
-- driver_race_stats: legacy exclusions count, crash-flagged rows only with a
-- position), with whether each result pinned to a race file and whether it
-- was the SAME file. The caller treats same_race as a meeting, a verified
-- pair on different files as "different divisions" (not a meeting), and an
-- unverified pair as "couldn't be matched".
create or replace function public.driver_head_to_head(p_a text, p_b text)
returns table (
  season     integer,
  event      integer,
  track      text,
  event_date date,
  a_pos      integer,
  b_pos      integer,
  verified   boolean,
  same_race  boolean
)
language sql
stable
set search_path = ''
as $$
  select ha.season, ha.event, ha.track, ha.event_date,
         ha.finish_position, hb.finish_position,
         (pa.file_id is not null and pb.file_id is not null),
         coalesce(pa.file_id = pb.file_id, false)
  from public.srating_history ha
  join public.srating_history hb
    on hb.series = ha.series and hb.season = ha.season and hb.event = ha.event
  left join public.race_participation pa on pa.srating_id = ha.id
  left join public.race_participation pb on pb.srating_id = hb.id
  where ha.player_id = p_a and hb.player_id = p_b
    and ha.series = 'GT3'
    and ha.finish_position is not null and hb.finish_position is not null
    and (not ha.excluded or ha.exclude_reason in ('Legacy exclusion', 'Server crash'))
    and (not hb.excluded or hb.exclude_reason in ('Legacy exclusion', 'Server crash'))
  order by ha.season desc, ha.event desc;
$$;

revoke execute on function public.driver_head_to_head(text, text) from public, anon, authenticated;

create index race_participation_file_idx on public.race_participation (file_id);

-- The drivers someone has shared a grid with most — the head-to-head
-- picker's suggestions. Same pinned-race rule as above.
create or replace function public.driver_frequent_rivals(p_player text, p_limit integer default 8)
returns table (player_id text, meetings bigint, ahead bigint, behind bigint)
language sql
stable
set search_path = ''
as $$
  select pb.player_id,
         count(*),
         count(*) filter (where ha.finish_position < hb.finish_position),
         count(*) filter (where hb.finish_position < ha.finish_position)
  from public.race_participation pa
  join public.race_participation pb on pb.file_id = pa.file_id and pb.player_id <> pa.player_id
  join public.srating_history ha on ha.id = pa.srating_id
  join public.srating_history hb on hb.id = pb.srating_id
  where pa.player_id = p_player
  group by pb.player_id
  order by count(*) desc, pb.player_id
  limit greatest(1, least(p_limit, 50));
$$;

revoke execute on function public.driver_frequent_rivals(text, integer) from public, anon, authenticated;

-- Nightly refresh gains race_participation (it reads the ledger, so it must
-- refresh after new sessions land — same job, same cadence).
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
end;
$$;

revoke execute on function public.refresh_site_stats() from public, anon, authenticated;
