-- Migration: endurance entry class (Open / Silver / Bronze) for team registrations.
--
-- Team Series groups by Division 1–4 (drivers.division_id). Endurance groups by
-- an admin-assigned team CLASS (Open/Silver/Bronze), a separate axis — see
-- registration-division-vs-class. entry_class is nullable (admin sets it after
-- a team registers). division_id is relaxed to nullable because endurance teams
-- aren't gated on a Team Series division (mixed divisions are allowed there).
-- Idempotent.

ALTER TABLE team_registrations
  ADD COLUMN IF NOT EXISTS entry_class text;

ALTER TABLE team_registrations
  ALTER COLUMN division_id DROP NOT NULL;
