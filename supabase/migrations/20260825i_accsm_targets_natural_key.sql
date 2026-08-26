-- Reshapes championship_accsm_targets after review (Dae Hee, 2026-08-26).
-- Two changes, both narrowing the table to what it should actually assert.
--
-- ── 1. Primary key moves to (registration_key, division_id) ──────────────
--
-- 20260825h made emperor_championship_id the PK because that is the lookup
-- direction (the bot holds a GUID and needs the key + division). But lookup
-- direction is an index concern, not an identity one, and the GUID is the
-- wrong thing to key on: it is MUTABLE. If a championship is recreated in
-- ACCSM — remade after a misconfiguration, rebuilt for a restart — the same
-- logical thing (GT3 S19 division 1) gets a new GUID. That is an attribute
-- changing, not a new row, and a PK should not be the column that churns.
--
-- (registration_key, division_id) is the natural key: it is what the thing
-- IS, it is what a human types, and it cannot change without the row meaning
-- something different. Swapping also makes the mistake it prevents the more
-- likely one — two rows for the same division — a PK violation rather than a
-- secondary-constraint violation.
--
-- Nothing is lost in the other direction: emperor_championship_id keeps a
-- UNIQUE constraint, so it stays unambiguous AND keeps the index the bot's
-- get_accsm_target() lookup uses. Same queries, same plans.
--
-- Safe to do as a plain swap: nothing has an FK to this table, and it holds
-- one row (gt3-liaw). The acc-gt3-s19 row seeded by 20260825h was deleted
-- before this — see that migration's note; GT3 S19's live grid is managed in
-- the ACCSM UI and is not Supabase's to write yet.
--
-- ── 2. accsm_server_id is dropped ────────────────────────────────────────
--
-- It duplicated something the bot already knows, with a hand-typed value.
-- The bot does the scheduling, so its per-series configs (gt3_series_config
-- .json, mcm_series_config.json, liaw_series_config.json) are ground truth
-- for which ACCSM manager hosts which championship — it parses the server
-- number straight out of each division URL. A column a human fills in can
-- only ever drift out of agreement with that, and drift here means writing a
-- correct entrylist into the wrong manager's store.
--
-- It was added on the mistaken belief that the bot could only place GT3
-- championships (it was parsing gt3_series_config.json alone). LIAW and MCM
-- have had their own configs and loaders the whole time; the bot now scans
-- all three.
--
-- The table is left asserting exactly one thing, which is all it was ever
-- for: WHICH championships we populate from Supabase, and which division of
-- which championship each ACCSM championship corresponds to. WHERE they live
-- stays with the bot.

BEGIN;

ALTER TABLE public.championship_accsm_targets
  DROP CONSTRAINT championship_accsm_targets_pkey;

-- Was the UNIQUE that guarded this pair; it becomes the PK, so drop the
-- redundant constraint first rather than leaving two identical indexes.
ALTER TABLE public.championship_accsm_targets
  DROP CONSTRAINT championship_accsm_targets_key_division_unique;

ALTER TABLE public.championship_accsm_targets
  ADD CONSTRAINT championship_accsm_targets_pkey
  PRIMARY KEY (registration_key, division_id);

-- Keeps the GUID unambiguous and keeps get_accsm_target()'s lookup indexed.
ALTER TABLE public.championship_accsm_targets
  ADD CONSTRAINT championship_accsm_targets_emperor_championship_id_key
  UNIQUE (emperor_championship_id);

ALTER TABLE public.championship_accsm_targets
  DROP COLUMN accsm_server_id;

COMMIT;
