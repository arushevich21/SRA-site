-- The division -> ACCSM championship mapping the entrylist sync needs.
--
-- ── Why this table exists ────────────────────────────────────────────────
--
-- SRA-Bot's entrylist_push resolves an ACCSM championship GUID and then does
--
--   registrations.select(...).eq("championship_key", <that GUID>)
--
-- but registrations.championship_key holds the cockpit SLUG ('acc-gt3-s19'),
-- enforced by 20260820_register_entry_validate_championship_key.sql. So that
-- query has always returned zero rows. It fails silently rather than loudly:
-- an empty roster hits push_entrylist()'s "unmanaged championship, don't wipe
-- a live grid" guard, the job is marked done, and nothing is ever written.
-- Green queue, empty entrylists.
--
-- The slug is the correct thing for registrations to hold: ONE registration_key
-- maps to N ACCSM championships (GT3 S19 is four, one per division), so a GUID
-- in that column would fork one championship's entries across four keys and
-- collapse cockpit's entry list — which is exactly the incident 20260820b had
-- to back out. The missing piece was never a different column value; it was
-- this mapping, which had no home in either repo.
--
-- Direction of use: GUID -> (registration_key, division_id). The bot gets a
-- GUID from its own config and needs to know which registrations belong in it.
-- Hence emperor_championship_id is the PRIMARY KEY, not a plain column.
--
-- ── Why not more championships rows ──────────────────────────────────────
--
-- The considered alternative was creating real championships rows for GT3
-- divisions 2-4 so each could carry its own emperor_championship_id. Rejected:
-- they'd need teaser_only/hidden flags to stay out of the public championship
-- list, they'd each need a registration_key that must NOT be registered
-- against, and every cockpit read path would have to learn to collapse four
-- rows back into one championship. A championship is one row; where its
-- divisions are hosted is a separate fact.
--
-- ── Integrity ────────────────────────────────────────────────────────────
--
-- registration_key gets a real FK, which requires a unique index on
-- championships.registration_key first. That index is independently correct:
-- two championships sharing a registration_key would already break
-- register_entry()'s `SELECT ... WHERE registration_key = ... LIMIT 1` (it
-- would silently pick one at random for the max_registrations cap).
--
-- The index is deliberately NOT partial. An earlier draft wrote
-- `WHERE registration_key IS NOT NULL`, which Postgres refuses to accept as
-- an FK target:
--
--   42830: there is no unique constraint matching given keys for referenced
--          table "championships"
--
-- A referenced key must be covered by a NON-partial unique index — a partial
-- one can't prove uniqueness across the whole table. Dropping the predicate
-- costs nothing here: a plain unique index treats NULLs as distinct
-- (NULLS DISTINCT is the default), so the many championships with no
-- registration_key at all remain perfectly legal, and only duplicate
-- NON-null keys are rejected. That is exactly the rule we wanted.
--
-- Verified safe before writing: exactly two non-null registration_keys exist
-- today ('acc-gt3-s19', 'gt3-liaw'), already distinct.

BEGIN;

-- Clean up the partial index if a previous attempt at this migration created
-- it before failing on the FK. Harmless when it was never created.
DROP INDEX IF EXISTS public.championships_registration_key_unique;

-- Prerequisite for the FK below, and a correctness fix in its own right.
CREATE UNIQUE INDEX championships_registration_key_unique
  ON public.championships (registration_key);

