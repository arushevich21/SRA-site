// Season-code normalization for ACC leaderboards.
//
// A few seasons were ingested under two codes — a base and a continuation
// (e.g. S14 and its "S14-2" second half) — but drivers think of them as one
// season. We present and query them merged under the base code: the dropdown
// shows "S14", and selecting it queries both S14 and S14-2.

// Seasons up to and including this one are finished and their boards will
// never change (the ingest only writes the current season; see SRA-Bot's
// build_accsm_config). The seasonal leaderboard routes render these once and
// cache them indefinitely instead of re-querying Supabase per request — bump
// this when a season closes. Everything newer is "live" and rendered per
// request with streamed lap data.
export const LAST_FROZEN_SEASON = 18;

export function isFrozenSeason(season: string): boolean {
  const m = season.match(/^S(\d+)(?:-\d+)?$/i);
  return m != null && Number(m[1]) <= LAST_FROZEN_SEASON;
}

// dbCode -> the canonical (display) season it belongs to.
const SEASON_MERGES: Record<string, string> = {
  'S14-2': 'S14',
};

// The season label to show for a raw ingest season code.
export function displaySeason(dbCode: string): string {
  return SEASON_MERGES[dbCode] ?? dbCode;
}

// Every ingest season code that makes up a display season — the base plus any
// merged continuations. Single-element for an unmerged season (incl. '' for the
// persistent board).
export function seasonDbCodes(display: string): string[] {
  const extras = Object.keys(SEASON_MERGES).filter((code) => SEASON_MERGES[code] === display);
  return [display, ...extras];
}

// Applies the season filter to a Supabase query: `.eq` for a lone code (an
// `.in` with the empty-string persistent code matches nothing — confirmed
// against the DB), `.in` when a display season spans multiple ingest codes.
//
// The generic Q is a plain pass-through of the caller's builder type so the
// awaited { data, error } stays fully typed — but WITHOUT a recursive
// `T extends { eq(): T }` constraint, which makes tsc choke on Supabase's
// deep builder generics ("Type instantiation is excessively deep"). The eq/in
// shape is asserted via a cast instead.
export function applySeasonFilter<Q>(query: Q, season: string): Q {
  const codes = seasonDbCodes(season);
  const q = query as { eq(c: string, v: string): Q; in(c: string, v: string[]): Q };
  return codes.length === 1 ? q.eq('season', codes[0]) : q.in('season', codes);
}
