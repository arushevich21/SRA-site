import { unstable_cache } from 'next/cache';
import { EmperorClient } from '@sra/emperor-client';
import { applyIndividualTeamDrops } from '@sra/domain';
import type { EmperorChampionshipStandings } from '@sra/shared-types';
import { EMPEROR_ACEVO_BASE_URL, EMPEROR_ACC_BASE_URLS } from './emperor';

const FETCH_TIMEOUT_MS = 8000;

// Matches the standings pages' own `revalidate`. Those pages read searchParams
// (division/view/tier) and so render dynamically no matter what that export
// says — without a cache on the fetch itself, every division tab click was a
// fresh round trip to Emperor.
const STANDINGS_TTL_S = 300;

export type EmperorStandingsResult =
  | { ok: true; data: EmperorChampionshipStandings; stale?: true }
  | { ok: false; error: string };

// ── Why this file caches at all ──────────────────────────────────────────────
//
// ACCSM rate-limits 5 requests per 20s PER IP, per host, returning a clean 429
// (Retry-After: 20). Clicking through the four division tabs used to spend 7
// requests each — one per candidate server — so a handful of clicks inside one
// 20s window ran the shared Vercel egress IP into the limit and every candidate
// failed at once. That is the "Standings temporarily unavailable" box.
//
// Three things keep it under the cap now, in order of how much they buy:
//   1. Remember which server answered for a championship and ask only that one
//      (7 requests -> 1).
//   2. Cache a successful payload for STANDINGS_TTL_S, so re-clicking a tab
//      costs nothing.
//   3. Serve the last good payload when a live fetch fails, so a single 429
//      shows slightly stale standings instead of an error panel.

// championshipId -> the base URL that last answered for it. Learned at runtime
// rather than stored: 20260825i dropped accsm_server_id from
// championship_accsm_targets precisely because a hand-typed host column drifts
// out of agreement with the bot's series configs, which do the scheduling and
// are ground truth for where a championship lives.
const knownHost = new Map<string, string>();

// championshipId -> last successful payload. Per-instance and ephemeral (a cold
// lambda starts empty), so this is a best-effort cushion for the rapid-clicking
// case, not a durability guarantee. unstable_cache above it is the real cache.
const lastGood = new Map<string, EmperorChampionshipStandings>();

// Fetches one championship's standings, trying every candidate base URL in
// parallel and resolving as soon as the first one succeeds (Promise.any,
// not allSettled — this must not wait for a slow/dead server to time out
// once a fast one has already answered). AC Evo runs on a single known
// server, so this is a one-element list there — but an ACC championship's
// emperor_championship_id lives on exactly one of 7 ACCSM instances
// (accsm1-7.simracingalliance.com) and nothing in the DB records which
// (championship_accsm_targets tracks registration_key -> division targets
// for the bot's entrylist push, not a host) — so for ACC this probes every
// server the same way the hot-lap refresh cron already does (see
// lib/acc/hotlaps.ts's runIncrementalRefresh), isolating per-server failures
// (a 404 for "wrong server" or a timeout for an idle one) rather than
// treating any one of them as authoritative.
//
// Returns the winning base URL alongside the data so the caller can skip the
// fan-out next time.
async function fetchFromAnyServer(
  baseUrls: string[],
  championshipId: string,
): Promise<{ data: EmperorChampionshipStandings; baseUrl: string }> {
  return Promise.any(
    baseUrls.map(async (baseUrl) => ({
      data: await new EmperorClient(baseUrl).getChampionshipStandings(championshipId),
      baseUrl,
    })),
  ).catch((err: unknown) => {
    // Every candidate failed — Promise.any rejects with an AggregateError
    // wrapping each one; surface the first for a concrete log line rather
    // than AggregateError's own unhelpful top-level message.
    const first = err instanceof AggregateError ? err.errors[0] : err;
    throw first instanceof Error ? first : new Error('Unknown error');
  });
}

// One live attempt: the remembered host alone, then the full fan-out if that
// host has stopped serving this championship (it moves when a championship is
// recreated in ACCSM, which is exactly why the host isn't a stored column).
async function fetchLive(
  baseUrls: string[],
  championshipId: string,
): Promise<EmperorChampionshipStandings> {
  const remembered = knownHost.get(championshipId);

  if (remembered && baseUrls.includes(remembered)) {
    try {
      return await new EmperorClient(remembered).getChampionshipStandings(championshipId);
    } catch {
      // Stale mapping or a transient failure on that one host — fall through
      // and re-learn. Costs the fan-out we were trying to avoid, but only on
      // the request that discovers the move.
      knownHost.delete(championshipId);
    }
  }

  const { data, baseUrl } = await fetchFromAnyServer(baseUrls, championshipId);
  knownHost.set(championshipId, baseUrl);
  return data;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Emperor request timed out')), FETCH_TIMEOUT_MS),
  );
  return Promise.race([promise, timeout]);
}

// Only successes reach the cache: the inner function throws on failure, and
// unstable_cache stores nothing for a rejected call. Caching an error object
// would pin the failure in place for the whole TTL — the opposite of what a
// transient 429 needs.
function cachedStandings(
  cacheKey: string,
  baseUrls: string[],
  championshipId: string,
): Promise<EmperorChampionshipStandings> {
  return unstable_cache(
    () => withTimeout(fetchLive(baseUrls, championshipId)),
    [cacheKey, championshipId],
    { revalidate: STANDINGS_TTL_S },
  )();
}

// Team totals are re-scored on the way out (applyIndividualTeamDrops):
// Emperor drops each team's worst COMBINED night, SRA drops each driver's own
// worst night. Done here, not in a page, so every consumer — standings pages
// and the stream overlay — shows the same team table. The cache keeps
// Emperor's raw payload; re-scoring is cheap arithmetic.
async function getStandings(
  cacheKey: string,
  baseUrls: string[],
  championshipId: string,
  label: string,
): Promise<EmperorStandingsResult> {
  try {
    const data = await cachedStandings(cacheKey, baseUrls, championshipId);
    lastGood.set(championshipId, data);
    return { ok: true, data: applyIndividualTeamDrops(data) };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    const fallback = lastGood.get(championshipId);
    if (fallback) {
      console.warn(`${label} standings fetch failed, serving last good payload:`, error);
      return { ok: true, data: applyIndividualTeamDrops(fallback), stale: true };
    }
    console.error(`${label} standings fetch failed:`, error);
    return { ok: false, error };
  }
}

export function getAcEvoStandings(championshipId: string): Promise<EmperorStandingsResult> {
  return getStandings('acevo-standings', [EMPEROR_ACEVO_BASE_URL], championshipId, 'AC Evo');
}

export function getAccStandings(championshipId: string): Promise<EmperorStandingsResult> {
  return getStandings('acc-standings', EMPEROR_ACC_BASE_URLS, championshipId, 'ACC');
}
