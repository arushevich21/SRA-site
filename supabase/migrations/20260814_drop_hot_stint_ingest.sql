-- Down-migration for the Hot Stint Qualifying ingest pipeline built in
-- 20260813_hot_stint_qualifying.sql. Do NOT edit that migration — it already
-- ran; this is a separate, later migration that undoes it.
--
-- Why: investigating before wiring the UI turned up that this data already
-- exists, correct, for seasons S9-S18, written by an external bot into
-- acc_hotstint_leaderboard (qualifying=true rows) and classification/
-- classification_status. Building a parallel acc-web ingest (hot_stint_laps
-- + the per-host cron) would have duplicated that pipeline for no reason and
-- eventually produced two competing sources of truth for the same board.
--
-- ALL FIVE objects from 20260813 are dropped here, not three — an earlier
-- version of this migration kept hot_stint_results/hot_stint_results_public,
-- intending to re-target them at the bot's data. That doesn't work:
-- hot_stint_results FKs to hot_stint_events, so dropping hot_stint_events
-- alone would either error (with a plain DROP) or cascade away that
-- constraint and leave hot_stint_results orphaned, with
-- hot_stint_results_public still layered on top of it — and nothing was
-- ever going to write hot_stint_results again regardless, since the bot's
-- data is read through classification_status, not this shape. The
-- public/admin column-split PATTERN is what's being kept — reimplemented as
-- a fresh view over classification_status in 20260814b, not this table.
--
-- Explicit drops in dependency order, no blanket CASCADE, so exactly what's
-- being removed is visible in this file rather than inferred from a cascade
-- log:
--   1. hot_stint_results_public (view) — depends on hot_stint_results
--   2. hot_stint_laps, hot_stint_processed_files, hot_stint_results — all FK
--      hot_stint_events
--   3. hot_stint_events (parent) — nothing left references it

drop view if exists public.hot_stint_results_public;
drop table if exists public.hot_stint_laps;
drop table if exists public.hot_stint_processed_files;
drop table if exists public.hot_stint_results;
drop table if exists public.hot_stint_events;
