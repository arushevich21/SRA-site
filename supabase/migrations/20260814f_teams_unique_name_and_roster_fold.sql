-- Two closeouts on the registration_drivers work (20260814d/e):
--
-- 1. UNIQUE (series, season, name) on teams. NOT a concurrency guard — the
--    concurrent-first-registration race already resolves correctly at
--    registration_drivers_one_claim_per_event: two requests can each create
--    an orphan `teams` row, but only one can win the registrant's claim in
--    registration_drivers, and a team with no registration is harmless.
--    This constraint is for presentation: two identically-named teams in
--    standings/entrylists is a real, user-visible problem regardless of any
--    race. A violation here is a normal "team name already taken" case the
--    UI should show as a friendly message (23505), not a race condition.
--
-- 2. Fold the team_members write into register_entry(), same transaction as
--    registrations/registration_drivers. Previously the plan was to have
--    the calling action write team_members as a separate step after the
--    RPC returns — but if the RPC succeeds and that separate insert then
--    fails, the roster (team_members) and the entry (registration_drivers)
--    disagree. registration_drivers stays authoritative for entrylists/
--    results/eligibility (per the split rationale — nothing breaks
--    functionally), but a silently-diverged roster is still a bug waiting
--    to surface as user confusion later. One transaction removes the
--    possibility entirely instead of requiring the action to log/handle a
--    partial-failure state.
--
-- PROPOSED — NOT RUN.

alter table public.teams
  add constraint teams_unique_name_per_season unique (series, season, name);

-- Same signature as 20260814e (no parameters added or removed) — CREATE OR
-- REPLACE is sufficient here, no DROP FUNCTION needed.
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

  PERFORM pg_advisory_xact_lock(hashtextextended(p_championship_key || ':' || p_season, 0));

  SELECT max_registrations INTO v_max
  FROM championships
  WHERE registration_key = p_championship_key
  LIMIT 1;

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

    -- Roster write, same transaction as the entry above (see migration
    -- header, point 2). ON CONFLICT DO UPDATE, not DO NOTHING: a driver
    -- re-registering with a different driver_category should have
    -- team_members reflect the current value, not the stale first-seen one.
    INSERT INTO team_members (team_id, driver_id, driver_category)
    VALUES (
      p_team_id,
      (v_driver->>'driver_id')::uuid,
      coalesce((v_driver->>'driver_category')::integer, 1)
    )
    ON CONFLICT (team_id, driver_id) DO UPDATE
      SET driver_category = excluded.driver_category;
  END LOOP;

  RETURN v_row;
END;
$$;
