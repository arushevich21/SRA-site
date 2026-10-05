-- admin_add_team_driver(): an admin adds a driver to an existing team.
--
-- ── Why ──────────────────────────────────────────────────────────────────
--
-- /admin/registrations could delete teams and remove drivers but never add
-- one, so the 27 one-driver S19 Team Series teams (solo-permitted, or a
-- partner who left) could only be completed by the driver re-registering.
--
-- ── Shape ────────────────────────────────────────────────────────────────
--
-- A team is the registrations rows sharing team_id within one
-- championship_key + season:
--   • car per driver (shared_car = false, GT3 Team Series): adding a driver
--     adds a CAR — a new registrations row copying the team's car, division,
--     class and status, with the driver on it.
--   • shared car (Endurance): the driver joins the existing car, in the next
--     free slot.
-- driver_category is not set here: the registration_drivers_derive_category
-- trigger (20260930) derives it from drivers.tier on every insert. The
-- existing entrylist triggers queue the ACCSM push.
--
-- ── Rules (same error codes as register_entry where they overlap) ────────
--
--   REGISTRATION_NOT_FOUND   no registrations row with that id
--   DRIVER_NOT_FOUND         no drivers row with that id
--   TEAM_FULL                team already has max_team_size drivers
--   DIVISION_UNASSIGNED      division-grouped championship, driver has none
--   DIVISION_MISMATCH        division-grouped championship, other division
--   DRIVER_ALREADY_CLAIMED   driver is already on an entry this event
--                            (registration_drivers_one_claim_per_event)
--
-- Deliberately NOT enforced: max_registrations. This is an admin completing
-- a team on purpose, so a confirmed team stays confirmed even if its new car
-- takes the grid past the cap (decided 2026-10-05). registration_open is not
-- checked either — admins curate before open and after close.
--
-- Takes the same advisory lock as register_entry(), so it can't race a live
-- sign-up for the same event (both read-then-write the team and the claim).
--
-- ── Access ───────────────────────────────────────────────────────────────
--
-- Service role only. Supabase grants EXECUTE on new public functions to anon
-- and authenticated by default; this one bypasses the driver-facing rules,
-- so those grants are revoked below. The site calls it from a server action
-- behind requireAdmin().

CREATE OR REPLACE FUNCTION public.admin_add_team_driver(
  p_registration_id uuid,
  p_driver_id uuid
) RETURNS public.registrations
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_anchor            registrations;
  v_row               registrations;
  v_max_team_size     integer;
  v_shared_car        boolean;
  v_requires_division boolean;
  v_driver_division   integer;
  v_team_size         integer;
  v_slot              integer;
  v_waitlist_position integer;
BEGIN
  SELECT * INTO v_anchor FROM registrations WHERE id = p_registration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REGISTRATION_NOT_FOUND: %', p_registration_id;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_anchor.championship_key || ':' || v_anchor.season, 0));

  SELECT max_team_size, shared_car, requires_division
    INTO v_max_team_size, v_shared_car, v_requires_division
  FROM championships
  WHERE registration_key = v_anchor.championship_key
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHAMPIONSHIP_KEY_INVALID: %', v_anchor.championship_key;
  END IF;

  SELECT division_id INTO v_driver_division FROM drivers WHERE id = p_driver_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND: %', p_driver_id;
  END IF;

  -- Drivers across every car of the team (confirmed and waitlisted alike —
  -- a team split across the two is still one team).
  SELECT count(*) INTO v_team_size
  FROM registration_drivers rd
  JOIN registrations r ON r.id = rd.registration_id
  WHERE r.championship_key = v_anchor.championship_key
    AND r.season = v_anchor.season
    AND (r.id = v_anchor.id
         OR (v_anchor.team_id IS NOT NULL AND r.team_id = v_anchor.team_id));

  IF v_max_team_size IS NOT NULL AND v_team_size >= v_max_team_size THEN
    RAISE EXCEPTION 'TEAM_FULL: % of % drivers', v_team_size, v_max_team_size;
  END IF;

  IF v_requires_division THEN
    IF v_driver_division IS NULL THEN
      RAISE EXCEPTION 'DIVISION_UNASSIGNED: %', p_driver_id;
    END IF;
    IF v_anchor.division_id IS NOT NULL AND v_driver_division <> v_anchor.division_id THEN
      RAISE EXCEPTION 'DIVISION_MISMATCH: driver % is division %, expected %',
        p_driver_id, v_driver_division, v_anchor.division_id;
    END IF;
  END IF;

  IF v_shared_car THEN
    -- ── Shared car: join the existing car ────────────────────────────────
    SELECT coalesce(max(slot) + 1, 0) INTO v_slot
    FROM registration_drivers WHERE registration_id = v_anchor.id;

    BEGIN
      INSERT INTO registration_drivers (registration_id, driver_id, slot)
      VALUES (v_anchor.id, p_driver_id, v_slot);
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'DRIVER_ALREADY_CLAIMED: %', p_driver_id;
    END;

    RETURN v_anchor;
  END IF;

  -- ── Car per driver: a new car for the new driver ───────────────────────
  -- Same status as the team. A waitlisted team's new car joins the back of
  -- the queue (the admin page sorts a team by its lowest position, so the
  -- team itself doesn't move).
  IF v_anchor.status = 'waitlisted' THEN
    SELECT coalesce(max(waitlist_position), 0) + 1 INTO v_waitlist_position
    FROM registrations
    WHERE championship_key = v_anchor.championship_key
      AND season = v_anchor.season
      AND status = 'waitlisted';
  END IF;

  INSERT INTO registrations (
    series, season, championship_key, division_id, team_id,
    car_model_id, race_number, entry_class, status, waitlist_position
  ) VALUES (
    v_anchor.series, v_anchor.season, v_anchor.championship_key,
    coalesce(v_anchor.division_id, v_driver_division), v_anchor.team_id,
    -- race_number stays NULL: on a car-per-driver championship the number
    -- comes from drivers.driver_number at entrylist-push time.
    v_anchor.car_model_id, NULL, v_anchor.entry_class,
    v_anchor.status, v_waitlist_position
  )
  RETURNING * INTO v_row;

  BEGIN
    INSERT INTO registration_drivers (registration_id, driver_id, slot)
    VALUES (v_row.id, p_driver_id, 0);
  EXCEPTION WHEN unique_violation THEN
    -- Raising aborts the whole function, so the car inserted above goes too.
    RAISE EXCEPTION 'DRIVER_ALREADY_CLAIMED: %', p_driver_id;
  END;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.admin_add_team_driver(uuid, uuid) IS
  'Admin: add a driver to an existing team (new car on car-per-driver championships, next slot on shared cars). Enforces team size, division and the one-claim-per-event rule; not max_registrations. Service role only. See 20261005_admin_add_team_driver.sql.';

REVOKE ALL ON FUNCTION public.admin_add_team_driver(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_team_driver(uuid, uuid) TO service_role;
