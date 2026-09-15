-- Per-division start times for a round.
--
-- ── Why ──────────────────────────────────────────────────────────────────
--
-- championship_rounds carries ONE starts_at. That is correct for every series
-- we had until now, where a round is one race at one time. The GT3 Team Series
-- S19 is not: divisions 1 & 3 race Tuesday night, divisions 2 & 4 race
-- Wednesday night. Round 1 therefore happens at two different instants, and
-- the existing column can only hold one of them.
--
-- The workarounds both lie. Storing the Tuesday date alone tells half the grid
-- the wrong night. Storing the two dates as free text in race_days (which is
-- what the current row does — race_days = 'Tuesdays') renders fine but is
-- invisible to every date-aware code path: "next round" calculations, the
-- calendar sort, the results matcher's date window.
--
-- ── Shape ────────────────────────────────────────────────────────────────
--
-- An OVERRIDE table, not a replacement. championship_rounds.starts_at stays
-- the round's canonical time and remains the answer for every single-night
-- series; a row here says "for THIS division, this round starts then instead".
-- That means:
--   * every existing round and every existing read path is untouched,
--   * a series that later stops splitting nights just has no override rows,
--   * and a division with no row is not a missing date — it's the default.
--
-- Deliberately NOT a nullable second column on championship_rounds (which
-- would hard-code exactly two groups and say nothing about which divisions are
-- in each), and not jsonb (which would take the division_id FK away and let a
-- typo'd key sit there silently).
--
-- starts_at is text, matching championship_rounds.starts_at: these are naked
-- ISO datetimes meaning Eastern wall-clock time, interpreted DST-aware by
-- lib/event-time.ts. A timestamptz here would disagree with the column it
-- overrides — worse than the inherited imprecision.

BEGIN;

CREATE TABLE public.championship_round_division_times (
  championship_round_id uuid NOT NULL
    REFERENCES public.championship_rounds (id) ON DELETE CASCADE,

  division_id integer NOT NULL REFERENCES public.divisions (id),

  -- Naked ISO datetime = Eastern wall-clock, same convention as
  -- championship_rounds.starts_at. NOT NULL: a row whose whole purpose is to
  -- carry an override time must carry one — "no override" is expressed by the
  -- absence of the row, and a NULL here would be a third, ambiguous state.
  starts_at text NOT NULL,

  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,

  -- One time per division per round. Two rows would make "when does D2 race?"
  -- ambiguous, and whichever the query happened to return first would win.
  PRIMARY KEY (championship_round_id, division_id)
);

-- The read is always "every division time for this round", which the PK's
-- leading column already serves. No second index.

CREATE TRIGGER championship_round_division_times_updated_at
  BEFORE UPDATE ON public.championship_round_division_times
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Public content: the calendar and championship pages render these. Same
-- posture as championship_rounds itself — readable by anyone, writable only by
-- the service role (the admin event form).
ALTER TABLE public.championship_round_division_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY championship_round_division_times_public_read
  ON public.championship_round_division_times
  FOR SELECT
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE public.championship_round_division_times IS
  'Per-division start time overrides for a round. A division with no row here '
  'races at championship_rounds.starts_at. Exists for split-night series like '
  'the GT3 Team Series (D1/D3 Tuesday, D2/D4 Wednesday).';

COMMIT;
