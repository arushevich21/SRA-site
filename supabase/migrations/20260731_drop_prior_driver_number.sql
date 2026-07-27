-- Migration: drop prior_driver_number (superseded by is_champion).
-- Run in Supabase SQL editor. Safe to re-run.
--
-- RUN ORDER: run this ONLY AFTER the is_champion code has deployed. The old
-- (pre-is_champion) pages select prior_driver_number and would error if it's
-- dropped while they're still live. 20260730 must have run first.

ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_prior_number_range;
ALTER TABLE drivers DROP COLUMN IF EXISTS prior_driver_number;
