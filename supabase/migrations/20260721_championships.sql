-- Migration: championships + championship_rounds (event content moves to DB)
-- Phase 1 of the admin "create event" feature: the site's championship/event
-- content (previously the code-committed CHAMPIONSHIPS array in
-- content/championships.ts) becomes DB-backed so admins can manage it.
--
-- Shapes mirror the ChampionshipContent / ScheduleRound types 1:1 so the
-- render layer keeps consuming the same domain objects (see
-- lib/championships-store.ts, which maps rows back to ChampionshipContent).
--
-- Seed with scripts/seed-championships.ts after applying this.

-- ── 1. championships (one row per series / championship) ──────────────────────
CREATE TABLE IF NOT EXISTS championships (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    text        NOT NULL UNIQUE,
  game                    text        NOT NULL,                        -- 'ACC' | 'LMU' | 'iRacing' | 'AC Evo'
  title                   text        NOT NULL,
  class_tag               text        NOT NULL,
  format_tag              text,
  event_type              text        NOT NULL DEFAULT 'championship', -- 'championship' | 'exhibition'
  classes                 text[]      NOT NULL DEFAULT '{}',
  logo_url                text,
  race_format             text        NOT NULL DEFAULT '',
  race_days               text,
  rules_bullets           text[]      NOT NULL DEFAULT '{}',
  discord_links           jsonb       NOT NULL DEFAULT '[]'::jsonb,    -- [{label,url}]
  results_url             text,
  results_label           text,
  -- Data-source linkage (admin pastes after creating in ACSM / SimGrid; the
  -- site never writes to those systems — this only links reads back to them).
  emperor_championship_id text,
  simgrid_id              integer,
  standings_key           text,
  -- Registration (only set on championships that accept team registration)
  registration_key        text,
  registration_season     text,
  registration_open       boolean     NOT NULL DEFAULT false,
  max_team_size           integer,
  allowed_cars            text[],
  -- Display
  teaser_only             boolean     NOT NULL DEFAULT false,
  concluded               boolean     NOT NULL DEFAULT false,
  sort_order              integer     NOT NULL DEFAULT 0,              -- render order (replaces array order)
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS championships_updated_at ON championships;
CREATE TRIGGER championships_updated_at
  BEFORE UPDATE ON championships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 2. championship_rounds (one row per scheduled round) ──────────────────────
CREATE TABLE IF NOT EXISTS championship_rounds (
  id                     uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id        uuid    NOT NULL REFERENCES championships(id) ON DELETE CASCADE,
  round                  integer NOT NULL,
  track                  text    NOT NULL,                            -- display, e.g. 'COTA National'
  race_length            text    NOT NULL DEFAULT '',
  -- Eastern wall-clock ISO / date-only / NULL (=TBA) — same authoring
  -- convention as ScheduleRound.date, interpreted by lib/event-time.ts.
  starts_at              text,
  emperor_track          text,                                        -- 'TrackName,Layout' for leaderboard ?track=
  emperor_raw_track_name text,                                        -- raw track_name, hot-lap cache key
  UNIQUE (championship_id, round)
);

CREATE INDEX IF NOT EXISTS championship_rounds_championship_id_idx
  ON championship_rounds (championship_id);

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
-- Public read (all this content is public). No write policies — every write
-- goes through service-role server actions gated by requireAdmin().
ALTER TABLE championships       ENABLE ROW LEVEL SECURITY;
ALTER TABLE championship_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "championships_select_all"       ON championships;
DROP POLICY IF EXISTS "championship_rounds_select_all" ON championship_rounds;

CREATE POLICY "championships_select_all"
  ON championships FOR SELECT USING (true);

CREATE POLICY "championship_rounds_select_all"
  ON championship_rounds FOR SELECT USING (true);
