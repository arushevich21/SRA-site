-- Migration: allow #1 for the D1 champion + preserve their permanent number.
-- Run in Supabase SQL editor. Safe to re-run.
--
-- Rule: the reigning Division 1 champion runs #1. Their permanent number is
-- held in prior_driver_number and restored when they lose the title. The held
-- number stays reserved (the registry treats it as taken) so it's guaranteed
-- for their return.

-- ── 1. Relax the range constraint to 1..999 (was 2..999) ─────────────────────
-- Captures the previously out-of-band drivers_number_range constraint in a
-- migration, and widens it to admit #1. Users still can't self-pick 1 — that's
-- enforced in the UI (app/numbers); the DB just has to permit it.

ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_number_range;
ALTER TABLE drivers
  ADD CONSTRAINT drivers_number_range
  CHECK (driver_number IS NULL OR driver_number BETWEEN 1 AND 999);

-- ── 2. prior_driver_number: the permanent number to restore ──────────────────
-- Only set while driver_number = 1 (i.e. this driver currently holds #1). A
-- real race number, so 2..999.

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS prior_driver_number integer;

ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_prior_number_range;
ALTER TABLE drivers
  ADD CONSTRAINT drivers_prior_number_range
  CHECK (prior_driver_number IS NULL OR prior_driver_number BETWEEN 2 AND 999);

-- ── 3. Assign #1 to the current D1 champion, preserving their number ─────────
-- Anton Rushevich currently holds 81; take #1 and hold 81 for the return.

UPDATE drivers
SET    driver_number = 1,
       prior_driver_number = 81
WHERE  discord_id = '248210073569067008';  -- Anton Rushevich (D1 champion) gitleaks:allow
