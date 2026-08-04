import { EmperorClient } from '@sra/emperor-client';
import { parseAcEvoSession } from '@sra/domain';
import type { AcEvoSessionResult, AcEvoSessionType } from '@sra/shared-types';
import { EMPEROR_ACEVO_BASE_URL } from './emperor';
import { supabase } from './supabase';

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

// A completed round's results never change once posted, so this is a pure
// cache-aside read: a hit skips Emperor entirely, and only a genuine miss (no
// cached row) falls through to the live scan below. A round with no results
// yet is never written here, so it keeps getting checked until one exists —
// see supabase/migrations/20260802_acevo_race_results_cache.sql.
async function getCachedSessionResult(
  trackKey: string,
  sessionType: AcEvoSessionType,
): Promise<AcEvoSessionResult | undefined> {
  const { data, error } = await supabase
    .from('acevo_race_results_cache')
    .select('session_result')
    .eq('track_key', trackKey)
    .eq('session_type', sessionType)
    .maybeSingle();
  if (error) {
    console.error(`AC Evo results cache read failed for "${trackKey}"/${sessionType}:`, error);
    return undefined;
  }
  return (data?.session_result as AcEvoSessionResult | undefined) ?? undefined;
}

async function cacheSessionResult(
  trackKey: string,
  sessionType: AcEvoSessionType,
  result: AcEvoSessionResult,
): Promise<void> {
  const { error } = await supabase
    .from('acevo_race_results_cache')
    .upsert(
      { track_key: trackKey, session_type: sessionType, session_result: result },
      { onConflict: 'track_key,session_type' },
    );
  if (error) console.error(`AC Evo results cache write failed for "${trackKey}"/${sessionType}:`, error);
}

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
  const cached = await getCachedSessionResult(trackKey, sessionType);
  if (cached) return { ok: true, data: cached };

  const client = new EmperorClient(EMPEROR_ACEVO_BASE_URL, { minRequestIntervalMs: 1500 });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Emperor request timed out')), FETCH_TIMEOUT_MS),
  );

  try {
    const data = await Promise.race([
      fetchLatestSession(client, trackKey, sessionType),
      timeout,
    ]);
    if (data) await cacheSessionResult(trackKey, sessionType, data);
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
