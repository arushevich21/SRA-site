-- Migration: Custom BoP (Balance of Performance) editor storage.
-- A single global BoP table (matching the old site's one Custom BoP page). The
-- admin editor reads/writes these; "Download bop.json" reproduces the exact
-- ACCSM upload format { id, name, date, entries:[{track,carModel,ballastKg,
-- restrictor}] }. bop_config holds the preset's stable id + name so the export
-- keeps identifying to ACCSM across downloads. Idempotent.

-- ── 1. Preset metadata (single row) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bop_config (
  id         text        PRIMARY KEY DEFAULT 'default',
  bop_id     uuid        NOT NULL DEFAULT gen_random_uuid(), -- JSON "id"
  name       text        NOT NULL DEFAULT 'Default',         -- JSON "name"
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO bop_config (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- ── 2. Per (track, car_model) ballast/restrictor entries ──────────────────────
CREATE TABLE IF NOT EXISTS bop_entries (
  track       text    NOT NULL, -- ACC track key, e.g. "spa", "nurburgring_24h"
  car_model   integer NOT NULL, -- ACC carModel id
  ballast_kg  integer NOT NULL DEFAULT 0,
  restrictor  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (track, car_model)
);

-- ── 3. RLS — admin only (service-role bypasses; no public policies) ───────────
ALTER TABLE bop_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bop_entries ENABLE ROW LEVEL SECURITY;
