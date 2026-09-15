-- Series-level race nights: which divisions race on the round date, and which
-- race an offset from it.
--
-- ── Why ──────────────────────────────────────────────────────────────────
--
-- 20260914b added championship_round_division_times, which records WHEN each
-- division races each round. It is the right runtime shape — the site reads it
-- through roundStartsAtForDivision() — but it is a terrible authoring shape:
-- the GT3 Team Series is 8 rounds x 2 offset divisions = 16 rows an admin
-- would have to type by hand and keep consistent. They were seeded by script,
-- which is not a thing an admin can repeat.
--
-- The underlying fact is far smaller and never varies round to round:
-- divisions 1 and 3 race the round date, divisions 2 and 4 race the next day.
-- That is ONE rule per division, not one row per division per round.
--
-- ── Authoring input, not a second runtime source ─────────────────────────
--
-- This table is deliberately NOT read at render time. Saving a championship
-- regenerates championship_round_division_times from it, and the site keeps
-- reading only that. Two sources of truth for "when does D2 race round 3"
-- would eventually disagree, and the disagreement would surface as a division
-- shown the wrong night — the exact bug 20260914b exists to prevent.
--
-- So: this is the rule an admin types; that table is what the rule produces.
--
-- ── Why not a "duplicate round" button ───────────────────────────────────
--
-- The obvious-looking feature (duplicate round 1 for the Wednesday) is wrong.
-- Rounds are what standings and points are keyed on, and D1's Silverstone and
-- D2's Silverstone are the SAME round of the championship run on two nights.
-- Duplicating would give 16 rounds, split the points table in half, and make
-- "Round 3" ambiguous. One round, two nights.

BEGIN;

CREATE TABLE public.championship_division_nights (
  championship_id uuid NOT NULL
    REFERENCES public.championships (id) ON DELETE CASCADE,

  division_id integer NOT NULL REFERENCES public.divisions (id),

  -- Days after the round's own date that this division races. 0 = the round
  -- date itself. A division with NO row here is also "the round date" — the
  -- row is only needed to say "later than that", so a single-night series
  -- needs no rows at all.
  day_offset integer NOT NULL,

  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,

  -- One rule per division per championship. Two would make "which night does
  -- D2 race" ambiguous, and whichever the query returned first would win.
  PRIMARY KEY (championship_id, division_id),

  -- A week is the outer bound for "this round runs across several nights".
  -- Anything larger is a different round, not a later night of this one, and
  -- is far more likely a typo that would silently move a division's whole
  -- season.
  CONSTRAINT championship_division_nights_offset_range
    CHECK (day_offset >= 0 AND day_offset <= 6)
);

CREATE TRIGGER championship_division_nights_updated_at
  BEFORE UPDATE ON public.championship_division_nights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Authoring configuration, read only by the admin form via the service role.
-- Same posture as championship_accsm_targets: RLS on, no policies. The public
-- site never reads this — it reads the rows this generates.
ALTER TABLE public.championship_division_nights ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.championship_division_nights IS
  'Series-level race-night rule: days after a round''s own date that each '
  'division races. Authoring input for championship_round_division_times, '
  'which is regenerated from this on save and is what the site actually '
  'reads. A division with no row races on the round date.';

-- Backfill from the rows already seeded for S19, so the admin form opens
-- showing the rule that is actually in effect rather than an empty screen that
-- would wipe those times on the next save.
--
-- Derived from the data rather than hardcoded: reads the existing per-round
-- times, takes the day difference against each round's own date, and keeps it
-- only where every round agrees — a championship whose divisions already vary
-- round to round has no single rule and must not be given a fabricated one.
INSERT INTO public.championship_division_nights (championship_id, division_id, day_offset)
SELECT r.championship_id,
       t.division_id,
       min(
         (substring(t.starts_at from 1 for 10))::date
         - (substring(r.starts_at from 1 for 10))::date
       ) AS day_offset
  FROM public.championship_round_division_times t
  JOIN public.championship_rounds r ON r.id = t.championship_round_id
 WHERE r.starts_at IS NOT NULL
 GROUP BY r.championship_id, t.division_id
HAVING min(
         (substring(t.starts_at from 1 for 10))::date
         - (substring(r.starts_at from 1 for 10))::date
       )
     = max(
         (substring(t.starts_at from 1 for 10))::date
         - (substring(r.starts_at from 1 for 10))::date
       )
ON CONFLICT (championship_id, division_id) DO NOTHING;

COMMIT;
