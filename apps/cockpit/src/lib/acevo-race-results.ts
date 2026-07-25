import { EmperorClient } from '@sra/emperor-client';
import { parseAcEvoSession } from '@sra/domain';
import type { AcEvoSessionResult, AcEvoSessionType } from '@sra/shared-types';
import { EMPEROR_ACEVO_BASE_URL } from './emperor';

const FETCH_TIMEOUT_MS = 15000;
// Newest-first pages (confirmed in scripts/check-emperor-page-order.ts). A
// handful of rounds only ever needs a few pages back to find each race, so
// cap the scan rather than walking the full archive.
const MAX_PAGES_SCANNED = 6;

// Emperor's real sustained limit is tight (~2 req/min) — a page scan alone
// can burn most of that, so a 429 here is expected occasionally rather than
// exceptional. Mirrors scripts/backfill-acc-results.ts's retry pattern.
const RETRY_ON_429 = 2;
const RETRY_BACKOFF_MS = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry429<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err instanceof Error && err.message.includes('429');
      if (!is429 || attempt >= RETRY_ON_429) throw err;
      await sleep(RETRY_BACKOFF_MS);
    }
  }
}

export type AcEvoSessionFetchResult =
  | { ok: true; data: AcEvoSessionResult | null }
  | { ok: false; error: string };

// Finds and parses the most recent completed session of the given type for a
// given Emperor track key. Results come back in finishing order via
// driver_standings — see parseAcEvoSession / CLAUDE.md ("lap-count-first").
//
// Callers should fetch one session type at a time, on demand (e.g. only when
// its tab is selected) rather than eagerly fetching every type up front —
// each call here can already cost up to MAX_PAGES_SCANNED requests, and
// Emperor's real-world rate limit doesn't tolerate stacking several of these
// back to back.
async function getAcEvoSessionResult(
  trackKey: string,
  sessionType: AcEvoSessionType,
): Promise<AcEvoSessionFetchResult> {
  const client = new EmperorClient(EMPEROR_ACEVO_BASE_URL, { minRequestIntervalMs: 1500 });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Emperor request timed out')), FETCH_TIMEOUT_MS),
  );

  try {
    const data = await Promise.race([
      fetchLatestSession(client, trackKey, sessionType),
      timeout,
    ]);
    return { ok: true, data };
  } catch (err) {
    console.error(`AC Evo ${sessionType} result fetch failed for "${trackKey}":`, err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

async function fetchLatestSession(
  client: EmperorClient,
  trackKey: string,
  sessionType: AcEvoSessionType,
): Promise<AcEvoSessionResult | null> {
  let page = 0;
  let numPages = 1;

  while (page < numPages && page < MAX_PAGES_SCANNED) {
    const result = await withRetry429(() => client.getResultsList(page));
    numPages = result.numPages;

    const match = result.entries.find(
      (e) => e.track === trackKey && e.sessionType === sessionType,
    );
    if (match) {
      const raw = await withRetry429(() => client.downloadResult(match.resultsJsonUrl));
      return parseAcEvoSession(raw);
    }

    page += 1;
  }

  return null;
}

export function getAcEvoRaceResult(trackKey: string): Promise<AcEvoSessionFetchResult> {
  return getAcEvoSessionResult(trackKey, 'Race');
}

export function getAcEvoQualifyResult(trackKey: string): Promise<AcEvoSessionFetchResult> {
  return getAcEvoSessionResult(trackKey, 'Qualify');
}
