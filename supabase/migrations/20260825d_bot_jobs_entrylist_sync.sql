-- Task E (entrylist wiring, scoped per 2026-08-25 review): job type + dedup
-- index + the enqueue itself, wired atomically into register_entry(). Does
-- NOT touch anything that writes to ACCSM's store.json — SRA-Bot's consumer
-- (added alongside this, see that repo) reads pending jobs and calls the
-- already-correct get_registration_entries()/build_entrylist(), then stops
-- and logs rather than writing, until the three infra facts from Phase 0
-- (reload-on-write vs restart, concurrent-UI-write risk, CIFS mount
-- ownership) are confirmed.
--
-- ── Dedup ────────────────────────────────────────────────────────────────
--
-- One job per signup on registration night would mean N full store.json
-- rewrites over CIFS for the same championship. A unique partial index on
-- the job's championship_key (inside payload, since bot_jobs is a generic
-- jsonb-payload queue) means a second registration for a championship that
-- already has a pending sync queued is a no-op insert, not a second job —
-- the consumer drains all pending registrations for that championship in
-- one build regardless of how many enqueues happened.
create unique index bot_jobs_accsm_entrylist_sync_pending_dedup
  on public.bot_jobs (((payload ->> 'championship_key')))
  where ((type = 'accsm_entrylist_sync') and (status = 'pending'));

-- ── register_entry(): enqueue inside the same transaction ─────────────────
--
-- Same atomicity reasoning as folding registration_drivers into this
-- function instead of a separate insert from the caller: if the enqueue
-- happened as a second round-trip from cockpit after register_entry()
-- returns, a crash/deploy between the two would silently drop the sync —
-- confirmed registration, entrylist never rebuilt, nobody notified. Doing
-- it here means the registration and its sync request commit or roll back
-- together.
--
-- The job is a pure trigger, not state: payload carries ONLY
-- championship_key. division_id was in an earlier draft of this payload —
-- dropped, since the consumer rebuilds the whole entrylist for the
-- championship from current DB state at consume time (same
-- get_registration_entries(championship_key) query the correct-but-
-- unwired builder already uses, which itself takes no division_id), so a
-- stashed division_id in the payload could only ever go stale, never help.
--
-- Wrapped the same way DRIVER_ALREADY_CLAIMED already is a few lines up:
-- a unique_violation here means a sync is already queued for this
-- championship, which is success, not failure — must not abort the
-- registration that already committed correctly.
--
-- Same signature as the live function (9 params, same types) — CREATE OR
-- REPLACE is safe, no DROP needed.
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

  SELECT max_registrations INTO v_max
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

  -- Enqueue the ACCSM entrylist sync, same transaction. A pending job
  -- already queued for this championship (bot_jobs_accsm_entrylist_sync_
  -- pending_dedup) is fine — the consumer will pick up this registration
  -- when it drains, no second job needed.
  BEGIN
    INSERT INTO bot_jobs (type, payload)
    VALUES ('accsm_entrylist_sync', jsonb_build_object('championship_key', p_championship_key));
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  RETURN v_row;
END;
$$;
