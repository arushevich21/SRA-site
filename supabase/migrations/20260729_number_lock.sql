-- Migration: settings table (for the mid-season driver-number lock).
-- Run in Supabase SQL editor. Safe to re-run.
--
-- A generic key/value settings store. First use: `numbers_locked` — when 'true',
-- non-admins cannot change their driver_number (enforced in profile/actions.ts).

CREATE TABLE IF NOT EXISTS settings (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value) VALUES ('numbers_locked', 'false')
  ON CONFLICT (key) DO NOTHING;

-- updated_at auto-trigger (reuses set_updated_at() from 20260707_auth_identity)
DROP TRIGGER IF EXISTS settings_updated_at ON settings;
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: the lock state isn't sensitive, so allow public read; writes go through
-- the service-role client (admin actions) which bypasses RLS.
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_select_all ON settings;
CREATE POLICY settings_select_all ON settings FOR SELECT USING (true);
