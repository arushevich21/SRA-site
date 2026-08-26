-- Hot Stint Qualifying shows every qualifying stint, not just signed-up drivers.
--
-- ── Why ──────────────────────────────────────────────────────────────────
--
-- classification_status_public was built from `classification` outward:
--
--   FROM classification c
--   JOIN drivers d  ON d.discord_id = c.discord_id
--   JOIN acc_hotstint_leaderboard bq ON ...
--   WHERE c.has_signup = true
--
-- so a driver appeared only if they had a classification row AND had ticked
-- signup. Both are the wrong gate for a leaderboard. People sign up at all
-- points during the qualifying window — often after setting their times —
-- and until they do, their laps simply did not exist as far as the site was
-- concerned, while the bot cheerfully posted them to #laptime-updates.
--
-- Measured before writing this: 28 drivers had an S19 qualifying stint and 6
-- of them (Ramon Lorenzo, Thomas Olhausen, Julien Bacon, Brad Garman, Danny
-- Durrance, Chris Mek) had no classification row at all, so they were
-- invisible. Note that dropping `has_signup = true` alone would NOT have
-- surfaced them: the JOIN to classification excluded them a step earlier.
-- The direction of the query is what had to change.
--
-- ── What it is now ───────────────────────────────────────────────────────
--
-- Built from the stint board outward. `classification` is still consulted,
-- but only for the (series, season) pairs that define a qualifying window —
-- never per driver. Every qualifying stint in such a season is included.
--
-- The drivers join is LEFT: a stint set by someone with no drivers row is
-- still a real lap and still ranks. Name and steam_id fall back to what the
-- stint row itself carries, which is the same source #Jagoff already uses
-- (see getJagoffBoard — that board has always been ungated this way, and is
-- the precedent here).
--
-- Unchanged on purpose:
--   * DIVISION ASSIGNMENT. Admin reads `classification_status` directly, not
--     this view, and has_signup still gates eligibility there. Showing a lap
--     publicly and counting someone as classified are different questions;
--     this only changes the first.
--   * One row per (driver, car) — collapsing to a driver's single best stays
--     HotLapBoard's client-side "Unique Drivers" toggle (see 20260825b,
--     which fixed exactly that mistake).
--   * Column names, order and types, so CREATE OR REPLACE keeps existing
--     grants and the app's PUBLIC_CLASSIFICATION_COLUMNS select is untouched.
--   * dry, non-wet, seasonal, qualifying-only filters.

BEGIN;

CREATE OR REPLACE VIEW public.classification_status_public
WITH (security_invoker='true') AS
  SELECT
    w.series,
    w.season,
    -- Falls back to the stint's own driver_name for anyone without a drivers
    -- row. Rendered as "first last", so an unsplit full name lands correctly
    -- in first_name with last_name NULL.
    COALESCE(d.first_name, bq.driver_name) AS first_name,
    d.last_name,
    bq.best_stint_ms AS hotstint_ms,
    bq.car_model_id,
    bq.car_model,
    -- drivers.steam_id is stored bare; the board's is 'S'-prefixed. Keep
    -- emitting the bare form either way.
    COALESCE(d.steam_id, substring(bq.steam_id from 2)) AS steam_id,
    bq.sectors_ms,
    bq.car_group,
    bq.track_key
  FROM (SELECT DISTINCT series, season FROM public.classification) w
  JOIN public.acc_hotstint_leaderboard bq
    ON bq.season = ('S'::text || w.season)
   AND bq.board_scope = 'seasonal'::text
   AND bq.qualifying = true
   AND bq.is_wet = false
   AND bq.best_stint_ms IS NOT NULL
  LEFT JOIN public.drivers d
    ON ('S'::text || d.steam_id) = bq.steam_id;

COMMENT ON VIEW public.classification_status_public IS
  'Public Hot Stint Qualifying board: EVERY qualifying stint set in a season '
  'that has a classification window, regardless of whether the driver has a '
  'classification row or has ticked signup (changed 2026-08-26 — people sign '
  'up throughout the window, often after setting times, and their laps must '
  'not be invisible until they do). `classification` is read only for the '
  '(series, season) pairs that define a window, never per driver. Eligibility '
  'for division assignment is a separate question and still lives in '
  'classification_status, which admin reads directly. Never adds discord_id, '
  'driver_id, num_laps, or rating internals (composite/pace_pct/'
  'srating_ordinal) — those stay admin-only, permanently.';

COMMIT;
