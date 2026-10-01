-- registration_drivers.driver_category derives from drivers.tier.
--
-- ── What was wrong ───────────────────────────────────────────────────────
--
-- Every acc-gt3-s19 entry went to ACCSM as Silver. All 168 registration_drivers
-- rows across D1-D4 had driver_category = 1, so the whole grid rendered with
-- the same silver badge in ACC — golds included.
--
-- Nothing ever set the value. The site's register action calls
-- createRegistration() without a driverCategory (app/[sim]/register/actions.ts),
-- lib/registrations.ts falls back to `?? 1`, and register_entry() coalesced to
-- the same 1, matching the column default. drivers.tier was populated correctly
-- the whole time (S19: 87 gold / 81 silver) — it just never reached the entry.
--
-- ── The mapping ──────────────────────────────────────────────────────────
--
-- ACC driverCategory: 0 Bronze, 1 Silver, 2 Gold, 3 Platinum. SRA runs two
-- tiers, so gold -> 2 (white plate) and silver -> 1 (grey badge).
--
-- NULL tier -> 1. The enum has no third value, so NULL means "not yet
-- assigned", and an unassigned driver showing as Silver is the conservative
-- read: it under-states rather than handing out a plate nobody earned.
--
-- ── Where it derives ─────────────────────────────────────────────────────
--
-- Inside register_entry(), not in the caller — same reasoning as division_id
-- (20260814e DECISION 1): a fact that lives in `drivers` is read from `drivers`
-- at write time rather than trusted from whatever the client computed. An
-- explicitly passed driver_category still wins so admin tooling can override a
-- one-off; the site passes nothing and gets the derived value.
--
-- This is a write-time snapshot, not a view. A tier change after registration
-- does not retro-edit a live entry — re-run the backfill at the foot of this
-- file if it should.

BEGIN;

CREATE OR REPLACE FUNCTION public.acc_driver_category(p_tier public.driver_tier)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE p_tier WHEN 'gold' THEN 2 ELSE 1 END;
$fn$;

COMMENT ON FUNCTION public.acc_driver_category(public.driver_tier) IS
  'SRA driver tier -> ACC entrylist driverCategory. gold=2 (Gold, white plate), '
  'silver=1 (Silver, grey badge), NULL=1. Single source of the mapping: '
  'register_entry() and the S19 backfill both call it.';

-- ── register_entry(): identical to 20260915 except the two driver_category ──
-- expressions, which now fall through to the tier derivation.
CREATE OR REPLACE FUNCTION public.register_entry(p_series text, p_season text, p_championship_key text, p_team_id uuid, p_car_model_id integer, p_race_number integer, p_entry_class text, p_registrant_driver_id uuid, p_drivers jsonb) RETURNS public.registrations
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
          -- Explicit value wins (admin override); otherwise derive from tier.
          coalesce(
            (v_driver->>'driver_category')::integer,
            public.acc_driver_category(
              (SELECT tier FROM drivers WHERE id = (v_driver->>'driver_id')::uuid))
          ),
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
          -- Explicit value wins (admin override); otherwise derive from tier.
          coalesce(
            (v_driver->>'driver_category')::integer,
            public.acc_driver_category((SELECT tier FROM drivers WHERE id = v_driver_id))
          ),
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

-- ── Backfill the live S19 grid ───────────────────────────────────────────
--
-- Scoped to acc-gt3-s19 deliberately. gt3-liaw's categories do not track tier
-- at all (57 of its 69 rows are category 2, spread across both tiers and NULL)
-- — that looks set by hand for a one-week league, so it is left alone rather
-- than rewritten by a rule it never followed.
--
-- Idempotent: safe to re-run whenever tiers change and the grid needs
-- re-syncing. The ACCSM entrylist push still has to run after this for the
-- change to reach the server.
UPDATE public.registration_drivers rd
   SET driver_category = public.acc_driver_category(d.tier)
  FROM public.drivers d
 WHERE d.id = rd.driver_id
   AND rd.championship_key = 'acc-gt3-s19'
   AND rd.driver_category IS DISTINCT FROM public.acc_driver_category(d.tier);

COMMIT;
