-- Migration: verified Steam identity
-- Run in Supabase SQL editor (Settings → SQL Editor).
-- Adds steam_verified + a UNIQUE(steam_id) constraint. Safe to re-run.
--
-- Context: steam_id used to be a free-text field users typed themselves (see
-- profile/actions.ts, now admin-only). Real ownership is now proven via Steam
-- OpenID (auth/steam/*). Pre-seeded steam_ids remain but count as UNVERIFIED —
-- their owners are forced through Steam sign-in on next login.

-- ── 1. Safety check — surface duplicate steam_ids before adding UNIQUE ────────

DO $$
DECLARE
  dup_count integer;
  dup_info  text;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT steam_id
    FROM   drivers
    WHERE  steam_id IS NOT NULL
    GROUP  BY steam_id
    HAVING COUNT(*) > 1
  ) sub;

  IF dup_count > 0 THEN
    SELECT string_agg(steam_id || ' (' || cnt::text || ' rows)', ', ')
    INTO   dup_info
    FROM (
      SELECT steam_id, COUNT(*) AS cnt
      FROM   drivers
      WHERE  steam_id IS NOT NULL
      GROUP  BY steam_id
      HAVING COUNT(*) > 1
    ) sub;
    RAISE EXCEPTION
      'BLOCKED: cannot add UNIQUE(steam_id) — % duplicate steam_id(s) found: %',
      dup_count, dup_info;
  END IF;
END $$;

-- ── 2. Add steam_verified column ─────────────────────────────────────────────

-- false = seeded/typed value, ownership NOT proven. true = verified via Steam
-- OpenID (or set by an admin as a manual override).
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS steam_verified boolean NOT NULL DEFAULT false;

-- ── 3. UNIQUE constraint on steam_id ─────────────────────────────────────────

-- NULLs are never equal in a SQL UNIQUE, so unlinked drivers are unaffected.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE  conrelid = 'drivers'::regclass
      AND  contype  = 'u'
      AND  conname  = 'drivers_steam_id_key'
  ) THEN
    ALTER TABLE drivers ADD CONSTRAINT drivers_steam_id_key UNIQUE (steam_id);
  END IF;
END $$;
