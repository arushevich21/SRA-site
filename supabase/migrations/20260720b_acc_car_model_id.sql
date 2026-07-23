-- Migration: add raw numeric car_model_id to acc_hotlap_leaderboard
-- car_model (text) already stores the resolved display name (e.g. "Porsche
-- 992 GT3 R"); this adds the raw numeric ID alongside it so manufacturer
-- logos (accCarManufacturerLogoUrl in acc-constants.ts) can be looked up
-- reliably instead of parsing the name string.
-- Safe to re-run: idempotent.

ALTER TABLE acc_hotlap_leaderboard
  ADD COLUMN IF NOT EXISTS car_model_id integer;
