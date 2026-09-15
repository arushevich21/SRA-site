import { EmperorClient } from '@sra/emperor-client';
import type { EmperorChampionshipStandings } from '@sra/shared-types';
import { EMPEROR_ACEVO_BASE_URL, EMPEROR_ACC_BASE_URLS } from './emperor';

const FETCH_TIMEOUT_MS = 8000;

export type EmperorStandingsResult =
  | { ok: true; data: EmperorChampionshipStandings }
  | { ok: false; error: string };

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
async function fetchFromAnyServer(
  baseUrls: string[],
  championshipId: string,
): Promise<EmperorStandingsResult> {
  try {
    const data = await Promise.any(
      baseUrls.map((baseUrl) => new EmperorClient(baseUrl).getChampionshipStandings(championshipId)),
    );
    return { ok: true, data };
  } catch (err) {
    // Every candidate failed — Promise.any rejects with an AggregateError
    // wrapping each one; surface the first for a concrete log line rather
    // than AggregateError's own unhelpful top-level message.
    const first = err instanceof AggregateError ? err.errors[0] : err;
    return { ok: false, error: first instanceof Error ? first.message : 'Unknown error' };
  }
}

async function withTimeout(
  promise: Promise<EmperorStandingsResult>,
): Promise<EmperorStandingsResult> {
  const timeout = new Promise<EmperorStandingsResult>((resolve) =>
    setTimeout(() => resolve({ ok: false, error: 'Emperor request timed out' }), FETCH_TIMEOUT_MS),
  );
  return Promise.race([promise, timeout]);
}

export async function getAcEvoStandings(championshipId: string): Promise<EmperorStandingsResult> {
  try {
    return await withTimeout(fetchFromAnyServer([EMPEROR_ACEVO_BASE_URL], championshipId));
  } catch (err) {
    console.error('AC Evo standings fetch failed:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function getAccStandings(championshipId: string): Promise<EmperorStandingsResult> {
  try {
    return await withTimeout(fetchFromAnyServer(EMPEROR_ACC_BASE_URLS, championshipId));
  } catch (err) {
    console.error('ACC standings fetch failed:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
