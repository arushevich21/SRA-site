-- Migration: ACC hot-lap leaderboard tables
-- Supports apps/cockpit/src/lib/acc/hotlaps.ts and the
-- /api/cron/refresh-acc-leaderboard route. Mirrors the (untracked) AC Evo
-- acevo_hotlap_cache/acevo_processed_sessions/acevo_hotlap_refresh_state
-- tables, but as normalized per-driver rows instead of a jsonb blob per
-- track, and split per car_group (GT3/GT4/etc. — ACC times aren't
-- comparable across classes).
-- Safe to re-run: all schema changes are idempotent.

-- ── 1. tracks reference table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS acc_tracks (
  track_key       text PRIMARY KEY,
  display_name    text NOT NULL,
  splash_art_url  text
);

-- ── 2. hot-lap leaderboard ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS acc_hotlap_leaderboard (
  track_key     text        NOT NULL REFERENCES acc_tracks(track_key),
  car_group     text        NOT NULL,
  steam_id      text        NOT NULL,
  driver_name   text        NOT NULL,
  car_model     text,
  best_lap_ms   integer     NOT NULL,
  sectors_ms    jsonb,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (track_key, car_group, steam_id)
);

CREATE INDEX IF NOT EXISTS acc_hotlap_leaderboard_track_class_rank_idx
  ON acc_hotlap_leaderboard (track_key, car_group, best_lap_ms ASC);

-- ── 3. processed-session registry (cron dedup cursor) ─────────────────────────

CREATE TABLE IF NOT EXISTS acc_processed_sessions (
  session_url   text        PRIMARY KEY,
  track         text        NOT NULL,
  session_type  text        NOT NULL,
  session_date  text        NOT NULL,
  processed_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 4. single-row refresh lock/staleness tracker ───────────────────────────────

CREATE TABLE IF NOT EXISTS acc_hotlap_refresh_state (
  id                  text PRIMARY KEY DEFAULT 'global',
  refresh_started_at  timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO acc_hotlap_refresh_state (id) VALUES ('global')
ON CONFLICT (id) DO NOTHING;

-- ── 5. RLS ──────────────────────────────────────────────────────────────────────
-- Public read on tracks/leaderboard (this is public leaderboard data). No
-- policies on processed_sessions/refresh_state — internal bookkeeping only;
-- the app's service-role client bypasses RLS regardless.

ALTER TABLE acc_tracks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_hotlap_leaderboard   ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_processed_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE acc_hotlap_refresh_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'acc_tracks' AND policyname = 'acc_tracks_select_all'
  ) THEN
    CREATE POLICY "acc_tracks_select_all" ON acc_tracks FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'acc_hotlap_leaderboard' AND policyname = 'acc_hotlap_leaderboard_select_all'
  ) THEN
    CREATE POLICY "acc_hotlap_leaderboard_select_all" ON acc_hotlap_leaderboard FOR SELECT USING (true);
  END IF;
END $$;
