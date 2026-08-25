-- Closes the gap Task A of the 2026-08-20 diagnosis found: register_entry()
-- accepted p_championship_key from the client and inserted it unvalidated.
-- Two of three registrations.rows for GT3 Team Series S19 ended up keyed to
-- the raw ACCSM championship GUID (66ec4e93-...) instead of the
-- championships.registration_key slug ('acc-gt3-s19') that every other read
-- path in cockpit filters on — almost certainly because SRA-Bot's own docs
-- (doc/REGISTRATION.md) describe championship_key as "the ACCSM GUID",
-- which is wrong. The backfill for those two rows is a SEPARATE migration
-- (20260820b) and must run AFTER this one — if it ran first, the very next
-- registration submitted before this validation landed could re-fork the
-- data. See that migration's header for the backfill itself.
--
-- Same signature as the live 20260814e version (9 params, same types), so
-- CREATE OR REPLACE is safe here — no DROP needed (contrast 20260814e's own
-- header, which explains why a signature CHANGE would have required one).
--
-- Error code CHAMPIONSHIP_KEY_INVALID follows the existing parseable-prefix
-- convention (EMPTY_ROSTER, DRIVER_NOT_FOUND, DIVISION_UNASSIGNED, etc. —
-- see 20260814e).
--
-- Deliberately out of scope here: championships.registration_key itself is
-- still free-text and editable in EventForm.tsx after registrations exist
-- against it. This validation stops a client from sending an arbitrary
-- string, but an admin retyping that field still orphans every existing
-- registration for that championship in one save — plausibly what actually
-- happened around 2026-08-19. That is a separate design decision (freeze
-- the field once registrations exist vs. cascade the edit) and is being
-- written up, not built, alongside the Task D/E proposals.

create or replace function public.register_entry(
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

  -- Validate p_championship_key against the championships row it claims to
  -- belong to before doing anything else — a pure read, same as the driver
  -- loop below, so it belongs before the advisory lock too. This also
  -- replaces the old max_registrations lookup (it was already querying this
  -- same row) rather than adding a second SELECT against championships.
  SELECT max_registrations INTO v_max
  FROM championships
  WHERE registration_key = p_championship_key
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHAMPIONSHIP_KEY_INVALID: %', p_championship_key;
  END IF;

  -- Pure reads, no race-sensitive content — done before the advisory lock
  -- so the lock is only held across the cap-check/insert sequence below,
  -- not this whole loop.
  FOR v_driver IN SELECT * FROM jsonb_array_elements(p_drivers)
  LOOP
    v_driver_id := (v_driver->>'driver_id')::uuid;

    IF v_driver_id = p_registrant_driver_id THEN
      v_registrant_found := true;
    END IF;

    -- FOUND is set by the SELECT INTO immediately above it — distinguishes
    -- "no drivers row at all" from "row exists but division_id is NULL",
    -- which a single `IS NULL` check on v_driver_division cannot do (both
    -- leave the variable NULL). Conflating the two was wrong in an earlier
    -- draft of this function: it would have reported DRIVER_NOT_FOUND for
    -- every driver in the normal pre-season case instead of the intended
    -- DIVISION_UNASSIGNED.
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

  -- Serializes concurrent registrations for THIS event only — released
  -- automatically at transaction end (see 20260811b's header for the full
  -- rationale; unchanged here).
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

  -- registration_drivers.championship_key/season are auto-derived by
  -- registration_drivers_set_event_key (20260814d) from registration_id —
  -- not set here, so there's no way for this insert to disagree with the
  -- parent row it just created.
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
      -- The constraint (registration_drivers_one_claim_per_event) is what
      -- actually prevents the double-claim race atomically — this only
      -- translates the generic 23505 into a message naming which driver,
      -- for the UI. Re-raising here aborts the whole function call,
      -- rolling back the registrations insert and any registration_drivers
      -- rows already inserted earlier in this same loop.
      RAISE EXCEPTION 'DRIVER_ALREADY_CLAIMED: %', (v_driver->>'driver_id')::uuid;
    END;
  END LOOP;

  RETURN v_row;
END;
$$;
