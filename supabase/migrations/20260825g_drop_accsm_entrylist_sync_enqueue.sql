-- Reverts the enqueue half of 20260825d_bot_jobs_entrylist_sync.sql.
--
-- ── Why ──────────────────────────────────────────────────────────────────
--
-- 20260825d was written against SRA-Bot's `feat/entrylist-sync-and-server-
-- status` branch, which adds an `accsm_entrylist_sync` handler. That branch
-- was never merged. The bot actually running in production is SRA-Bot@main,
-- whose handler map is {profile_sync, entrylist_push} — so every job this
-- enqueue produces dies immediately with:
--
--   status=error, error='no handler for type=accsm_entrylist_sync'
--
-- (Confirmed on the live queue: job f488f42e-b360-4fbc-b46e-331d27de98c4,
-- enqueued 2026-08-26T01:30:58Z by the first gt3-liaw registration.)
--
-- More importantly the enqueue is not merely broken, it is REDUNDANT. The
-- deployed bot does not need cockpit to tell it a registration happened: its
-- bot_jobs cog subscribes to registrations / registration_drivers / teams
-- over Supabase Realtime and debounces any change into one `entrylist_push`
-- job per championship configured in the bot's own gt3_series_config.json.
-- That path is live and working — the same gt3-liaw registration that
-- produced the errored job above also triggered four successful
-- entrylist_push jobs three seconds later.
--
-- So cockpit's job here is to write the registration correctly and let
-- Realtime carry it. A second, cockpit-driven enqueue path would duplicate
-- the bot's own trigger even after someone adds the missing handler.
--
-- NOTE (not fixed here, needs bot-host access): gt3-liaw's entrylist still
-- won't reach ACCSM after this migration, for an unrelated reason — the
-- bot only pushes championships whose GUID appears in gt3_series_config.json,
-- and gt3-liaw's (3c84e414-4cc7-4b04-bd50-2ddbed15191f) is not in that file.
-- That config lives on the bot host and is untracked. Adding it is the
-- actual fix for the reported "registrations aren't syncing" symptom; this
-- migration only stops cockpit manufacturing a failed job row per signup.
--
-- ── Scope ────────────────────────────────────────────────────────────────
--
-- Restores register_entry() to its 20260820 body verbatim (the validation
-- version) — same 9-param signature, so CREATE OR REPLACE is safe with no
-- DROP. The ONLY difference from the currently-live 20260825d body is the
-- removal of the trailing bot_jobs INSERT block; every other behaviour
-- (championship_key validation, division derivation, advisory lock, cap /
-- waitlist, driver-claim uniqueness) is unchanged and deliberately preserved.
--
-- Existing errored accsm_entrylist_sync rows in bot_jobs are left in place
-- on purpose: they are a truthful record of what happened on registration
-- night, they are terminal (status='error' is never re-claimed), and the
-- dedup index this drops only ever covered status='pending'.

BEGIN;

-- Only ever indexed rows this enqueue created; nothing else writes
-- type='accsm_entrylist_sync'. IF EXISTS so the migration is safe to run
-- against a database where 20260825d was never applied.
DROP INDEX IF EXISTS public.bot_jobs_accsm_entrylist_sync_pending_dedup;

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
    -- leave the variable NULL).
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
  -- automatically at transaction end (see 20260811b's header).
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
      -- translates the generic 23505 into a message naming which driver.
      RAISE EXCEPTION 'DRIVER_ALREADY_CLAIMED: %', (v_driver->>'driver_id')::uuid;
    END;
  END LOOP;

  RETURN v_row;
END;
$$;

COMMIT;
