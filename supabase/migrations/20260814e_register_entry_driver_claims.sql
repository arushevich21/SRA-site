-- Extends register_entry() to take the full driver roster and, inside the
-- same transaction as the cap-check/insert it already did:
--   - derives division_id from the roster itself (see DECISION 1 below —
--     this DROPS the p_division_id parameter, a breaking signature change)
--   - inserts registration_drivers rows, relying on
--     registration_drivers_one_claim_per_event (20260814d) to make
--     double-claim rejection atomic — no check-then-insert
--   - returns distinguishable, parseable errors (see DECISION 2 below)
--
-- PROPOSED — NOT RUN. Depends on 20260814d (registration_drivers.
-- championship_key/season + the unique constraint) being applied first.
--
-- ============================================================================
-- DECISION 1: p_division_id is REMOVED from the signature.
--
-- The old signature trusted a division_id integer passed in by the caller
-- (in practice, the caller derived it server-side from the registrant's own
-- driver row — not a client-editable value today). This version goes
-- further: register_entry() no longer accepts a division_id at ALL. It
-- looks up every driver in p_drivers by id, requires their division_id to
-- all agree, and uses that as the registration's division — removing the
-- parameter closes the class of bug entirely rather than trusting every
-- future caller to keep deriving it correctly. This is a breaking change to
-- the RPC signature and to CreateRegistrationInput/createRegistration() in
-- lib/registrations.ts (divisionId param removed, a drivers array added) —
-- confirm before this runs, since it changes the TS call site too.
--
-- DECISION 2: error contract is RAISE EXCEPTION with a parseable prefix,
-- not a structured return-value error field.
--
-- Mirrors the pattern the old (broken) /register code already used for
-- Postgres errors (checking teamErr.code === '23505') — no new error-
-- handling shape introduced. Exact contract the caller can match on:
--   EMPTY_ROSTER               — p_drivers was empty
--   DRIVER_NOT_FOUND: <id>     — a driver id in the roster doesn't exist
--   DIVISION_UNASSIGNED: <id>  — driver exists but drivers.division_id is
--                                NULL (the normal pre-season state, not an
--                                edge case — distinct from DIVISION_MISMATCH
--                                on purpose, see below)
--   DIVISION_MISMATCH: ...     — roster spans more than one (assigned) division
--   REGISTRANT_NOT_IN_ROSTER: <id> — p_registrant_driver_id isn't in p_drivers
--   DRIVER_ALREADY_CLAIMED: <id> — unique_violation on registration_drivers,
--                                  translated to name which driver
-- Alternative considered: return a row with an error_code text field
-- instead of raising, so createRegistration() stays a plain ok:true/false
-- discriminated union with no try/catch. Didn't pick this because it would
-- make the FUNCTION itself responsible for deciding "is this row committed
-- or not" separately from Postgres's own transaction semantics — RAISE
-- keeps "any failure rolls back everything this call did" automatic instead
-- of something the function has to get right by hand. Say if you'd rather
-- have the structured-return version instead; it's a straightforward rework.
--
-- DIVISION_UNASSIGNED vs DIVISION_MISMATCH: pre-season, before divisions are
-- assigned, every driver's division_id is NULL — that's the normal state
-- register_entry() will be called in most, not an edge case. SQL's
-- NULL = NULL evaluates to NULL (not true), so a naive "do all these agree"
-- comparison would either wrongly accept an all-NULL roster (NULL is never
-- unequal to anything, so a v_division_id != v_driver_division check never
-- fires) or, if written the other way, reject a legitimate registration
-- with a MISMATCH message that misdescribes the actual problem. Both are
-- wrong for a user staring at an error: "division mismatch" when nobody has
-- been assigned yet reads as a bug report, not a "come back after divisions
-- are set" notice. Handled by checking IS NULL and raising a distinct code
-- BEFORE any equality comparison runs — by the time two drivers' divisions
-- are compared, both are already guaranteed non-null, so the SQL tri-state
-- logic problem never has a chance to matter.
--
-- REGISTRANT_NOT_IN_ROSTER: added p_registrant_driver_id as an explicit
-- parameter and enforce their presence in p_drivers server-side, rather
-- than trusting the calling action to always prepend them — same reasoning
-- as DECISION 1: an "the action always does X" convention is exactly the
-- kind of assumption this schema has already lost once (see the
-- team_members/championship_key history).
-- ============================================================================

-- CREATE OR REPLACE cannot change a function's parameter list — with a
-- different signature (p_division_id removed, p_drivers added), it would
-- silently CREATE A SECOND OVERLOAD instead of replacing the 20260811b
-- version, leaving both live and ambiguous to PostgREST/supabase-js's
-- .rpc() call (which resolves by matching supplied argument names against
-- available overloads). The old 8-arg signature must be dropped explicitly
-- first.
drop function if exists public.register_entry(text, text, text, integer, uuid, integer, integer, text);

create or replace function public.register_entry(
  p_series               text,
  p_season               text,
  p_championship_key     text,
  p_team_id              uuid,
  p_car_model_id         integer,
  p_race_number          integer,
  p_entry_class          text,
  -- The authenticated caller's own driver id — must appear in p_drivers
  -- (see REGISTRANT_NOT_IN_ROSTER above). Not derived from p_drivers itself
  -- (e.g. "first entry"), so the caller can't accidentally register a team
  -- that doesn't include them by omission.
  p_registrant_driver_id uuid,
  -- [{"driver_id": "<uuid>", "driver_category": 1, "slot": 0}, ...] —
  -- driver_category/slot default to 1/0 if omitted (matches
  -- registration_drivers' own column defaults).
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
