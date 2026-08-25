-- Task C (2026-08-20 worklist): brings Hot Stint Qualifying's public
-- leaderboard to full visual parity with the other Hot Stint boards by
-- reusing HotLapBoard unmodified — car, sector times, and a reference-time
-- tier badge, not just name/time.
--
-- acc_hotstint_leaderboard already carries everything needed on each row —
-- car_model_id/car_model (display name), sectors_ms (the per-sector average
-- across the winning 5-lap stint, same meaning as best_stint_ms is the
-- overall average), car_group, and track_key. best_quali was discarding all
-- of them; this carries them through to classification_status and
-- classification_status_public instead of joining anything new.
--
-- Semantics (per the worklist): a driver's rank is their single best average
-- ACROSS ALL STINTS REGARDLESS OF CAR OR TRACK, same as Hot Lap — not
-- per-car. best_quali's `DISTINCT ON (season, steam_id) ... ORDER BY
-- season, steam_id, best_stint_ms` already collapses to one row per driver
-- picking their globally-best stint (it doesn't group by track_key or
-- car_model_id at all) — so every one of these columns naturally comes
-- along as "whichever row happens to be the winning one", no extra logic
-- needed. In practice most seasons' classification runs on one fixed track
-- (checked the historical data 2026-08-25: S9, S13-S19 each have exactly
-- one track_key; S10 and S11 are the only multi-track exceptions) —
-- track_key is carried per-row rather than assumed single-valued, so the
-- reference-tier badge (computed client-side per row, see
-- lib/acc/reference-times.ts's classifyLapTier) stays correct even in a
-- season where it isn't.
--
-- None of car/sectors/car_group/track_key are PII — safe to expose on the
-- public view alongside first_name/last_name/hotstint_ms.
--
-- Also adds steam_id to classification_status_public (was admin-only).
-- Confirmed with the product owner 2026-08-25: the actual hard requirement
-- was always just "lap counts (num_laps) stay hidden" — discord_id,
-- driver_id, has_signup/has_account/has_hotstint/eligible, is_returning,
-- and the rating internals (srating_ordinal/composite/pace_pct) remain
-- admin-only exactly as before; only steam_id moves to public, needed so
-- the Hot Stint Qualifying page can reuse HotLapBoard unmodified (row
-- keying + the "My Laps" filter both key off it, same as every other
-- public ACC leaderboard already ships steamId over the wire for). num_laps
-- itself is untouched and stays admin-only, permanently.
--
-- CREATE OR REPLACE VIEW: both views only gain trailing columns, nothing
-- removed or retyped, so this is valid in place — no DROP needed.
create or replace view public.classification_status with (security_invoker='true') as
  with best_quali as (
    select distinct on (season, steam_id)
      season,
      steam_id,
      best_stint_ms,
      total_laps,
      car_model_id,
      car_model,
      sectors_ms,
      car_group,
      track_key
    from acc_hotstint_leaderboard
    where board_scope = 'seasonal'
      and qualifying = true
      and is_wet = false
      and best_stint_ms is not null
    order by season, steam_id, best_stint_ms
  )
  select
    c.series,
    c.season,
    c.discord_id,
    d.id as driver_id,
    d.steam_id,
    d.first_name,
    d.last_name,
    c.has_signup,
    (d.steam_id is not null) as has_account,
    (bq.steam_id is not null) as has_hotstint,
    (c.has_signup and d.steam_id is not null and bq.steam_id is not null) as eligible,
    bq.best_stint_ms as hotstint_ms,
    bq.total_laps as num_laps,
    (r.player_id is not null) as is_returning,
    coalesce(r.composite, r.os_ordinal) as srating_ordinal,
    r.composite,
    r.pace_pct,
    bq.car_model_id,
    bq.car_model,
    bq.sectors_ms,
    bq.car_group,
    bq.track_key
  from classification c
    left join drivers d on d.discord_id = c.discord_id
    left join best_quali bq
      on bq.season = 'S' || c.season
      and bq.steam_id = 'S' || d.steam_id
    left join driver_ratings r
      on r.player_id = 'S' || d.steam_id
      and r.engine = 'v2-openskill';

revoke all on public.classification_status from anon, authenticated;

create or replace view public.classification_status_public with (security_invoker = true) as
  select
    series,
    season,
    first_name,
    last_name,
    hotstint_ms,
    car_model_id,
    car_model,
    steam_id,
    sectors_ms,
    car_group,
    track_key
  from public.classification_status
  where eligible = true
    and hotstint_ms is not null;

revoke all on public.classification_status_public from anon, authenticated;
