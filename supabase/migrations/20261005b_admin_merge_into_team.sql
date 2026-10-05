-- admin_merge_into_team(): an admin folds one registered entry into another
-- team.
--
-- ── Why ──────────────────────────────────────────────────────────────────
--
-- Two drivers who share a car sometimes each register solo (two D4 entries,
-- both "Team Series" one-driver teams) instead of one registering with the
-- other as teammate. admin_add_team_driver() (20261005) can't fix that — it
-- only takes unclaimed drivers, and both are claimed by their own entries.
-- Removing one and re-adding them would work but is two round trips with a
-- window where the driver is on no entry (and the removal of a car-per-driver
-- entry's only driver deletes its car, so nothing to undo to).
--
-- ── Shape ────────────────────────────────────────────────────────────────
--
-- The SOURCE team (every registrations row sharing the source's team_id in
-- this event, both statuses) is deleted, which cascades to its
-- registration_drivers and frees its drivers' one-claim-per-event. Each of
-- those drivers is then added to the TARGET team through
-- admin_add_team_driver(), in their original slot order — so every rule it
-- enforces (team size, division, claim) applies unchanged, and the drivers
-- take the target team's car, division, class and status.
--
-- All in one transaction: any error (e.g. TEAM_FULL, DIVISION_MISMATCH)
-- rolls the source deletion back too, so a failed merge changes nothing.
--
-- The source's `teams` row is left behind, as deleteRegistration() does — it
-- is a season roster other championships may still reference.
--
-- ── Rules (on top of admin_add_team_driver's) ────────────────────────────
--
--   REGISTRATION_NOT_FOUND   either id has no registrations row
--   MERGE_DIFFERENT_EVENT    the two entries are in different events
--   MERGE_SAME_TEAM          the source is (part of) the target team
--   MERGE_SOURCE_EMPTY       the source entry has no drivers to move
--
-- ── Access ───────────────────────────────────────────────────────────────
--
-- Service role only, like admin_add_team_driver().

CREATE OR REPLACE FUNCTION public.admin_merge_into_team(
  p_target_registration_id uuid,
  p_source_registration_id uuid
) RETURNS public.registrations
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_target     registrations;
  v_source     registrations;
  v_source_ids uuid[];
  v_driver_ids uuid[];
  v_driver_id  uuid;
BEGIN
  SELECT * INTO v_target FROM registrations WHERE id = p_target_registration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REGISTRATION_NOT_FOUND: %', p_target_registration_id;
  END IF;
  SELECT * INTO v_source FROM registrations WHERE id = p_source_registration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REGISTRATION_NOT_FOUND: %', p_source_registration_id;
  END IF;

  IF v_source.championship_key <> v_target.championship_key
     OR v_source.season <> v_target.season THEN
    RAISE EXCEPTION 'MERGE_DIFFERENT_EVENT: % vs %',
      v_source.championship_key || '/' || v_source.season,
      v_target.championship_key || '/' || v_target.season;
  END IF;

  -- Same lock as register_entry() / admin_add_team_driver() (advisory xact
  -- locks are re-entrant, so the nested calls below take it again freely).
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_target.championship_key || ':' || v_target.season, 0));

  -- Every car of the source team in this event.
  SELECT array_agg(id) INTO v_source_ids
  FROM registrations
  WHERE championship_key = v_source.championship_key
    AND season = v_source.season
    AND (id = v_source.id
         OR (v_source.team_id IS NOT NULL AND team_id = v_source.team_id));

  IF v_target.id = ANY (v_source_ids)
     OR (v_target.team_id IS NOT NULL AND v_target.team_id = v_source.team_id) THEN
    RAISE EXCEPTION 'MERGE_SAME_TEAM: %', p_source_registration_id;
  END IF;

  SELECT array_agg(rd.driver_id ORDER BY r.created_at, rd.slot) INTO v_driver_ids
  FROM registration_drivers rd
  JOIN registrations r ON r.id = rd.registration_id
  WHERE rd.registration_id = ANY (v_source_ids);

  IF v_driver_ids IS NULL THEN
    RAISE EXCEPTION 'MERGE_SOURCE_EMPTY: %', p_source_registration_id;
  END IF;

  -- Cascades to registration_drivers, freeing the claims.
  DELETE FROM registrations WHERE id = ANY (v_source_ids);

  FOREACH v_driver_id IN ARRAY v_driver_ids LOOP
    PERFORM admin_add_team_driver(v_target.id, v_driver_id);
  END LOOP;

  RETURN v_target;
END;
$$;

COMMENT ON FUNCTION public.admin_merge_into_team(uuid, uuid) IS
  'Admin: delete the source entry (whole team) and add its drivers to the target team via admin_add_team_driver(), atomically. For two solo entries that share a car. Service role only. See 20261005b_admin_merge_into_team.sql.';

REVOKE ALL ON FUNCTION public.admin_merge_into_team(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_merge_into_team(uuid, uuid) TO service_role;
