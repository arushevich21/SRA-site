'use server';

import { getAcEvoRaceResult } from '@/lib/acevo-race-results';
import type { AcEvoSessionResult } from '@sra/shared-types';

export type RaceResultFetch =
  | { ok: true; data: AcEvoSessionResult | null }
  | { ok: false; error: string };

export async function fetchAcEvoRaceResult(trackKey: string): Promise<RaceResultFetch> {
  return getAcEvoRaceResult(trackKey);
}
