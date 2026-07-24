-- Repair: acc_hotlap_leaderboard is missing its car_group column.
--
-- 20260720_acc_hotlaps.sql defines the table WITH car_group in the primary key,
-- but it uses CREATE TABLE IF NOT EXISTS and the table already existed from an
-- earlier schema — so the create was a no-op and car_group was never added.
-- Every read/write that keys on it then breaks: getAccTrackTopTimes /
-- getAccTrackLeaderboard 400 with "column car_group does not exist", and the
-- cron upsert (onConflict track_key,car_group,steam_id) silently fails, leaving
-- the leaderboard stale.
--
-- This adds the column, backfills it from car_model_id (GT4 = 50–61, GT2 =
-- 80–86, everything else GT3 — the SRA leagues run GT3, and the cron overwrites
-- with the true source carGroup on its next run anyway), enforces NOT NULL, and
-- rebuilds the PK + index to the shape the code expects. Idempotent.

-- ── 1. Add the column ─────────────────────────────────────────────────────────
ALTER TABLE acc_hotlap_leaderboard
  ADD COLUMN IF NOT EXISTS car_group text;

-- ── 2. Backfill existing rows ─────────────────────────────────────────────────
UPDATE acc_hotlap_leaderboard
SET car_group = CASE
  WHEN car_model_id BETWEEN 50 AND 61 THEN 'GT4'
  WHEN car_model_id BETWEEN 80 AND 86 THEN 'GT2'
  ELSE 'GT3'
END
WHERE car_group IS NULL;

-- ── 3. Enforce NOT NULL ───────────────────────────────────────────────────────
ALTER TABLE acc_hotlap_leaderboard
  ALTER COLUMN car_group SET NOT NULL;

-- ── 4. De-duplicate before adding the unique PK ───────────────────────────────
-- The table had no unique constraint, so it accumulated multiple rows for the
-- same (track_key, car_group, steam_id). Keep each driver's fastest lap in the
-- group (lowest best_lap_ms; ties broken by ctid) and drop the rest.
DELETE FROM acc_hotlap_leaderboard a
USING acc_hotlap_leaderboard b
WHERE a.track_key = b.track_key
  AND a.car_group = b.car_group
  AND a.steam_id  = b.steam_id
  AND (
    a.best_lap_ms > b.best_lap_ms
    OR (a.best_lap_ms = b.best_lap_ms AND a.ctid > b.ctid)
  );

-- ── 5. Rebuild the primary key to (track_key, car_group, steam_id) ────────────
-- Drop whatever PK exists (the old table may have had none), then add the one
-- the code and 20260720 migration expect.
DO $$
DECLARE pk_name text;
BEGIN
  SELECT conname INTO pk_name
  FROM   pg_constraint
  WHERE  conrelid = 'acc_hotlap_leaderboard'::regclass AND contype = 'p';

  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE acc_hotlap_leaderboard DROP CONSTRAINT %I', pk_name);
  END IF;

  ALTER TABLE acc_hotlap_leaderboard
    ADD PRIMARY KEY (track_key, car_group, steam_id);
END $$;

-- ── 6. Ranking index (matches the 20260720 migration) ─────────────────────────
CREATE INDEX IF NOT EXISTS acc_hotlap_leaderboard_track_class_rank_idx
  ON acc_hotlap_leaderboard (track_key, car_group, best_lap_ms ASC);
