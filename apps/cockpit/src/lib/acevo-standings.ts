import { EmperorClient } from '@sra/emperor-client';
import type { EmperorChampionshipStandings } from '@sra/shared-types';
import { EMPEROR_ACEVO_BASE_URL } from './emperor';

const FETCH_TIMEOUT_MS = 8000;

export type AcEvoStandingsResult =
  | { ok: true; data: EmperorChampionshipStandings }
  | { ok: false; error: string };

export async function getAcEvoStandings(championshipId: string): Promise<AcEvoStandingsResult> {
  const client = new EmperorClient(EMPEROR_ACEVO_BASE_URL);
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Emperor request timed out')), FETCH_TIMEOUT_MS),
  );

  try {
    const data = await Promise.race([client.getChampionshipStandings(championshipId), timeout]);
    return { ok: true, data };
  } catch (err) {
    console.error('AC Evo standings fetch failed:', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
