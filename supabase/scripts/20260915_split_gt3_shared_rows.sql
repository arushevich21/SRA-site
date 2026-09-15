-- One-off data fix: split acc-gt3-s19 registrations that were written in
-- the shared-car shape (1 row, 2 drivers) into one row per driver.
--
-- Run AFTER 20260915_car_per_driver_registrations.sql (the write-path fix),
-- otherwise the next signup recreates the old shape. Safe to re-run: a row
-- with one driver is skipped.
--
-- For each row with 2+ drivers: keep the row and its lowest-slot driver
-- (the registrant — slot 0, tie-broken by driver_id), and for every OTHER
-- driver insert a sibling registrations row (same team_id / car / division /
-- status / entry_class, race_number null) and re-point that driver's
-- registration_drivers row at it. Nothing about the driver's claim changes —
-- same driver_id / championship_key / season, so the one-claim-per-event
-- unique constraint is untouched.
--
-- Waitlisted rows: the sibling gets the same waitlist_position as its
-- parent (a team waits as one unit). None exist on acc-gt3-s19 today.
--
-- The registrations INSERT fires registrations_enqueue_entrylist_push, so
-- the bot rebuilds the grids after COMMIT with no further action.

BEGIN;

-- Extra drivers = everything past the first per registration.
CREATE TEMP TABLE t_extra ON COMMIT DROP AS
SELECT rd.registration_id AS old_registration_id,
       rd.driver_id,
       gen_random_uuid()  AS new_registration_id
FROM registration_drivers rd
JOIN registrations r ON r.id = rd.registration_id
WHERE r.championship_key = 'acc-gt3-s19'
  AND r.season = 's19'
  AND rd.driver_id <> (
        SELECT k.driver_id FROM registration_drivers k
        WHERE k.registration_id = rd.registration_id
        ORDER BY k.slot, k.driver_id
        LIMIT 1
      );

SELECT count(*) AS drivers_to_move,
       count(DISTINCT old_registration_id) AS rows_to_split
FROM t_extra;

INSERT INTO registrations (
  id, series, season, championship_key, division_id, team_id,
  car_model_id, race_number, entry_class, status, waitlist_position, meta
)
SELECT x.new_registration_id, r.series, r.season, r.championship_key, r.division_id, r.team_id,
       r.car_model_id, NULL, r.entry_class, r.status, r.waitlist_position, r.meta
FROM t_extra x
JOIN registrations r ON r.id = x.old_registration_id;

UPDATE registration_drivers rd
   SET registration_id = x.new_registration_id,
       slot = 0
  FROM t_extra x
 WHERE rd.registration_id = x.old_registration_id
   AND rd.driver_id = x.driver_id;

-- ── Verify ────────────────────────────────────────────────────────────────
-- Must be zero rows: every GT3 registration has exactly one driver.
SELECT r.id, count(*) AS drivers
FROM registrations r
JOIN registration_drivers rd ON rd.registration_id = r.id
WHERE r.championship_key = 'acc-gt3-s19' AND r.season = 's19'
GROUP BY r.id HAVING count(*) <> 1;

-- Driver count unchanged, rows now == drivers, team count unchanged.
SELECT count(DISTINCT r.id) AS registrations,
       count(rd.driver_id)  AS drivers,
       count(DISTINCT r.team_id) AS teams
FROM registrations r
JOIN registration_drivers rd ON rd.registration_id = r.id
WHERE r.championship_key = 'acc-gt3-s19' AND r.season = 's19';

-- Check the counts above against the dry run, then:
-- COMMIT;   -- or ROLLBACK;
