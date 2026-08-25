-- Corrects a semantics mistake from 20260825_classification_status_car_
-- model.sql: classification_status_public was built by selecting from
-- classification_status, which is collapsed to ONE row per driver (their
-- single best stint regardless of car) by best_quali's
-- `DISTINCT ON (season, steam_id)`. That collapse is what "Unique Drivers"
-- is supposed to do as a client-side TOGGLE on the board (same as every
-- other Hot Stint/Hot Lap board — see HotLapBoard.tsx's applyFilters), not
-- something baked into the data the board receives. A driver who set
-- qualifying stints in three different cars should show three rows by
-- default; toggling Unique Drivers collapses that to their single best,
-- regardless of car.
--
-- classification_status itself (the admin view) is UNCHANGED — it still
-- collapses to one row per driver via best_quali, and that stays the
-- "official" number classification/division-placement logic reasons about.
-- Only the public-facing projection changes, from "select the collapsed
-- row" to "select every qualifying stint for every eligible driver".
--
-- Eligibility gate is reproduced here directly (has_signup AND a linked
-- steam_id), rather than reading classification_status's `eligible` column
-- — that column is itself computed from the collapsed best_quali join, so
-- reusing it here would silently drag the single-row collapse back in.
-- has_hotstint doesn't need its own condition: a driver with no qualifying
-- stint simply produces no join match against acc_hotstint_leaderboard, so
-- the inner join itself is the has_hotstint filter.
--
-- CREATE OR REPLACE VIEW: same column list, same names/types/order as
-- before — only the FROM/JOIN structure and row cardinality change, which
-- CREATE OR REPLACE VIEW allows.
create or replace view public.classification_status_public with (security_invoker = true) as
  select
    c.series,
    c.season,
    d.first_name,
    d.last_name,
    bq.best_stint_ms as hotstint_ms,
    bq.car_model_id,
    bq.car_model,
    d.steam_id,
    bq.sectors_ms,
    bq.car_group,
    bq.track_key
  from classification c
    join drivers d on d.discord_id = c.discord_id
    join acc_hotstint_leaderboard bq
      on bq.season = 'S' || c.season
      and bq.steam_id = 'S' || d.steam_id
      and bq.board_scope = 'seasonal'
      and bq.qualifying = true
      and bq.is_wet = false
      and bq.best_stint_ms is not null
  where c.has_signup = true
    and d.steam_id is not null;

revoke all on public.classification_status_public from anon, authenticated;