CREATE TABLE IF NOT EXISTS public.championship_accsm_targets (
  -- The ACCSM championship GUID, as it appears in
  -- https://accsm{N}.simracingalliance.com/championship/{guid}. PK because
  -- guid -> (key, division) is the only lookup direction anything needs, and
  -- because one ACCSM championship must never serve two divisions.
  emperor_championship_id uuid PRIMARY KEY,

  -- Matches registrations.championship_key / championships.registration_key.
  registration_key text NOT NULL
    REFERENCES public.championships (registration_key)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  -- Which division's entries belong in this ACCSM championship. NOT NULL:
  -- a target that doesn't name a division can't be filtered on, and pushing
  -- an unfiltered roster would put every division on one grid.
  division_id integer NOT NULL REFERENCES public.divisions (id),

  -- Which accsm{N} host serves it. The bot can already derive this from its
  -- own config URL, but storing it means this table alone is enough to
  -- describe a target, and it documents intent for whoever reads it next.
  accsm_server_id integer NOT NULL,

  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,

  -- The reverse direction must also be unambiguous: one division of one
  -- championship cannot be hosted by two ACCSM championships, or a push
  -- would race two files against the same roster.
  CONSTRAINT championship_accsm_targets_key_division_unique
    UNIQUE (registration_key, division_id)
);

-- ON UPDATE CASCADE above is deliberate: an admin retyping registration_key
-- in EventForm.tsx would otherwise orphan these targets the same way
-- 20260820's header warns it orphans registrations.

CREATE TRIGGER championship_accsm_targets_updated_at
  BEFORE UPDATE ON public.championship_accsm_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Same posture as bot_jobs: RLS on, no policies. Only the service role (the
-- bot, and cockpit's admin client) touches this. It is operational wiring,
-- not public content — nothing anon or authenticated should read or write it.
ALTER TABLE public.championship_accsm_targets ENABLE ROW LEVEL SECURITY;

-- ── Seed: only mappings confirmed from data, not inferred ────────────────
--
-- gt3-liaw       -> 3c84e414-... : championships.emperor_championship_id on
--                   the gt3-liaw row; single-division event, so division 1.
-- acc-gt3-s19 D1 -> 66ec4e93-... : championships.emperor_championship_id on
--                   the 'SRA GT3 Team Series - Division 1' row.
--
-- DELIBERATELY NOT SEEDED — GT3 divisions 2, 3 and 4. Three more GUIDs are
-- live (221a8d4c-..., f8c23b7e-..., a81898a5-..., all seen in bot_jobs
-- entrylist_push payloads), but NOTHING in this database records which
-- division each one is. Guessing would send a division's grid to the wrong
-- ACCSM championship — worse than not syncing. The mapping is readable from
-- the bot host's config/gt3_series_config.json division URLs; add them with
-- the INSERT in this file's trailing comment once confirmed. Until then the
-- bot skips unmapped GUIDs loudly rather than pushing an unfiltered roster.
--
-- accsm_server_id 1 for both: accsm1.simracingalliance.com.
INSERT INTO public.championship_accsm_targets
  (emperor_championship_id, registration_key, division_id, accsm_server_id)
VALUES
  ('3c84e414-4cc7-4b04-bd50-2ddbed15191f', 'gt3-liaw',    1, 1), -- gitleaks:allow (ACCSM championship GUID, not a secret)
  ('66ec4e93-75b4-498c-bd66-8d66267af36c', 'acc-gt3-s19', 1, 1)  -- gitleaks:allow (ACCSM championship GUID, not a secret)
ON CONFLICT (emperor_championship_id) DO NOTHING;

COMMIT;

-- ── To add GT3 divisions 2-4 once their GUIDs are confirmed ──────────────
--
-- Read config/gt3_series_config.json on the bot host; each division's `url`
-- is https://accsm{N}.simracingalliance.com/championship/{guid}. Then:
--
--   INSERT INTO public.championship_accsm_targets
--     (emperor_championship_id, registration_key, division_id, accsm_server_id)
--   VALUES
--     ('<guid for D2>', 'acc-gt3-s19', 2, <N>),
--     ('<guid for D3>', 'acc-gt3-s19', 3, <N>),
--     ('<guid for D4>', 'acc-gt3-s19', 4, <N>);
--
-- Division 4 already has a confirmed registration waiting
-- (abeb00ee-16fa-4775-96a6-e0bdc53ff241), so it will sync as soon as its
-- target row exists.
