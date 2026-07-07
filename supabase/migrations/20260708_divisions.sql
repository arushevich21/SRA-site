-- Migration: divisions + tier + is_admin (Step 2 — division admin)
-- Run in Supabase SQL editor after 20260707_auth_identity.sql.
-- Safe to re-run: all schema changes are idempotent.

-- ── 1. driver_tier enum ───────────────────────────────────────────────────────

DO $$
BEGIN
  CREATE TYPE driver_tier AS ENUM ('gold', 'silver');
EXCEPTION WHEN duplicate_object THEN
  NULL; -- already exists, skip
END $$;

-- ── 2. divisions lookup table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS divisions (
  id   integer PRIMARY KEY,
  name text    NOT NULL UNIQUE
);

INSERT INTO divisions (id, name) VALUES
  (1, 'Division 1'),
  (2, 'Division 2'),
  (3, 'Division 3'),
  (4, 'Division 4')
ON CONFLICT (id) DO NOTHING;

-- Public read — anyone can fetch the division list (needed for registration in Step 3)
ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'divisions' AND policyname = 'divisions_select_all'
  ) THEN
    CREATE POLICY "divisions_select_all" ON divisions FOR SELECT USING (true);
  END IF;
END $$;

-- ── 3. Add is_admin to drivers ────────────────────────────────────────────────

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ── 4. Rename existing division column for safety (keep data) ─────────────────
-- This is intentionally non-destructive. Drop division_legacy in a later
-- migration once division_id is confirmed correct on all rows.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'division'
  ) THEN
    ALTER TABLE drivers RENAME COLUMN division TO division_legacy;
  END IF;
END $$;

-- ── 5. Add division_id FK ─────────────────────────────────────────────────────

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS division_id integer REFERENCES divisions(id);

-- ── 6. Migrate existing data: division_legacy → division_id ──────────────────
-- Guarded: only runs if division_legacy column actually exists (it won't if the
-- drivers table never had a division column to begin with).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'division_legacy'
  ) THEN
    UPDATE drivers
    SET    division_id = division_legacy
    WHERE  division_legacy IS NOT NULL
      AND  division_id IS NULL;

    RAISE NOTICE 'Migrated division_legacy → division_id for % row(s)',
      (SELECT COUNT(*) FROM drivers WHERE division_id IS NOT NULL);
  ELSE
    RAISE NOTICE 'division_legacy column not present — no data to migrate (drivers table had no prior division column)';
  END IF;
END $$;

-- ── 7. Add tier column ────────────────────────────────────────────────────────

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS tier driver_tier;
