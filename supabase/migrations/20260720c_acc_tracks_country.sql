-- Migration: add country to acc_tracks
-- ISO 3166-1 alpha-2 code (e.g. 'de' for Nurburgring) for the track's home
-- country, for a flag icon next to the track name on the leaderboards list.
-- Safe to re-run: idempotent.

ALTER TABLE acc_tracks
  ADD COLUMN IF NOT EXISTS country text;

UPDATE acc_tracks SET country = 'de' WHERE track_key = 'nurburgring';
