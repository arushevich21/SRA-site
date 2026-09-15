-- Replaces a hard series-wide ENTRY cap with a soft per-division DRIVER target.
--
-- ── What was wrong ───────────────────────────────────────────────────────
--
-- championships.max_registrations on the GT3 Team Series row was 55, set back
-- when that row meant Division 1 alone. After 20260914_gt3_team_series_one_brand
-- collapsed four divisions onto one registration_key, that number became wrong
-- on three separate axes at once. It:
--
--   * counts REGISTRATIONS (one row per team/car), not drivers;
--   * applies to the WHOLE SERIES, because register_entry() counts by
--     (championship_key, season) and all four divisions now share one key;
--   * is HARD — past it, register_entry() waitlists rather than confirms.
--
-- So at 55 the 56th entry of the entire series is waitlisted regardless of
-- division: roughly 110 drivers across four grids, most of the field. And a
-- waitlisted entry is not on the ACCSM entrylist, so those drivers could not
-- have joined the server or generated a result either.
--
-- ── What is actually wanted ──────────────────────────────────────────────
--
-- 55 DRIVERS PER DIVISION, as an indicator rather than a gate — it exists
-- because some ACC tracks have fewer than 50 pit boxes, so the number needs to
-- be VISIBLE when a division is filling up, not silently enforced.
--
-- Two changes, therefore:
--   1. max_registrations -> NULL on this row: nothing is blocked or waitlisted.
--   2. a new division_driver_cap column the register page renders a count
--      against, per division.
--
-- Deliberately a separate column rather than reinterpreting max_registrations:
-- the two mean genuinely different things (hard entry ceiling vs soft driver
-- target), register_entry() reads max_registrations and must keep working
-- unchanged for every other event, and overloading one column with "hard here,
-- soft there" is how the current confusion started.

BEGIN;

ALTER TABLE public.championships
  ADD COLUMN division_driver_cap integer;

ALTER TABLE public.championships
  ADD CONSTRAINT championships_division_driver_cap_positive
  CHECK (division_driver_cap IS NULL OR division_driver_cap > 0);

COMMENT ON COLUMN public.championships.division_driver_cap IS
  'Soft per-division DRIVER target, shown as a count on the register page '
  '(e.g. "34 / 55 drivers"). Advisory only — nothing blocks or waitlists on '
  'it. Contrast max_registrations, which is a HARD cap on confirmed entries '
  '(teams/cars) enforced by register_entry(). NULL = no target shown.';

UPDATE public.championships
   SET division_driver_cap = 55,
       -- Drop the hard cap: with four divisions sharing one registration_key
       -- this was about to waitlist most of the field.
       max_registrations   = NULL
 WHERE registration_key = 'acc-gt3-s19';

DO $$
DECLARE
  v_max integer;
  v_cap integer;
BEGIN
  SELECT max_registrations, division_driver_cap INTO v_max, v_cap
  FROM public.championships WHERE registration_key = 'acc-gt3-s19';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ABORT: no championship with registration_key=acc-gt3-s19';
  END IF;
  IF v_max IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: max_registrations is still % — the hard cap was not cleared', v_max;
  END IF;
  IF v_cap <> 55 THEN
    RAISE EXCEPTION 'ABORT: division_driver_cap is %, expected 55', v_cap;
  END IF;
END $$;

COMMIT;
