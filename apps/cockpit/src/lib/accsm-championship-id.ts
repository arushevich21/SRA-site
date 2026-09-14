// Parsing an ACCSM championship identifier out of whatever an admin pastes.
//
// What they actually have in hand is the browser URL of the championship they
// just created in the ACSM web UI:
//
//   https://accsm1.simracingalliance.com/championship/66ec4e93-75b4-498c-bd66-8d66267af36c
//
// Requiring a hand-trimmed bare GUID makes a mis-trim fail SILENTLY and late —
// a truncated or whitespace-padded id matches no Emperor championship and no
// acc_race_sessions row, so the symptom is an empty standings page days later,
// with nothing pointing back at the typo. Accepting the URL removes the step
// where that mistake is possible.
//
// Deliberately strict about what it accepts once extracted: the value has to
// be a syntactically valid UUID. Anything else is rejected by name at save
// time rather than stored — see saveChampionship's validation.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The last path segment of an ACSM championship URL, with an optional trailing
// slash, query string or fragment. Anchored on `/championship/` specifically
// rather than "last segment of any URL" so a results or leaderboard URL from
// the same host doesn't quietly yield some other entity's id.
const CHAMPIONSHIP_URL_RE = /\/championship\/([0-9a-f-]+)(?:[/?#]|$)/i;

/**
 * Normalizes a pasted ACSM championship reference to a bare lowercase GUID.
 * Accepts a full championship URL or the GUID on its own, with surrounding
 * whitespace. Returns null for anything that isn't one of those — callers
 * report that as an error rather than storing it.
 */
export function parseAccsmChampionshipId(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  const fromUrl = trimmed.match(CHAMPIONSHIP_URL_RE)?.[1];
  const candidate = fromUrl ?? trimmed;

  return UUID_RE.test(candidate) ? candidate.toLowerCase() : null;
}
