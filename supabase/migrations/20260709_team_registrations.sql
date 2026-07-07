-- Migration: team_registrations reconcile + team_members join table (Step 3)
-- Run after 20260708_divisions.sql.
-- team_registrations is confirmed empty — safe to reshape freely.

-- ── 1. Reconcile team_registrations ──────────────────────────────────────────

-- Drop old columns whose types/models we are replacing
ALTER TABLE team_registrations
  DROP COLUMN IF EXISTS division,
  DROP COLUMN IF EXISTS driver_ids;

-- Add championship reference and proper division FK
ALTER TABLE team_registrations
  ADD COLUMN IF NOT EXISTS championship_key text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS division_id      integer NOT NULL DEFAULT 0 REFERENCES divisions(id),
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

-- Remove placeholder defaults now that columns exist
ALTER TABLE team_registrations
  ALTER COLUMN championship_key DROP DEFAULT,
  ALTER COLUMN division_id      DROP DEFAULT;

-- Case-insensitive unique team name per championship+season
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'team_registrations' AND indexname = 'team_reg_name_unique'
  ) THEN
    CREATE UNIQUE INDEX team_reg_name_unique
      ON team_registrations (championship_key, season, lower(team_name));
  END IF;
END $$;

-- updated_at trigger (reuses set_updated_at() from auth migration)
DROP TRIGGER IF EXISTS team_registrations_updated_at ON team_registrations;
CREATE TRIGGER team_registrations_updated_at
  BEFORE UPDATE ON team_registrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2. team_members join table ────────────────────────────────────────────────
-- driver_id is denormalized with championship_key + season so the UNIQUE
-- constraint can enforce the one-team-per-driver-per-championship invariant
-- at the database level with no race conditions.

CREATE TABLE IF NOT EXISTS team_members (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          uuid        NOT NULL REFERENCES team_registrations(id) ON DELETE CASCADE,
  driver_id        uuid        NOT NULL REFERENCES drivers(id),
  championship_key text        NOT NULL,
  season           text        NOT NULL,
  joined_at        timestamptz NOT NULL DEFAULT now(),

  -- THE invariant: one team per driver per championship+season, enforced by DB
  UNIQUE (driver_id, championship_key, season)
);

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
-- Public read (entry roster is public). No write policies — all writes go
-- through service-role server actions.

ALTER TABLE team_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_reg_select_all"     ON team_registrations;
DROP POLICY IF EXISTS "team_members_select_all" ON team_members;

CREATE POLICY "team_reg_select_all"
  ON team_registrations FOR SELECT USING (true);

CREATE POLICY "team_members_select_all"
  ON team_members FOR SELECT USING (true);
