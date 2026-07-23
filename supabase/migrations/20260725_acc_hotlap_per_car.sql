-- Migration: track a driver's fastest lap per car, not per class
--
-- acc_hotlap_leaderboard was keyed by (track_key, car_group, steam_id) — one
-- row per driver per class. Setting a lap in a second car of the same class
-- only ever competed against the driver's own previous best, so the losing
-- car's lap was silently discarded rather than stored. Widening the primary
-- key to include car_model_id makes each (driver, car) combination its own
-- row, so a driver's fastest lap in every car they've driven shows up.
--
-- A handful of rows predate the car_model_id column (added in
-- 20260720b_acc_car_model_id.sql) and have it NULL — those can't participate
-- in a composite key that includes it. They're deleted rather than backfilled:
-- there's no reliable way to recover which car produced them, and the driver
-- will simply get a fresh, correctly-keyed row the next time they set any
-- lap at that track.
--
-- Safe to re-run: idempotent.

DELETE FROM acc_hotlap_leaderboard WHERE car_model_id IS NULL;

ALTER TABLE acc_hotlap_leaderboard
  ALTER COLUMN car_model_id SET NOT NULL;

ALTER TABLE acc_hotlap_leaderboard
  DROP CONSTRAINT IF EXISTS acc_hotlap_leaderboard_pkey;

ALTER TABLE acc_hotlap_leaderboard
  ADD CONSTRAINT acc_hotlap_leaderboard_pkey
  PRIMARY KEY (track_key, car_group, steam_id, car_model_id);

-- Old index still useful for per-class ranking queries; recreated since the
-- underlying rows changed shape (now includes per-car duplicates for a
-- driver within the same class), though the index definition itself is
-- unchanged from 20260720_acc_hotlaps.sql.
DROP INDEX IF EXISTS acc_hotlap_leaderboard_track_class_rank_idx;
CREATE INDEX IF NOT EXISTS acc_hotlap_leaderboard_track_class_rank_idx
  ON acc_hotlap_leaderboard (track_key, car_group, best_lap_ms ASC);
