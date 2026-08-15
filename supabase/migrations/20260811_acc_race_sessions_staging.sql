-- Migration: staging table for the historical ACC results backfill
-- (scripts/backfill-acc-sessions.ts, driven by accsm_survey_manifest).
-- Same shape as acc_race_sessions but kept separate on purpose: the backfill
-- writes here, never to acc_race_sessions directly, so it can never collide
-- with or corrupt what the live cron (hotlaps.ts) is producing. Promoting
-- staged rows into acc_race_sessions is a deliberate later step, not part of
-- this migration or the backfill script.
-- Safe to re-run: all schema changes are idempotent.

CREATE TABLE IF NOT EXISTS acc_race_sessions_staging (
  session_key     text        PRIMARY KEY,
  event_key       text        NOT NULL,
  session_type    text        NOT NULL,      -- 'Practice' | 'Qualify' | 'Race'
  track_key       text        NOT NULL REFERENCES acc_tracks(track_key),
  server_name     text,
  session_date    timestamptz NOT NULL,
  session_file    text,
  meta_data       text,
  championship_id text,
  season_id       text,
  is_wet_session  boolean     NOT NULL DEFAULT false,
  best_lap_ms     integer,
  results         jsonb       NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS acc_race_sessions_staging_event_key_idx
  ON acc_race_sessions_staging (event_key, session_type);

CREATE INDEX IF NOT EXISTS acc_race_sessions_staging_session_date_idx
  ON acc_race_sessions_staging (session_date DESC);

-- set_updated_at() already exists, defined in 20260707_auth_identity.sql.
DROP TRIGGER IF EXISTS acc_race_sessions_staging_set_updated_at ON acc_race_sessions_staging;
CREATE TRIGGER acc_race_sessions_staging_set_updated_at
  BEFORE UPDATE ON acc_race_sessions_staging
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE acc_race_sessions_staging ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'acc_race_sessions_staging' AND policyname = 'acc_race_sessions_staging_select_all'
  ) THEN
    CREATE POLICY "acc_race_sessions_staging_select_all" ON acc_race_sessions_staging FOR SELECT USING (true);
  END IF;
END $$;
