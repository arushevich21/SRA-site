-- Migration: add location to acc_tracks
-- Human-readable "place, country" string (distinct from the ISO country code
-- column) for display under the track name.
-- Safe to re-run: idempotent.

ALTER TABLE acc_tracks
  ADD COLUMN IF NOT EXISTS location text;

UPDATE acc_tracks SET location = 'Nurburg, Germany' WHERE track_key = 'nurburgring';
