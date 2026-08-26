-- Divisions become per-championship, not universal.
--
-- Divisions are a GT3 Team Series concept: drivers are graded into D1-D4 and
-- race their own grid. One-off events like League in a Week have a single
-- grid and no grading, but register_entry() rejected every driver without a
-- division_id (DIVISION_UNASSIGNED) and the register page refused to render a
-- form for them. Anyone not in the team series simply could not sign up.
--
-- ── championships.requires_division ──────────────────────────────────────
--
-- An explicit flag, not inferred. The tempting inferences are all wrong:
-- max_team_size = 1 means solo, not division-less (a solo series can still be
-- graded); event_type/format_tag describe the racing format, not driver
-- grading. Defaults TRUE so every existing championship keeps today's
-- behaviour and only an admin ticking the box changes anything.
--
-- ── championship_accsm_targets.division_id becomes nullable ──────────────
--
-- NULL means "every entry for this registration_key", which is what a
-- division-less championship needs — its ACCSM grid takes all of them. The
-- bot skips its division filter when it reads NULL.
--
-- That forces the key off PRIMARY KEY, which cannot contain NULL. UNIQUE
-- NULLS NOT DISTINCT (PG15+; we are on 17.6) keeps exactly the guarantee the
-- PK gave — including treating two NULL-division rows for one championship as
-- a duplicate, which a default NULLS DISTINCT unique would let through. This
-- is the same natural key, only now expressible for a championship that has
-- no divisions.
--
-- ── Backfill ─────────────────────────────────────────────────────────────
--
-- gt3-liaw's existing registrations carry division_id 1 only because both
-- registrants happen to be graded drivers; the event never used divisions.
-- Left as-is they would be a filter trap the moment the target row goes NULL
-- (mixed 1/NULL rows for one grid), so they are nulled here in the same
-- transaction as the flag that makes them meaningless.

BEGIN;

ALTER TABLE public.championships
  ADD COLUMN IF NOT EXISTS requires_division boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.championships.requires_division IS
  'Whether entries are graded into divisions. TRUE for the GT3 Team Series; '
  'FALSE for single-grid events like League in a Week, whose registrants need '
  'no division assignment.';

UPDATE public.championships
   SET requires_division = false
 WHERE registration_key = 'gt3-liaw';

-- ── targets: allow "all divisions" ───────────────────────────────────────

ALTER TABLE public.championship_accsm_targets
  DROP CONSTRAINT championship_accsm_targets_pkey;

ALTER TABLE public.championship_accsm_targets
  ALTER COLUMN division_id DROP NOT NULL;

ALTER TABLE public.championship_accsm_targets
  ADD CONSTRAINT championship_accsm_targets_key_division_unique
  UNIQUE NULLS NOT DISTINCT (registration_key, division_id);

COMMENT ON COLUMN public.championship_accsm_targets.division_id IS
  'Which division''s entries belong on this ACCSM grid. NULL = every entry for '
  'this registration_key (a championship with requires_division = false).';

UPDATE public.championship_accsm_targets
   SET division_id = NULL
 WHERE registration_key = 'gt3-liaw';

-- ── registrations: drop the now-meaningless division on LIAW entries ─────

UPDATE public.registrations
   SET division_id = NULL
 WHERE championship_key = 'gt3-liaw';

-- ── register_entry(): derive/validate division only when required ────────
--
-- Same 9-param signature, so CREATE OR REPLACE is safe. The only change from
-- 20260825g's body is that the division block is conditional: when the
-- championship doesn't require divisions we skip derivation entirely and
-- insert NULL, so DIVISION_UNASSIGNED and DIVISION_MISMATCH can no longer
-- fire for it. Drivers are still validated to EXIST (DRIVER_NOT_FOUND) — that
-- check was never about grading.

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
  v_requires_division boolean;
  v_confirmed_count    integer;
  v_status             text;
  v_waitlist_position  integer;
  v_row                registrations;
  v_division_id        integer;
  v_driver             jsonb;
  v_driver_id          uuid;
  v_driver_division    integer;
  v_driver_exists      boolean;
  v_registrant_found   boolean := false;
BEGIN
  IF p_drivers IS NULL OR jsonb_array_length(p_drivers) = 0 THEN
    RAISE EXCEPTION 'EMPTY_ROSTER: at least one driver is required';
  END IF;

  SELECT max_registrations, requires_division
    INTO v_max, v_requires_division
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

    SELECT division_id, true INTO v_driver_division, v_driver_exists
    FROM drivers WHERE id = v_driver_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DRIVER_NOT_FOUND: %', v_driver_id;
    END IF;

    -- Grading checks only apply to a championship that grades.
    IF v_requires_division THEN
      IF v_driver_division IS NULL THEN
        RAISE EXCEPTION 'DIVISION_UNASSIGNED: %', v_driver_id;
      END IF;

      IF v_division_id IS NULL THEN
        v_division_id := v_driver_division;
      ELSIF v_division_id != v_driver_division THEN
        RAISE EXCEPTION 'DIVISION_MISMATCH: driver % is division %, expected %',
          v_driver_id, v_driver_division, v_division_id;
      END IF;
    END IF;
  END LOOP;

  IF NOT v_registrant_found THEN
    RAISE EXCEPTION 'REGISTRANT_NOT_IN_ROSTER: %', p_registrant_driver_id;
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

COMMIT;
