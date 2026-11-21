-- Endurance pre-qualifying: laps driven on a dedicated pre-qual server set
-- the starting grid of a one-off endurance race.
--
-- First use: SRA Multiclass Enduro (Spa, race 2026-12-05 18:00 ET on SRAM6 /
-- accsm2). Pre-qual runs from a preset on SRAM7 = accsm1 server 3, open
-- 2026-11-21 00:00 ET until 2026-12-05 00:00 ET.
--
-- Scoring is NOT done in SQL — see packages/domain/src/acc/prequal.ts
-- (avg of 3 fastest valid laps in the registered car, missing laps = 3:00.000,
-- team = avg of driver averages, grid class by class). This stores only the
-- inputs: which server/window counts, and every valid lap from it.
--
-- Why every valid lap rather than a running top 3: the lap only counts if it
-- was set in the car the driver's entry is registered with, and that can
-- change (car swap while sign-ups are open, a withdrawal, an admin fix). With
-- the raw laps kept, the standings are always recomputed against the CURRENT
-- registrations — nothing has to be re-ingested. Volume is small (one
-- server, two weeks: low tens of thousands of rows at most).
--
-- Safe to re-run: idempotent DDL throughout.

BEGIN;

-- ── Config: one row per pre-qualified event ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.prequal_events (
  id              text        PRIMARY KEY,                 -- human key, e.g. 'enduro-spa-2026'
  championship_id uuid        NOT NULL REFERENCES public.championships (id) ON DELETE CASCADE,
  source          text        NOT NULL CHECK (source IN ('accsm1', 'accsm2')),
  server_id       integer     NOT NULL CHECK (server_id >= 0), -- Emperor /server/<N>/ on that host
  track_key       text        NOT NULL,                    -- laps at any other track are ignored
  opens_at        timestamptz NOT NULL,
  closes_at       timestamptz NOT NULL,                    -- a session must END before this to count
  laps_counted    integer     NOT NULL DEFAULT 3 CHECK (laps_counted > 0),
  no_time_ms      integer     NOT NULL DEFAULT 180000 CHECK (no_time_ms > 0),  -- 3:00.000
  -- Grid order of classes, front to back. Values are the site's class labels
  -- (championships.classes: 'GT3', 'CUP', 'GT4') — not ACC's raw car group.
  class_order     text[]      NOT NULL DEFAULT '{GT3,CUP,GT4}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (closes_at > opens_at)
);

COMMENT ON TABLE public.prequal_events IS
  'Endurance pre-qualifying windows. Laps from <source> server <server_id> at '
  '<track_key> in sessions ending inside [opens_at, closes_at) feed the grid of '
  '<championship_id>. Scoring lives in @sra/domain computePrequalStandings.';

-- ── Laps: every valid lap from an in-scope session ────────────────────────
CREATE TABLE IF NOT EXISTS public.prequal_laps (
  event_id      text        NOT NULL REFERENCES public.prequal_events (id) ON DELETE CASCADE,
  file_key      text        NOT NULL,   -- canonical ledger key, 'accsm1:server_3/261121_203000_Q'
  lap_index     integer     NOT NULL,   -- position in the file's laps[] — (file_key, lap_index) is the lap
  steam_id      text        NOT NULL,   -- S-prefixed, like every acc_* table
  car_model_id  integer     NOT NULL,
  lap_ms        integer     NOT NULL CHECK (lap_ms > 0),
  session_at    timestamptz NOT NULL,   -- session END, true UTC (file stamp is Eastern wall-clock)
  PRIMARY KEY (event_id, file_key, lap_index)
);

-- Standings read every lap of an event, grouped by driver+car.
CREATE INDEX IF NOT EXISTS prequal_laps_event_driver_idx
  ON public.prequal_laps (event_id, steam_id, car_model_id, lap_ms);

-- Service-role only, like the lap ledger: the site reads server-side.
ALTER TABLE public.prequal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prequal_laps   ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prequal_events, public.prequal_laps FROM anon, authenticated;

-- ── Read path: each driver's fastest laps per car ──────────────────────────
-- The standings only ever use a driver's top laps_counted laps in a given
-- car (plus how many they set in it), so return just those instead of
-- shipping every lap to the page — and staying clear of PostgREST's row cap.
CREATE OR REPLACE FUNCTION public.prequal_top_laps(p_event_id text)
RETURNS TABLE (steam_id text, car_model_id integer, lap_ms integer, laps_in_car bigint)
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT r.steam_id, r.car_model_id, r.lap_ms, r.laps_in_car
  FROM (
    SELECT l.steam_id, l.car_model_id, l.lap_ms,
           row_number() OVER w AS rn,
           count(*)     OVER (PARTITION BY l.steam_id, l.car_model_id) AS laps_in_car
    FROM public.prequal_laps l
    WHERE l.event_id = p_event_id
    WINDOW w AS (PARTITION BY l.steam_id, l.car_model_id ORDER BY l.lap_ms)
  ) r
  JOIN public.prequal_events e ON e.id = p_event_id
  WHERE r.rn <= e.laps_counted
$$;

REVOKE EXECUTE ON FUNCTION public.prequal_top_laps(text) FROM public, anon, authenticated;

-- ── Seed: SRA Multiclass Enduro, Spa ──────────────────────────────────────
-- 2026-11-21 00:00 EST = 05:00Z; 2026-12-05 00:00 EST = 05:00Z.
INSERT INTO public.prequal_events
  (id, championship_id, source, server_id, track_key, opens_at, closes_at)
VALUES
  ('enduro-spa-2026', 'c01cde3d-6e92-438b-91b8-0d711dc0b248', 'accsm1', 3, 'spa',
   '2026-11-21T05:00:00Z', '2026-12-05T05:00:00Z')
ON CONFLICT (id) DO NOTHING;

COMMIT;
