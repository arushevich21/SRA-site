-- Migration: driver schema cleanup — is_champion badge, division backfill, drop
-- redundant imported columns. Run in Supabase SQL editor. Safe to re-run.
--
-- RUN ORDER: this migration is safe to run BEFORE merging the is_champion code
-- (it keeps prior_driver_number so the currently-live pages don't break). After
-- the new code deploys, run 20260731_drop_prior_driver_number.sql.

-- ── 1. is_champion flag ───────────────────────────────────────────────────────
-- #1 is no longer a stored number; it's a derived badge for the reigning D1
-- champion, who keeps their own number. Defaults false (like is_admin/is_sponsor).
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS is_champion boolean NOT NULL DEFAULT false;

-- ── 2. Move the current champion off #1 back onto their real number ──────────
-- Anton Rushevich currently holds driver_number = 1 with prior_driver_number 81.
-- Restore 81 as their number and mark the champion flag. (81 was vacated to #1,
-- so it's free.) gitleaks:allow
UPDATE drivers
SET    driver_number = 81,
       is_champion = true,
       prior_driver_number = NULL
WHERE  discord_id = '248210073569067008';  -- Anton Rushevich (D1 champion) gitleaks:allow

-- ── 3. Restore driver_number range to 2..999 ─────────────────────────────────
-- #1 is never stored now, so no driver_number should be < 2. (Safe: step 2
-- cleared the only 1.)
ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_number_range;
ALTER TABLE drivers
  ADD CONSTRAINT drivers_number_range
  CHECK (driver_number IS NULL OR driver_number BETWEEN 2 AND 999);

-- ── 4. Backfill division_id + tier from the imported text columns ────────────
-- The old import populated division ('1'..'4') / division_split ('Gold'/'Silver')
-- but left the normalized division_id / tier empty, which the site + bot read.
UPDATE drivers
SET    division_id = division::integer,
       tier        = lower(division_split)::driver_tier
WHERE  division ~ '^[0-9]+$'
  AND  division::integer IN (SELECT id FROM divisions)
  AND  division_split IN ('Gold', 'Silver')
  AND  division_id IS NULL;

-- ── 5. Drop redundant imported columns ───────────────────────────────────────
-- Sparsely-populated Steam Web API profile fields (nothing on the new site uses
-- them); discord_name (superseded by display_name); and the duplicate text
-- division columns (now backfilled into division_id/tier).
ALTER TABLE drivers DROP COLUMN IF EXISTS steam_persona_name;
ALTER TABLE drivers DROP COLUMN IF EXISTS steam_real_name;
ALTER TABLE drivers DROP COLUMN IF EXISTS steam_profile_url;
ALTER TABLE drivers DROP COLUMN IF EXISTS steam_avatar_url;
ALTER TABLE drivers DROP COLUMN IF EXISTS steam_avatar_medium_url;
ALTER TABLE drivers DROP COLUMN IF EXISTS steam_avatar_full_url;
ALTER TABLE drivers DROP COLUMN IF EXISTS discord_name;
ALTER TABLE drivers DROP COLUMN IF EXISTS division;
ALTER TABLE drivers DROP COLUMN IF EXISTS division_split;

-- prior_driver_number is intentionally KEPT here — see the run-order note above.
