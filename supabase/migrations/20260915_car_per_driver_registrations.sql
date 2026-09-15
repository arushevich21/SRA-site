-- One registrations row per CAR, not per team.
--
-- ── What was wrong ───────────────────────────────────────────────────────
--
-- register_entry() always wrote the Endurance shape: ONE registrations row
-- with every roster driver hanging off it in registration_drivers. On the
-- GT3 Team Series each driver has their own car, so a 2-driver team must be
-- 2 registrations rows sharing a team_id, each with exactly one driver. With
-- the shared shape the ACCSM entrylist saw one car per team and only the
-- primary driver's number survived — the teammate had no car on the grid.
--
-- ── Why a column ─────────────────────────────────────────────────────────
--
-- The shape is decided at write time, and nothing in `championships` says
-- which one applies: the GT3 Team Series (min 2 / max 2) and an Endurance
-- event (min 1 / max 4) are both "multi-driver", differing only in whether
-- those drivers share a car. That is a fact about the championship, so it
-- gets its own column instead of being inferred from format_tag text (which
-- is a display label an admin can reword) or team-size arithmetic.
--
-- Default FALSE = one car per driver. Both championships with a
-- registration_key today (acc-gt3-s19, gt3-liaw) want that. Endurance opts
-- in via the admin event form.
--
-- The READ side needs no flag: the row shape itself says which case it is
-- (shared = 1 registration with N drivers; per-driver = N registrations with
-- 1 driver each), which is what the bot and the entry-list groupers rely on.
--
-- ── Cap semantics ────────────────────────────────────────────────────────
--
-- max_registrations caps confirmed registrations ROWS, and a row is now a
-- car. A team registers atomically: if the whole roster does not fit under
-- the cap, every car in it is waitlisted together with consecutive
-- positions, never half confirmed / half waitlisted. For the shared shape
-- the roster is one row, so `count + 1 > max` is the old `count >= max`.
--
-- No data migration: the next signup/edit would recreate the old shape if
-- the write path weren't fixed, and the fixed write path recreates the right
-- one. Existing acc-gt3-s19 rows are re-entered by hand.

BEGIN;

ALTER TABLE public.championships
  ADD COLUMN shared_car boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN public.championships.shared_car IS
  'TRUE when every driver on an entry shares ONE car (Endurance): '
  'register_entry() writes one registrations row with N registration_drivers. '
  'FALSE (default) when each driver has their own car (GT3 Team Series, LIAW): '
  'one registrations row per driver, all sharing team_id. The row shape is '
  'what readers (entrylist push, entry lists) key off — this flag only '
  'decides which shape gets written.';

UPDATE public.championships
   SET shared_car = true
 WHERE format_tag IS NOT NULL
   AND lower(trim(format_tag)) = 'endurance';

-- ── register_entry(): branch on shared_car ───────────────────────────────
--
-- Based on the 20260914d body (the live one). Validation is unchanged and
-- still runs over the WHOLE roster (division agreement, min/max size, solo
-- exception) before any row is written. Only the insert block differs.
--
-- Returns the registrant's own registrations row in both shapes.
--
-- Same 9-param signature, so CREATE OR REPLACE is safe with no DROP.
CREATE OR REPLACE FUNCTION public.register_entry(
  p_series               text,
  p_season               text,
  p_championship_key     text,
  p_team_id              uuid,
  p_car_model_id         integer,
  p_race_number          integer,
  p_entry_class          text,
  p_registrant_driver_id uuid,
  p_drivers              jsonb
) RETURNS registrations
LANGUAGE plpgsql
AS $$
DECLARE
  v_max               integer;
  v_min_team_size     integer;
  v_max_team_size     integer;
  v_shared_car        boolean;
  v_roster_size       integer;
  v_row_count         integer;
  v_allow_solo        boolean;
  v_confirmed_count    integer;
  v_status             text;
  v_waitlist_position  integer;
  v_row                registrations;
  v_registrant_row     registrations;
  v_division_id        integer;
  v_driver             jsonb;
  v_driver_id          uuid;
  v_driver_division    integer;
  v_registrant_found   boolean := false;
