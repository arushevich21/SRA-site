-- Migration: driver identity fields for the SRA-Bot integration
-- Run in Supabase SQL editor (Settings → SQL Editor). Safe to re-run.
--
-- The Discord bot (SRA-Bot) reads a richer driver profile than the site has so
-- far modelled: real name (for nickname sync), race number, and SRAlien status.
-- This adds those columns so the bot can read/write drivers directly instead of
-- the dead sra.gg API. All columns are nullable/defaulted — safe on live data.

-- ── 1. Add columns ───────────────────────────────────────────────────────────
-- (Done first so the duplicate check below can reference driver_number even on
--  the very first run.)

-- first_name / last_name: the bot builds Discord nicknames as
-- "FirstName{emoji}LastName┊Number". display_name stays the site's single-field
-- label; these are the structured pair the bot needs.
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_name  text;

-- driver_number: the league race number shown after the ┊ separator.
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS driver_number integer;

-- is_sralien: elite-driver flag; drives the SRAlien Discord role sync.
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS is_sralien boolean NOT NULL DEFAULT false;

-- ── 2. Safety check — surface duplicate driver_numbers before UNIQUE ──────────
-- (No-op on first run since the column is empty; guards re-runs after backfill.)

DO $$
DECLARE
  dup_count integer;
  dup_info  text;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT driver_number
    FROM   drivers
    WHERE  driver_number IS NOT NULL
    GROUP  BY driver_number
    HAVING COUNT(*) > 1
  ) sub;

  IF dup_count > 0 THEN
    SELECT string_agg(driver_number::text || ' (' || cnt::text || ' rows)', ', ')
    INTO   dup_info
    FROM (
      SELECT driver_number, COUNT(*) AS cnt
      FROM   drivers
      WHERE  driver_number IS NOT NULL
      GROUP  BY driver_number
      HAVING COUNT(*) > 1
    ) sub;
    RAISE EXCEPTION
      'BLOCKED: cannot add UNIQUE(driver_number) — % duplicate number(s): %',
      dup_count, dup_info;
  END IF;
END $$;

-- ── 3. UNIQUE constraint on driver_number ────────────────────────────────────

-- NULLs are never equal in SQL UNIQUE, so unnumbered drivers are unaffected.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conrelid = 'drivers'::regclass
      AND  contype  = 'u'
      AND  conname  = 'drivers_driver_number_key'
  ) THEN
    ALTER TABLE drivers
      ADD CONSTRAINT drivers_driver_number_key UNIQUE (driver_number);
  END IF;
END $$;
