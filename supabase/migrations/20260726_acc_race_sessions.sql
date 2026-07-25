-- Migration: ACC full race-results storage (FP/Q/R per race event)
-- Supports apps/cockpit/src/lib/acc/race-results-store.ts, extended
-- runIncrementalRefresh() in apps/cockpit/src/lib/acc/hotlaps.ts, the new
-- /admin/results upload page, and the public /results pages.
-- Distinct from acc_hotlap_leaderboard (best-lap-per-track only) — this
-- table keeps the full per-driver classification for a single session, and
-- "race events" (FP+Q+R grouped) are derived by grouping rows by event_key
-- in application code rather than a separate events table.
-- Safe to re-run: all schema changes are idempotent.

CREATE TABLE IF NOT EXISTS acc_race_sessions (
  -- Cron path: Emperor's resultsJsonUrl (globally unique, stable).
  -- Manual admin-upload path: 'manual:' || track || ':' || session_file.
  session_key     text        PRIMARY KEY,
  -- metaDataRaw|track|date-bucket — see computeAccEventKey in packages/domain.
  event_key       text        NOT NULL,
  session_type    text        NOT NULL,      -- 'Practice' | 'Qualify' | 'Race'
  track_key       text        NOT NULL REFERENCES acc_tracks(track_key),
  server_name     text,
  session_date    timestamptz NOT NULL,
  session_file    text,
  meta_data       text,                      -- raw metaData string, verbatim
  championship_id text,
  season_id       text,
  is_wet_session  boolean     NOT NULL DEFAULT false,
  best_lap_ms     integer,
  results         jsonb       NOT NULL,       -- AccDriverResult[] (includes avgCleanLapMs)
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS acc_race_sessions_event_key_idx
  ON acc_race_sessions (event_key, session_type);

CREATE INDEX IF NOT EXISTS acc_race_sessions_session_date_idx
  ON acc_race_sessions (session_date DESC);

-- set_updated_at() already exists, defined in 20260707_auth_identity.sql.
DROP TRIGGER IF EXISTS acc_race_sessions_set_updated_at ON acc_race_sessions;
CREATE TRIGGER acc_race_sessions_set_updated_at
  BEFORE UPDATE ON acc_race_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE acc_race_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'acc_race_sessions' AND policyname = 'acc_race_sessions_select_all'
  ) THEN
    CREATE POLICY "acc_race_sessions_select_all" ON acc_race_sessions FOR SELECT USING (true);
  END IF;
END $$;
