-- AC Evo race/qualify results are fetched live from Emperor on every request
-- (apps/cockpit/src/lib/acevo-race-results.ts) — up to 6 paginated requests,
-- each throttled to >=1.5s apart, so a single round lookup can take several
-- seconds. A completed round's results never change once posted, so this is
-- a pure cache-aside table: write on first successful fetch, read on every
-- request after. Rounds with no results yet (race hasn't happened) are never
-- written here, so they keep checking Emperor until a result exists.

CREATE TABLE IF NOT EXISTS acevo_race_results_cache (
  track_key    text NOT NULL,
  session_type text NOT NULL, -- 'Race' | 'Qualify' (AcEvoSessionType)
  session_result jsonb NOT NULL, -- the parsed AcEvoSessionResult
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (track_key, session_type)
);
