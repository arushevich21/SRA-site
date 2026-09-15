-- Collapses the GT3 Team Series from "a championship that is Division 1" into
-- one championship that SPANS four divisions.
--
-- ── The problem ──────────────────────────────────────────────────────────
--
-- championships carries a single emperor_championship_id. The GT3 Team
-- Series runs on FOUR ACCSM championships (one per division), so that column
-- can only ever hold one of them. The row was therefore named, slugged and
-- keyed as Division 1:
--
--   slug            gt3-teamseries-s19d1
--   title           SRA GT3 Team Series - Division 1
--   registration_key acc-gt3-s19d1
--   emperor_championship_id 66ec4e93-… (D1's ACCSM championship)
--
-- That is the data model leaking into the public site: the championship list
-- shows one card per championships row, so a brand with four divisions either
-- shows up as one card mislabelled "Division 1", or as four cards once the
-- other three rows are added. Neither is what the series is.
--
-- ── The fix ──────────────────────────────────────────────────────────────
--
-- championship_accsm_targets (20260825h/i) already models this correctly:
-- (registration_key, division_id) -> ACCSM GUID, and it is already seeded
-- with all four divisions. Nothing in cockpit read it — it was built for the
-- bot's entrylist push. This migration makes the championships row describe
-- the BRAND and defers every division-specific GUID to that table, which
-- cockpit now reads too (see lib/championships-store.ts).
--
-- emperor_championship_id is set to NULL deliberately, not left as D1's GUID.
-- Leaving it would mean the series silently keeps rendering D1's standings
-- and D1's results under a page that claims to be the whole championship —
-- the exact bug being fixed, just less visible. A multi-division series has
-- no single Emperor championship, and the column should say so.
--
-- ── Safety ───────────────────────────────────────────────────────────────
--
-- registration_key is renamed, which cascades:
--   * championship_accsm_targets.registration_key — real FK with
--     ON UPDATE CASCADE (20260825h), so all four target rows follow.
--   * registrations.championship_key — NO FK (validated by register_entry()
--     against championships, see 20260820). Verified zero rows carry
--     'acc-gt3-s19d1' before writing this; the assertion below enforces that
--     rather than trusting the check to still hold at apply time.
--
-- The new key 'acc-gt3-s19' matches what the in-repo seed content
-- (content/championships.ts) has always used, so the fallback constant and
-- the DB agree again.

BEGIN;

-- Fail loudly rather than orphaning live entries. If anyone registered under
-- the old key between writing and applying this, the rename would silently
-- strand those rows (no FK to stop it) and they would vanish from the entry
-- list and the ACCSM push alike.
DO $$
DECLARE
  v_orphans integer;
BEGIN
  SELECT count(*) INTO v_orphans
  FROM public.registrations
  WHERE championship_key = 'acc-gt3-s19d1';

  IF v_orphans > 0 THEN
    RAISE EXCEPTION
      'ABORT: % registrations still carry championship_key=acc-gt3-s19d1. '
      'Rename them in the same transaction before applying this migration.',
      v_orphans;
  END IF;
END $$;

UPDATE public.championships
   SET slug                    = 'gt3-team-series-s19',
       title                   = 'GT3 Team Series — Season 19',
       registration_key        = 'acc-gt3-s19',
       emperor_championship_id = NULL
 WHERE slug = 'gt3-teamseries-s19d1';

-- Exactly one row must have moved. Zero means the slug already changed (or
-- never existed) and the four target rows below would be checked against a
-- key nothing owns; more than one is impossible (slug is unique) but asserting
-- it costs nothing.
DO $$
DECLARE
  v_champs  integer;
  v_targets integer;
BEGIN
  SELECT count(*) INTO v_champs
  FROM public.championships
  WHERE registration_key = 'acc-gt3-s19';

  IF v_champs <> 1 THEN
    RAISE EXCEPTION 'ABORT: expected exactly 1 championship with registration_key=acc-gt3-s19, found %', v_champs;
  END IF;

  -- The ON UPDATE CASCADE above should have carried all four division rows
  -- across. If it didn't, the bot would resolve GUIDs to a key that no longer
  -- exists and push nothing — silently, exactly like the failure 20260825h
  -- was written to fix.
  SELECT count(*) INTO v_targets
  FROM public.championship_accsm_targets
  WHERE registration_key = 'acc-gt3-s19';

  IF v_targets <> 4 THEN
    RAISE EXCEPTION 'ABORT: expected 4 division targets for acc-gt3-s19, found %', v_targets;
  END IF;
END $$;

COMMIT;
