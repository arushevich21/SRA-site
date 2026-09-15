-- Makes solo registration a granted exception instead of the default.
--
-- ── What was wrong ───────────────────────────────────────────────────────
--
-- drivers.allow_gt3_team_series_solo_registration is written by an SRA-Bot
-- command and is meant to be a last-resort permission: a driver who cannot
-- find a teammate gets it granted, individually. NOTHING read that column.
--
-- Meanwhile the registration form's teammate picker is optional — only
-- team_name and car are `required`, and the selected teammates are client
-- state feeding hidden inputs, so submitting with nobody selected sends zero
-- teammate_id values. The server action had no minimum check, and
-- register_entry() rejected only an EMPTY roster. So a one-driver entry was
-- accepted and confirmed for anybody, and the permission gated nothing.
--
-- The policy was inverted: solo was the default anyone could take by not
-- picking a teammate.
--
-- ── Team size was not enforced here at all ───────────────────────────────
--
-- max_team_size was checked only in the server action (register/actions.ts),
-- never in this function — so there was no size rule inside the transaction
-- that actually owns correctness, and anything calling the RPC directly
-- bypassed it. That is exactly what the registration path's own comments warn
-- about ("anything that actually needs to be correct belongs in
-- register_entry(), not here"). Both bounds move here.
--
-- ── min_team_size, not "max_team_size > 1" ───────────────────────────────
--
-- The obvious shortcut — treat max_team_size > 1 as "teams required" — is
-- wrong: the Endurance series is 1-4 drivers and a solo entry there is
-- perfectly legal. Whether a championship REQUIRES a partner is a separate
-- fact from how many it allows, so it gets its own column.
--
-- ── The column name ──────────────────────────────────────────────────────
--
-- allow_gt3_team_series_solo_registration is GT3-specific and reads oddly as a
-- general permission, but it is the column SRA-Bot's existing command already
-- writes. Renaming it would silently break that command, which is the only
-- thing that grants the exception. Left as-is deliberately.

BEGIN;

ALTER TABLE public.championships
  ADD COLUMN min_team_size integer DEFAULT 1 NOT NULL;

ALTER TABLE public.championships
  ADD CONSTRAINT championships_min_team_size_positive
  CHECK (min_team_size >= 1);

-- A minimum above the maximum is unsatisfiable: every registration would fail,
-- and the only symptom would be drivers unable to sign up with no explanation.
ALTER TABLE public.championships
  ADD CONSTRAINT championships_team_size_range
  CHECK (max_team_size IS NULL OR min_team_size <= max_team_size);

COMMENT ON COLUMN public.championships.min_team_size IS
  'Minimum drivers per entry. 1 (default) means solo entries are fine — '
  'Endurance, LIAW. 2 on the GT3 Team Series, where a partner is required '
  'unless the registrant has drivers.allow_gt3_team_series_solo_registration '
  'granted by SRA-Bot. Enforced in register_entry().';

-- The GT3 Team Series is the only championship that requires a partner today.
UPDATE public.championships
   SET min_team_size = 2
 WHERE registration_key = 'acc-gt3-s19';

-- ── register_entry(): enforce both size bounds + the solo exception ───────
--
-- Based verbatim on the 20260825g body (the live one), with the roster-size
-- block added after the driver loop. Placed there because it is a pure read
-- and needs the loop's registrant check to have run, and BEFORE the advisory
-- lock so the lock is still only held across the cap-check/insert sequence.
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
  v_roster_size       integer;
  v_allow_solo        boolean;
  v_confirmed_count    integer;
  v_status             text;
  v_waitlist_position  integer;
  v_row                registrations;
  v_division_id        integer;
  v_driver             jsonb;
  v_driver_id          uuid;
  v_driver_division    integer;
  v_registrant_found   boolean := false;
BEGIN
  IF p_drivers IS NULL OR jsonb_array_length(p_drivers) = 0 THEN
    RAISE EXCEPTION 'EMPTY_ROSTER: at least one driver is required';
  END IF;

  SELECT max_registrations, min_team_size, max_team_size
    INTO v_max, v_min_team_size, v_max_team_size
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

  PERFORM pg_advisory_xact_lock(hashtextextended(p_championship_key || ':' || p_season, 0));

  SELECT count(*) INTO v_confirmed_count
  FROM registrations
  WHERE championship_key = p_championship_key
    AND season = p_season
    AND status = 'confirmed';

  IF v_max IS NOT NULL AND v_confirmed_count >= v_max THEN
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

  INSERT INTO registrations (
    series, season, championship_key, division_id, team_id,
    car_model_id, race_number, entry_class, status, waitlist_position
  ) VALUES (
    p_series, p_season, p_championship_key, v_division_id, p_team_id,
    p_car_model_id, p_race_number, p_entry_class, v_status, v_waitlist_position
  )
  RETURNING * INTO v_row;

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

  RETURN v_row;
END;
$$;

DO $$
DECLARE
  v_min integer;
BEGIN
  SELECT min_team_size INTO v_min
  FROM public.championships WHERE registration_key = 'acc-gt3-s19';

  IF v_min IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'ABORT: acc-gt3-s19 min_team_size is %, expected 2', v_min;
  END IF;
END $$;

COMMIT;
