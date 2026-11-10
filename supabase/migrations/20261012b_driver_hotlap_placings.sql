-- A driver's placing on every Hot Lap (Seasonal) board they appear on — the
-- "top hot laps" block on driver profiles (apps/cockpit/src/lib/driver-stats.ts).
--
-- Ranks exactly the way the board page does (fetchAccTrackLeaderboard in
-- apps/cockpit/src/lib/acc/tracks.ts), so a profile's "P3" is the P3 a click
-- lands on:
--   * one board per (display season, track) — continuation codes merge into
--     their base season ('S14-2' -> 'S14' via split_part, see lib/acc/seasons.ts);
--   * wet and dry laps on the same board;
--   * one row per (driver, car), keeping that car's fastest lap;
--   * every class together (the board's default view), ordered by lap time.
--
-- Release gating (an unreleased round of the live season) is NOT applied
-- here — the caller filters with seasonTrackAllowList, the same gate the
-- board routes use, so it can't drift from them.
--
-- Doing this in SQL rather than the app: ranking needs each board's full
-- deduped row set, which would be one large read per board per profile view.
-- Safe to re-run.

create or replace function public.driver_hotlap_placings(p_steam_id text)
returns table (
  season       text,
  track_key    text,
  car_model_id integer,
  best_lap_ms  integer,
  is_wet       boolean,
  "position"   bigint,
  board_size   bigint
)
language sql
stable
set search_path = ''
as $$
  with mine as (
    select distinct split_part(h.season, '-', 1) as season, h.track_key
    from public.acc_hotlap_leaderboard h
    where h.steam_id = p_steam_id and h.board_scope = 'seasonal'
  ),
  board as (
    select distinct on (s.season, h.track_key, h.steam_id, h.car_model_id)
           s.season, h.track_key, h.steam_id, h.car_model_id, h.best_lap_ms, h.is_wet
    from public.acc_hotlap_leaderboard h
    cross join lateral (select split_part(h.season, '-', 1) as season) s
    join mine m on m.season = s.season and m.track_key = h.track_key
    where h.board_scope = 'seasonal'
    order by s.season, h.track_key, h.steam_id, h.car_model_id, h.best_lap_ms
  ),
  ranked as (
    select b.*,
           row_number() over (partition by b.season, b.track_key
                              order by b.best_lap_ms, b.steam_id, b.car_model_id) as "position",
           count(*) over (partition by b.season, b.track_key) as board_size
    from board b
  )
  select distinct on (r.season, r.track_key)
         r.season, r.track_key, r.car_model_id, r.best_lap_ms, r.is_wet, r."position", r.board_size
  from ranked r
  where r.steam_id = p_steam_id
  order by r.season, r.track_key, r."position";
$$;

revoke execute on function public.driver_hotlap_placings(text) from public, anon, authenticated;
