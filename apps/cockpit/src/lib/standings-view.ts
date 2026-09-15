// The three axes a multi-division standings page can be sliced on, parsed out
// of the URL query.
//
// Why the URL and not client state: the division axis needs a different
// Emperor championship fetched server-side, so it cannot be a client toggle
// without shipping four payloads. Keeping the other two axes in the URL as
// well means one consistent mechanism, and every view a league admin might
// want to link into Discord ("D3 team standings") is a real shareable URL.

export type StandingsEntrant = 'drivers' | 'teams';
export type StandingsTierFilter = 'all' | 'gold' | 'silver';

export type StandingsView = {
  /** Selected division, or null to let the caller fall back to the first. */
  division: number | null;
  entrant: StandingsEntrant;
  tier: StandingsTierFilter;
};

// Next gives searchParams values as string | string[] | undefined (a repeated
// key arrives as an array). Taking the first occurrence rather than rejecting
// the array keeps a hand-edited or double-appended URL working instead of
// silently falling back to defaults.
type RawParam = string | string[] | undefined;

function first(v: RawParam): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseStandingsView(params: Record<string, RawParam>): StandingsView {
  const rawDivision = first(params.division);
  const parsedDivision = rawDivision != null ? Number(rawDivision) : NaN;

  const rawEntrant = first(params.view);
  const rawTier = first(params.tier);

  return {
    // Only a positive integer is a plausible division id. Anything else
    // (garbage, a float, a negative) falls back to null = "first division"
    // rather than 404ing — a bad query string should not break a public page.
    division:
      Number.isInteger(parsedDivision) && parsedDivision > 0 ? parsedDivision : null,
    entrant: rawEntrant === 'teams' ? 'teams' : 'drivers',
    tier: rawTier === 'gold' || rawTier === 'silver' ? rawTier : 'all',
  };
}

/**
 * Builds the href for one control, carrying the other two axes forward so
 * switching division doesn't silently reset a chosen entrant/tier view.
 *
 * Defaults are omitted from the query rather than written out, so the canonical
 * "division 1, drivers, all tiers" view is a clean URL and two paths don't
 * render the same page under different addresses.
 */
export function standingsViewHref(
  basePath: string,
  view: StandingsView,
  patch: Partial<StandingsView>,
): string {
  const next = { ...view, ...patch };
  const qs = new URLSearchParams();

  if (next.division != null) qs.set('division', String(next.division));
  if (next.entrant !== 'drivers') qs.set('view', next.entrant);
  // The tier filter reads driver classifications, which team standings carry
  // none of — so it is meaningless on the teams view and is dropped rather
  // than carried forward as a dead query param the user can't see the effect
  // of. Switching back to drivers starts from "all".
  if (next.tier !== 'all' && next.entrant === 'drivers') qs.set('tier', next.tier);

  const q = qs.toString();
  return q ? `${basePath}?${q}` : basePath;
}

/**
 * Which division a multi-division page should show, in strict precedence:
 *
 *   1. An explicit ?division= the viewer asked for — a link someone followed or
 *      a tab they clicked always wins, including over their own division. A
 *      shared "here's D3's race" link must show D3 to a D1 driver.
 *   2. The signed-in viewer's own division, when the series actually runs it.
 *   3. The first division the series runs.
 *
 * Returns null only when the series runs no divisions at all, which the caller
 * treats as "not a multi-division championship".
 *
 * `available` is the divisions this series actually runs, not 1-4: a division
 * can be absent (too few entries to field a grid), and defaulting someone to a
 * division with no championship behind it would render an empty page.
 */
export function resolveActiveDivision(
  requested: number | null,
  viewerDivision: number | null,
  available: number[],
): number | null {
  if (available.length === 0) return null;
  if (requested != null && available.includes(requested)) return requested;
  if (viewerDivision != null && available.includes(viewerDivision)) return viewerDivision;
  return available[0];
}
