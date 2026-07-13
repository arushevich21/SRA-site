import { EmperorClient } from '@sra/emperor-client';
import { parseAcEvoSession } from '@sra/domain';
import type { AcEvoSessionResult } from '@sra/shared-types';
import { EMPEROR_ACEVO_BASE_URL } from './emperor';

const FETCH_TIMEOUT_MS = 15000;
// Newest-first pages (confirmed in scripts/check-emperor-page-order.ts). A
// handful of rounds only ever needs a few pages back to find each race, so
// cap the scan rather than walking the full archive.
const MAX_PAGES_SCANNED = 6;

export type AcEvoRaceResultResult =
  | { ok: true; data: AcEvoSessionResult | null }
  | { ok: false; error: string };

// Finds and parses the most recent completed "Race" session for a given
// Emperor track key. Results come back in finishing order via
// driver_standings — see parseAcEvoSession / CLAUDE.md ("lap-count-first").
export async function getAcEvoRaceResult(trackKey: string): Promise<AcEvoRaceResultResult> {
  const client = new EmperorClient(EMPEROR_ACEVO_BASE_URL, { minRequestIntervalMs: 1500 });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Emperor request timed out')), FETCH_TIMEOUT_MS),
  );

  try {
    const data = await Promise.race([fetchLatestRace(client, trackKey), timeout]);
    return { ok: true, data };
  } catch (err) {
    console.error(`AC Evo race result fetch failed for "${trackKey}":`, err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

async function fetchLatestRace(
  client: EmperorClient,
  trackKey: string,
): Promise<AcEvoSessionResult | null> {
  let page = 0;
  let numPages = 1;

  while (page < numPages && page < MAX_PAGES_SCANNED) {
    const result = await client.getResultsList(page);
    numPages = result.numPages;

    const match = result.entries.find(
      (e) => e.track === trackKey && e.sessionType === 'Race',
    );
    if (match) {
      const raw = await client.downloadResult(match.resultsJsonUrl);
      return parseAcEvoSession(raw);
    }

    page += 1;
  }

  return null;
}
