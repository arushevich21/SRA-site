-- Leaderboard query speed-ups, from pg_stat_statements (140-day window):
--
-- 1. Hot-lap board reads filter (track_key, board_scope, season) but the only
--    secondary index is (track_key, car_model_id, best_lap_ms) — car_model_id
--    in the middle means just track_key is usable, so every board load read
--    all of a track's rows across every season and sorted them. The
--    "latest updated_at" probe alone averaged 72ms x 386k calls (77ms
--    measured on spa/persistent: 2,958 rows read to return one timestamp).
-- 2. Same probe on the hot-stint board (13ms x 343k calls).
-- 3. Season lists (fetchHotlapSeasons / getHotStintSeasons) paged the season
--    column of EVERY seasonal row through PostgREST, ~33 requests x 38ms per
--    list. Replaced by two small functions returning the distinct seasons.
-- 4. acc_processed_sessions carried a unique index identical to its primary
--    key (18 MB, maintained on every insert for nothing).
--
-- Tables are small (60k / 32k rows), so plain CREATE INDEX (brief write lock,
-- well under a second) rather than CONCURRENTLY, which can't run inside the
-- SQL editor's transaction.

-- 1. Board ordered by lap time, and the board's newest update.
create index if not exists acc_hotlap_board_lap_idx
  on public.acc_hotlap_leaderboard (track_key, board_scope, season, best_lap_ms);
create index if not exists acc_hotlap_board_updated_idx
  on public.acc_hotlap_leaderboard (track_key, board_scope, season, updated_at desc);

-- 2. Hot-stint board's newest update (filters include qualifying).
create index if not exists acc_hotstint_board_updated_idx
  on public.acc_hotstint_leaderboard (track_key, board_scope, qualifying, season, updated_at desc);

-- 3. Distinct seasons. The hot-lap index makes this an index-only scan; the
--    stint table's existing acc_hotstint_board_class_rank_idx already leads
--    with (board_scope, season).
create index if not exists acc_hotlap_scope_season_idx
  on public.acc_hotlap_leaderboard (board_scope, season);

create or replace function public.acc_hotlap_seasons()
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct season
  from public.acc_hotlap_leaderboard
  where board_scope = 'seasonal' and season <> ''
$$;

create or replace function public.acc_hotstint_seasons(p_qualifying boolean)
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct season
  from public.acc_hotstint_leaderboard
  where board_scope = 'seasonal' and qualifying = p_qualifying and season <> ''
$$;

-- Server-side only (service role), like the tables they read.
revoke all on function public.acc_hotlap_seasons() from public, anon, authenticated;
revoke all on function public.acc_hotstint_seasons(boolean) from public, anon, authenticated;
grant execute on function public.acc_hotlap_seasons() to service_role;
grant execute on function public.acc_hotstint_seasons(boolean) to service_role;

-- 4. Duplicate of acc_processed_sessions_pkey (same single column, both unique).
drop index if exists public.acc_processed_sessions_url_key;
