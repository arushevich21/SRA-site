-- Backfill for the two GT3 Team Series S19 registrations whose
-- championship_key still holds the raw ACCSM championship GUID
-- (66ec4e93-75b4-498c-bd66-8d66267af36c) instead of the
-- championships.registration_key slug ('acc-gt3-s19') every read path in
-- cockpit actually filters on. See the 2026-08-20 diagnosis (Task A) for how
-- this was found and 20260820_register_entry_validate_championship_key.sql
-- for the RPC fix that must be applied FIRST — this migration assumes that
-- one is already live, so the next registration can't re-fork the data out
-- from under this backfill.
--
-- MUST run after 20260820_register_entry_validate_championship_key.sql.
--
-- Scope, confirmed by the A1 dry-run:
--   registrations (2 rows change):
--     id=eccd944e-a98c-4954-93c1-82c424ea1fd8
--     id=4ca18a8d-e48a-4f6e-96d8-770ea144a069
--   registration_drivers (0 rows change): all 4 rows for these two
--     registrations already read 'acc-gt3-s19' — the child side had already
--     drifted correct while the parent stayed wrong, which is the anomaly
--     this backfill is repairing (parent/child previously disagreed with
--     each other, not just with the intended value).
--
-- Updates by explicit id, not `WHERE championship_key = '66ec4e93-...'` —
-- a predicate on the value being changed would silently match more rows
-- than reviewed if the data shifts between this being written and run.
--
-- Every precondition this migration relies on is asserted inside the
-- transaction and raises (aborting via ROLLBACK) rather than assumed to
-- still hold at run time.

BEGIN;

DO $$
DECLARE
  v_target_ids uuid[] := ARRAY[
    'eccd944e-a98c-4954-93c1-82c424ea1fd8',
    '4ca18a8d-e48a-4f6e-96d8-770ea144a069'
  ]::uuid[];
  v_matching_parents  integer;
  v_bad_children      integer;
  v_updated           integer;
  v_final_mismatch    integer;
BEGIN
  -- Precondition 1: both target rows still hold the UUID today. If this
  -- doesn't hold, something already changed them (this migration, run
  -- twice, or an unrelated edit) — stop rather than guess which.
  SELECT count(*) INTO v_matching_parents
  FROM registrations
  WHERE id = ANY(v_target_ids)
    AND championship_key = '66ec4e93-75b4-498c-bd66-8d66267af36c'; -- gitleaks:allow (ACCSM championship GUID, not a secret)

  IF v_matching_parents != 2 THEN
    RAISE EXCEPTION 'BACKFILL_PRECONDITION_FAILED: expected 2 registrations rows still holding the UUID championship_key, found %', v_matching_parents;
  END IF;

  -- Precondition 2: every registration_drivers row for these two
  -- registrations already reads 'acc-gt3-s19'. This migration does not
  -- touch registration_drivers at all — if that assumption no longer
  -- holds, updating only the parent would leave a NEW parent/child
  -- mismatch instead of fixing the existing one.
  SELECT count(*) INTO v_bad_children
  FROM registration_drivers
  WHERE registration_id = ANY(v_target_ids)
    AND championship_key != 'acc-gt3-s19';

  IF v_bad_children != 0 THEN
    RAISE EXCEPTION 'BACKFILL_PRECONDITION_FAILED: % registration_drivers row(s) for the target registrations do not read acc-gt3-s19', v_bad_children;
  END IF;

  -- The fix itself: explicit ids only.
  UPDATE registrations
  SET championship_key = 'acc-gt3-s19'
  WHERE id = ANY(v_target_ids);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated != 2 THEN
    RAISE EXCEPTION 'BACKFILL_ROWCOUNT_MISMATCH: expected to update 2 registrations rows, updated %', v_updated;
  END IF;

  -- Final invariant: every registrations + registration_drivers row in the
  -- gt3-teamseries-s19 family now agrees with each other and with
  -- championships.registration_key. Confirms the repair actually closed the
  -- parent/child disagreement rather than just changing the value on one
  -- side again.
  SELECT count(*) INTO v_final_mismatch
  FROM registrations r
  LEFT JOIN registration_drivers rd ON rd.registration_id = r.id
  WHERE r.season = 's19'
    AND (r.championship_key != 'acc-gt3-s19' OR rd.championship_key != 'acc-gt3-s19');

  IF v_final_mismatch != 0 THEN
    RAISE EXCEPTION 'BACKFILL_POSTCONDITION_FAILED: % row(s) still disagree with acc-gt3-s19 after the update', v_final_mismatch;
  END IF;
END $$;

COMMIT;
