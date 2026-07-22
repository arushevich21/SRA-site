-- Migration: shared tracks/track_layouts + parallel AC Evo hot-lap cache (v2)
--
-- Phase 1 of an expand-contract migration. Purely additive — does not touch
-- acc_tracks, acc_hotlap_leaderboard, acevo_hotlap_cache,
-- acevo_round_points_cache, or acevo_processed_sessions. Those keep serving
-- reads/writes exactly as before while the new tables are populated
-- alongside them (dual-write, see acevo-hotlaps.ts). Cut over the read side
-- once the new tables are verified, then optionally retire the old ones in
-- a later migration.
--
-- Why two tables instead of one: splash art/country/location are facts
-- about the real-world place (shared across every game and every layout of
-- that track — e.g. Nurburgring's photo is the same regardless of which sim
-- races there). The map image and layout name are facts about a specific
-- (game, layout) combination — ACC has exactly one layout per track,
-- AC Evo can have several, each with its own map.
--
-- Safe to re-run: idempotent.

-- ── 1. base tracks — one row per real-world place ─────────────────────────

CREATE TABLE IF NOT EXISTS tracks (
  base_track_key  text PRIMARY KEY,
  display_name    text NOT NULL,
  splash_art_url  text,
  country         text,   -- ISO 3166-1 alpha-2, e.g. 'de'
  location        text    -- human-readable "place, country", e.g. "Nurburg, Germany"
);

-- ── 2. per-(game, layout) — one row per leaderboard-distinct track variant ─

CREATE TABLE IF NOT EXISTS track_layouts (
  layout_key      text PRIMARY KEY,   -- buildTrackKey() output, e.g. "road-atlanta__gp"
  base_track_key  text NOT NULL REFERENCES tracks(base_track_key),
  game            text NOT NULL,      -- 'ACC' | 'AC Evo'
  layout_name     text,               -- e.g. "GP" — null where the game has no distinct layout
  display_name    text NOT NULL,      -- e.g. "Road Atlanta GP"
  map_url         text
);

CREATE INDEX IF NOT EXISTS track_layouts_base_track_idx ON track_layouts (base_track_key);
CREATE INDEX IF NOT EXISTS track_layouts_game_idx ON track_layouts (game);

-- ── 3. parallel AC Evo hot-lap cache, keyed by layout_key ─────────────────
-- Mirrors acevo_hotlap_cache/acevo_round_points_cache's shape exactly, just
-- keyed by the new composite layout_key instead of the raw track name.

CREATE TABLE IF NOT EXISTS acevo_hotlap_cache_v2 (
  layout_key        text        PRIMARY KEY REFERENCES track_layouts(layout_key),
  entries           jsonb       NOT NULL,
  last_session_date text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS acevo_round_points_cache_v2 (
  layout_key            text        PRIMARY KEY REFERENCES track_layouts(layout_key),
  race_position_points  jsonb,
  fastest_lap_steam_id  text,
  pole_steam_id         text,
  pole_lap_ms           integer,
  race_session_date     timestamptz,
  qualify_session_date  timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── 4. RLS ─────────────────────────────────────────────────────────────────
-- Public read on tracks/track_layouts/the new caches (this is public
-- leaderboard data, same posture as acc_tracks/acc_hotlap_leaderboard). No
-- write policies — only the service-role ingestion client writes, and it
-- bypasses RLS regardless.

ALTER TABLE tracks                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_layouts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE acevo_hotlap_cache_v2        ENABLE ROW LEVEL SECURITY;
ALTER TABLE acevo_round_points_cache_v2  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tracks' AND policyname = 'tracks_select_all'
  ) THEN
    CREATE POLICY "tracks_select_all" ON tracks FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'track_layouts' AND policyname = 'track_layouts_select_all'
  ) THEN
    CREATE POLICY "track_layouts_select_all" ON track_layouts FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'acevo_hotlap_cache_v2' AND policyname = 'acevo_hotlap_cache_v2_select_all'
  ) THEN
    CREATE POLICY "acevo_hotlap_cache_v2_select_all" ON acevo_hotlap_cache_v2 FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'acevo_round_points_cache_v2' AND policyname = 'acevo_round_points_cache_v2_select_all'
  ) THEN
    CREATE POLICY "acevo_round_points_cache_v2_select_all" ON acevo_round_points_cache_v2 FOR SELECT USING (true);
  END IF;
END $$;
