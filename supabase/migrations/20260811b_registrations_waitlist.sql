-- Migration: max-registrations cap + waitlist support for event registrations.
--
-- championships.max_registrations: the cap on CONFIRMED entries (cars/teams,
-- NOT drivers — an endurance entry with 3 drivers still counts once) for one
-- event's registration_key + registration_season. NULL = unlimited, which is
-- every existing event's behavior today and stays unchanged.
--
-- registrations.status / waitlist_position: a registration that comes in
-- once confirmed entries already meet the cap is stored as 'waitlisted' with
-- a position, instead of being rejected outright. Existing rows become
-- 'confirmed' via the DEFAULT below (a metadata-only backfill on PG11+, no
-- table rewrite). waitlist_position is NULL for confirmed rows, set for
-- waitlisted ones — enforced by registrations_waitlist_position_check below
-- so the two columns can't drift apart.
--
-- register_entry(): the "is there room?" check and the insert have to be one
-- atomic operation, or two people registering for the last open slot at the
-- same moment can both read "confirmed_count < max" and both get inserted as
-- confirmed, blowing past the cap. A UNIQUE/CHECK constraint can't express
-- "count of rows in this state <= N" declaratively, so this uses a Postgres
-- advisory transaction lock instead: pg_advisory_xact_lock serializes
-- concurrent calls for the SAME event (hashed from championship_key+season)
-- without taking a table-wide lock or blocking unrelated events, and
-- releases automatically when the calling transaction ends (commit or
-- rollback) — no separate unlock step, no risk of a stuck lock from a
-- crashed caller.
--
-- Idempotent (safe to re-run): every ADD COLUMN/INDEX/POLICY uses
-- IF NOT EXISTS or an existence check, constraints are guarded with DO
-- blocks (Postgres has no ADD CONSTRAINT IF NOT EXISTS), and
-- CREATE OR REPLACE FUNCTION always overwrites cleanly.

ALTER TABLE championships
  ADD COLUMN IF NOT EXISTS max_registrations integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'championships_max_registrations_positive'
  ) THEN
    ALTER TABLE championships
      ADD CONSTRAINT championships_max_registrations_positive
      CHECK (max_registrations IS NULL OR max_registrations > 0);
  END IF;
END $$;

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'registrations_status_check'
  ) THEN
    ALTER TABLE registrations
      ADD CONSTRAINT registrations_status_check
      CHECK (status IN ('confirmed', 'waitlisted'));
  END IF;
END $$;

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS waitlist_position integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'registrations_waitlist_position_check'
  ) THEN
    ALTER TABLE registrations
      ADD CONSTRAINT registrations_waitlist_position_check
      CHECK (
        (status = 'confirmed'  AND waitlist_position IS NULL) OR
        (status = 'waitlisted' AND waitlist_position IS NOT NULL)
      );
  END IF;
END $$;

-- Covers both the cap-check count query (championship_key, season, status)
-- and, as a prefix, general per-event lookups.
CREATE INDEX IF NOT EXISTS registrations_champ_season_status_idx
  ON registrations (championship_key, season, status);

-- Partial index for "waitlisted entries in position order" — small and only
-- ever scanned for the admin waitlist view.
CREATE INDEX IF NOT EXISTS registrations_waitlist_order_idx
  ON registrations (championship_key, season, waitlist_position)
  WHERE status = 'waitlisted';

-- Public read (entry roster is public) — mirrors team_reg_select_all on the
-- legacy team_registrations table. No write policies: all writes go through
-- the service-role server action / register_entry() below.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'registrations' AND policyname = 'registrations_select_all'
  ) THEN
    CREATE POLICY "registrations_select_all" ON registrations FOR SELECT USING (true);
  END IF;
END $$;

-- registrations already has an updated_at column but no trigger to maintain
-- it — add one now since register_entry()/promotion are the first writers.
DROP TRIGGER IF EXISTS registrations_updated_at ON registrations;
CREATE TRIGGER registrations_updated_at
  BEFORE UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Atomic cap-checked insert — see header comment for why this can't be a
-- plain count-then-insert from application code. SECURITY INVOKER (the
-- default — no SECURITY DEFINER) is deliberate: this is only ever called
-- with the service-role key from server-side code, which already bypasses
-- RLS, so it doesn't need the elevated privileges SECURITY DEFINER grants.
CREATE OR REPLACE FUNCTION register_entry(
  p_series           text,
  p_season           text,
  p_championship_key text,
  p_division_id      integer,
  p_team_id          uuid,
  p_car_model_id     integer,
  p_race_number      integer,
  p_entry_class      text
) RETURNS registrations
LANGUAGE plpgsql
AS $$
DECLARE
  v_max               integer;
  v_confirmed_count    integer;
  v_status             text;
  v_waitlist_position  integer;
  v_row                registrations;
BEGIN
  -- Serializes concurrent registrations for THIS event only (see migration
  -- header) — released automatically at transaction end, so a crashed or
  -- errored caller can never leave it stuck.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_championship_key || ':' || p_season, 0));

  SELECT max_registrations INTO v_max
  FROM championships
  WHERE registration_key = p_championship_key
  LIMIT 1;

  SELECT count(*) INTO v_confirmed_count
  FROM registrations
  WHERE championship_key = p_championship_key
    AND season = p_season
    AND status = 'confirmed';

  IF v_max IS NOT NULL AND v_confirmed_count >= v_max THEN
    v_status := 'waitlisted';
    SELECT coalesce(max(waitlist_position), 0) + 1 INTO v_waitlist_position
    FROM registrations
    WHERE championship_key = p_championship_key
      AND season = p_season
      AND status = 'waitlisted';
  ELSE
    v_status := 'confirmed';
    v_waitlist_position := NULL;
  END IF;

  INSERT INTO registrations (
    series, season, championship_key, division_id, team_id,
    car_model_id, race_number, entry_class, status, waitlist_position
  ) VALUES (
    p_series, p_season, p_championship_key, p_division_id, p_team_id,
    p_car_model_id, p_race_number, p_entry_class, v_status, v_waitlist_position
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
