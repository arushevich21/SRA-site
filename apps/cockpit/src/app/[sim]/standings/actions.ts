'use server';

import { getAcEvoRaceResult, getAcEvoQualifyResult, type AcEvoSessionFetchResult } from '@/lib/acevo-race-results';
import { getDriverInfoBySteamIds, type DriverInfo } from '@/lib/driver-lookup';
import type { AcEvoSessionResult } from '@sra/shared-types';

export type RaceResultFetch =
  | { ok: true; data: AcEvoSessionResult | null; driverInfo: Record<string, DriverInfo> }
  | { ok: false; error: string };

// Division/tier badges (see DriverTierBadge.tsx) need each result row's
// driver info, keyed by steamId — fetched here rather than in
// acevo-race-results.ts so that module stays about Emperor results only.
// AcEvoResultsTabs is a client component and can't call the server-only
// driver-lookup itself, so the batch lookup rides along with the result.
async function withDriverInfo(result: AcEvoSessionFetchResult): Promise<RaceResultFetch> {
  if (!result.ok) return result;
  if (!result.data) return { ...result, driverInfo: {} };
  const steamIds = result.data.results.map((r) => r.steamId).filter(Boolean);
  return { ...result, driverInfo: Object.fromEntries(await getDriverInfoBySteamIds(steamIds)) };
}

export async function fetchAcEvoRaceResult(trackKey: string): Promise<RaceResultFetch> {
  return withDriverInfo(await getAcEvoRaceResult(trackKey));
}

export async function fetchAcEvoQualifyResult(trackKey: string): Promise<RaceResultFetch> {
  return withDriverInfo(await getAcEvoQualifyResult(trackKey));
}