BEGIN
  IF p_drivers IS NULL OR jsonb_array_length(p_drivers) = 0 THEN
    RAISE EXCEPTION 'EMPTY_ROSTER: at least one driver is required';
  END IF;

  SELECT max_registrations, min_team_size, max_team_size, shared_car
    INTO v_max, v_min_team_size, v_max_team_size, v_shared_car
  FROM championships
  WHERE registration_key = p_championship_key
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHAMPIONSHIP_KEY_INVALID: %', p_championship_key;
  END IF;

  FOR v_driver IN SELECT * FROM jsonb_array_elements(p_drivers)
  LOOP
    v_driver_id := (v_driver->>'driver_id')::uuid;

    IF v_driver_id = p_registrant_driver_id THEN
      v_registrant_found := true;
    END IF;

    SELECT division_id INTO v_driver_division
    FROM drivers WHERE id = v_driver_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DRIVER_NOT_FOUND: %', v_driver_id;
    END IF;

    IF v_driver_division IS NULL THEN
      RAISE EXCEPTION 'DIVISION_UNASSIGNED: %', v_driver_id;
    END IF;

    IF v_division_id IS NULL THEN
      v_division_id := v_driver_division;
    ELSIF v_division_id != v_driver_division THEN
      RAISE EXCEPTION 'DIVISION_MISMATCH: driver % is division %, expected %',
        v_driver_id, v_driver_division, v_division_id;
    END IF;
  END LOOP;

  IF NOT v_registrant_found THEN
    RAISE EXCEPTION 'REGISTRANT_NOT_IN_ROSTER: %', p_registrant_driver_id;
  END IF;

  -- ── Roster size ────────────────────────────────────────────────────────
  --
  -- count(DISTINCT ...), NOT jsonb_array_length: a payload listing the same
  -- driver twice would otherwise satisfy a minimum of 2 with one person. That
  -- duplicate would ultimately fail on registration_drivers' unique claim —
  -- but only AFTER this check had already passed it, so the size rule has to
  -- count people, not array elements.
  SELECT count(DISTINCT (d->>'driver_id'))
    INTO v_roster_size
  FROM jsonb_array_elements(p_drivers) d;

  IF v_max_team_size IS NOT NULL AND v_roster_size > v_max_team_size THEN
    RAISE EXCEPTION 'TEAM_TOO_LARGE: % drivers, maximum % for this championship',
      v_roster_size, v_max_team_size;
  END IF;

  IF v_roster_size < v_min_team_size THEN
    -- The per-driver exception, granted by SRA-Bot. coalesce because the
    -- column is nullable and NULL means "not granted", not "unknown".
    SELECT coalesce(allow_gt3_team_series_solo_registration, false)
      INTO v_allow_solo
    FROM drivers WHERE id = p_registrant_driver_id;

    IF NOT coalesce(v_allow_solo, false) THEN
      RAISE EXCEPTION 'SOLO_NOT_PERMITTED: % driver(s), minimum % for this championship',
        v_roster_size, v_min_team_size;
    END IF;
  END IF;

  -- How many registrations rows this entry occupies: one car for the whole
  -- roster, or one car per driver.
  v_row_count := CASE WHEN v_shared_car THEN 1 ELSE v_roster_size END;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_championship_key || ':' || p_season, 0));

  SELECT count(*) INTO v_confirmed_count
  FROM registrations
  WHERE championship_key = p_championship_key
    AND season = p_season
    AND status = 'confirmed';

  -- The whole entry is confirmed or waitlisted together.
  IF v_max IS NOT NULL AND v_confirmed_count + v_row_count > v_max THEN
    v_status := 'waitlisted';
    SELECT coalesce(max(waitlist_position), 0) + 1 INTO v_waitlist_position
    FROM registrations
    WHERE championship_key = p_championship_key
      AND season = p_season
      AND status = 'waitlisted';
  ELSE
    v_status := 'confirmed';
    v_waitlist_position := NULL;
  END IF;

  IF v_shared_car THEN
    -- ── Shared car: one row, every driver on it ────────────────────────
    INSERT INTO registrations (
      series, season, championship_key, division_id, team_id,
      car_model_id, race_number, entry_class, status, waitlist_position
    ) VALUES (
      p_series, p_season, p_championship_key, v_division_id, p_team_id,
      p_car_model_id, p_race_number, p_entry_class, v_status, v_waitlist_position
    )
    RETURNING * INTO v_row;
    v_registrant_row := v_row;

    FOR v_driver IN SELECT * FROM jsonb_array_elements(p_drivers)
    LOOP
      BEGIN
        INSERT INTO registration_drivers (registration_id, driver_id, driver_category, slot)
        VALUES (
          v_row.id,
          (v_driver->>'driver_id')::uuid,
          coalesce((v_driver->>'driver_category')::integer, 1),
          coalesce((v_driver->>'slot')::integer, 0)
        );
      EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'DRIVER_ALREADY_CLAIMED: %', (v_driver->>'driver_id')::uuid;
      END;
    END LOOP;
  ELSE
    -- ── Car per driver: one row per DISTINCT driver, one driver each ───
    --
    -- race_number is passed through as given (null from the site): the
    -- number derives from drivers.driver_number at entrylist-push time, and
    -- an explicit team number only makes sense for a shared car. slot is
    -- always 0 — each car has a single seat.
    FOR v_driver IN
      SELECT DISTINCT ON (d->>'driver_id') d
      FROM jsonb_array_elements(p_drivers) d
      ORDER BY d->>'driver_id'
    LOOP
      v_driver_id := (v_driver->>'driver_id')::uuid;

      INSERT INTO registrations (
        series, season, championship_key, division_id, team_id,
        car_model_id, race_number, entry_class, status, waitlist_position
      ) VALUES (
        p_series, p_season, p_championship_key, v_division_id, p_team_id,
        p_car_model_id, p_race_number, p_entry_class, v_status, v_waitlist_position
      )
      RETURNING * INTO v_row;

      BEGIN
        INSERT INTO registration_drivers (registration_id, driver_id, driver_category, slot)
        VALUES (
          v_row.id,
          v_driver_id,
          coalesce((v_driver->>'driver_category')::integer, 1),
          0
        );
      EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'DRIVER_ALREADY_CLAIMED: %', v_driver_id;
      END;

      IF v_driver_id = p_registrant_driver_id THEN
        v_registrant_row := v_row;
      END IF;

      IF v_waitlist_position IS NOT NULL THEN
        v_waitlist_position := v_waitlist_position + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN v_registrant_row;
END;
$$;

DO $$
DECLARE
  v_shared boolean;
BEGIN
  SELECT shared_car INTO v_shared
  FROM public.championships WHERE registration_key = 'acc-gt3-s19';

  IF v_shared IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'ABORT: acc-gt3-s19 shared_car is %, expected false', v_shared;
  END IF;
END $$;

COMMIT;
