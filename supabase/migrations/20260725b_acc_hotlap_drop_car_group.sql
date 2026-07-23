-- Migration: stop persisting car_group on acc_hotlap_leaderboard
--
-- car_group is a pure function of car_model_id (see accCarClassName in
-- packages/domain/src/acc/acc-constants.ts) — storing a derived value goes
-- stale the moment the classification table is corrected. This happened
-- twice within the same session: Oulton Park's TCX cars were initially
-- reported as "GT3" by the server itself (an unreliable, server-configurable
-- value we were trusting), then a further correction moved them from TCX to
-- GTC in our own lookup table — both times requiring manual reconciliation
-- of already-stored rows. Every table that persists a copy of class needs
-- that same reconciliation dance, forever, every time a car gets
-- reclassified. Going forward, no table stores car_group — every consumer
-- (leaderboard, and future race/championship results) derives it fresh from
-- car_model_id at read/aggregation time.
--
-- Some existing (track_key, steam_id, car_model_id) groups have more than
-- one row differing only by car_group (the exact drift this migration
-- eliminates) — collapse to the faster lap before simplifying the key.
--
-- Safe to re-run: idempotent.

-- Collapse duplicates: for each (track_key, steam_id, car_model_id), keep
-- only the row with the lowest best_lap_ms (ctid breaks ties deterministically
-- so exactly one survivor remains regardless of car_group's value).
DELETE FROM acc_hotlap_leaderboard a
USING acc_hotlap_leaderboard b
WHERE a.ctid <> b.ctid
  AND a.track_key = b.track_key
  AND a.steam_id = b.steam_id
  AND a.car_model_id = b.car_model_id
  AND (
    a.best_lap_ms > b.best_lap_ms
    OR (a.best_lap_ms = b.best_lap_ms AND a.ctid > b.ctid)
  );

ALTER TABLE acc_hotlap_leaderboard
  DROP CONSTRAINT IF EXISTS acc_hotlap_leaderboard_pkey;

ALTER TABLE acc_hotlap_leaderboard
  ADD CONSTRAINT acc_hotlap_leaderboard_pkey
  PRIMARY KEY (track_key, steam_id, car_model_id);

ALTER TABLE acc_hotlap_leaderboard
  DROP COLUMN IF EXISTS car_group;

DROP INDEX IF EXISTS acc_hotlap_leaderboard_track_class_rank_idx;
CREATE INDEX IF NOT EXISTS acc_hotlap_leaderboard_track_car_rank_idx
  ON acc_hotlap_leaderboard (track_key, car_model_id, best_lap_ms ASC);
