-- Migration: auth-identity foundation
-- Run in Supabase SQL editor (Settings → SQL Editor).
-- Safe to run against the live drivers table: checks for existing conflicts first.

-- ── 1. Safety checks — surface problems before touching schema ────────────────

DO $$
DECLARE
  dup_count   integer;
  dup_info    text;
  null_count  integer;
BEGIN
  -- Duplicate discord_ids
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT discord_id
    FROM   drivers
    WHERE  discord_id IS NOT NULL
    GROUP  BY discord_id
    HAVING COUNT(*) > 1
  ) sub;

  IF dup_count > 0 THEN
    SELECT string_agg(discord_id || ' (' || cnt::text || ' rows)', ', ')
    INTO   dup_info
    FROM (
      SELECT discord_id, COUNT(*) AS cnt
      FROM   drivers
      WHERE  discord_id IS NOT NULL
      GROUP  BY discord_id
      HAVING COUNT(*) > 1
    ) sub;
    RAISE EXCEPTION
      'BLOCKED: cannot add UNIQUE(discord_id) — % duplicate discord_id(s) found: %',
      dup_count, dup_info;
  END IF;

  -- Null discord_ids (allowed in schema, just surfacing the count)
  SELECT COUNT(*) INTO null_count
  FROM drivers WHERE discord_id IS NULL;

  IF null_count > 0 THEN
    RAISE NOTICE '% row(s) have NULL discord_id — they will be excluded from the unique constraint (NULLs are never equal in SQL UNIQUE)', null_count;
  END IF;
END $$;

-- ── 2. Add missing columns ────────────────────────────────────────────────────

-- user_id: nullable FK to auth.users (seeded rows are unclaimed until login)
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- avatar_url: Discord CDN URL, populated on sign-in
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Timestamps
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ── 3. UNIQUE constraint on discord_id ───────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conrelid = 'drivers'::regclass
      AND  contype  = 'u'
      AND  conname  = 'drivers_discord_id_key'
  ) THEN
    ALTER TABLE drivers ADD CONSTRAINT drivers_discord_id_key UNIQUE (discord_id);
  END IF;
END $$;

-- ── 4. updated_at auto-trigger ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS drivers_updated_at ON drivers;
CREATE TRIGGER drivers_updated_at
  BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 5. RLS policies ───────────────────────────────────────────────────────────

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Drop any stale policies first (idempotent)
DROP POLICY IF EXISTS "drivers_select_own" ON drivers;
DROP POLICY IF EXISTS "drivers_insert_own" ON drivers;
DROP POLICY IF EXISTS "drivers_update_own" ON drivers;

-- Users can read their own row
CREATE POLICY "drivers_select_own" ON drivers
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own row (newcomer path — callback uses service-role,
-- but this covers any future client-side flow)
CREATE POLICY "drivers_insert_own" ON drivers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own row (steam_id linking, etc.)
CREATE POLICY "drivers_update_own" ON drivers
  FOR UPDATE USING (auth.uid() = user_id);

-- No DELETE policy. Service-role bypasses all RLS for admin ops.
