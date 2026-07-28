import 'server-only';
import { supabase } from './supabase';
import { stripSteamIdPrefix } from './steam-id';

export { stripSteamIdPrefix };

export type DriverTier = 'gold' | 'silver';

export type DriverInfo = {
  driverNumber: number | null;
  country: string | null;
  isSralien: boolean;
  division: number | null; // 1-4, from drivers.division_id — null if unassigned
  tier: DriverTier | null; // null if unassigned
};

const EMPTY_DRIVER_INFO: DriverInfo = {
  driverNumber: null,
  country: null,
  isSralien: false,
  division: null,
  tier: null,
};

// Batch-fetch driver_number, nationality, and division/tier/SRAlien status
// for a set of bare (no leading "S") SteamID64 strings, for enriching
// leaderboard rows with the driver's registered identity. One query per board
// render — call this once with every steamId on the board, not per-row.
//
// A lap with no matching drivers row (guest, never registered/linked) simply
// has no entry in the returned map — callers treat that the same as
// EMPTY_DRIVER_INFO (see driverInfoFor): no number, no flag, no division
// badge, never a placeholder.
export async function getDriverInfoBySteamIds(
  steamIds: Iterable<string>,
): Promise<Map<string, DriverInfo>> {
  const unique = [...new Set(steamIds)].filter(Boolean);
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from('drivers')
    .select('steam_id, driver_number, country, is_champion, is_sralien, division_id, tier')
    .in('steam_id', unique);

  if (error) {
    console.error('Driver info lookup failed:', error);
    return new Map();
  }

  return new Map(
    (data ?? []).map((r) => [
      r.steam_id as string,
      {
        // The reigning D1 champion always displays #1 on leaderboards,
        // regardless of their real registered number (which stays in
        // driver_number for standings/registration — see
        // supabase/migrations/20260730_driver_schema_cleanup.sql and
        // lib/driver-display-name.ts, which applies the same override to
        // the profile display_name).
        driverNumber: r.is_champion ? 1 : (r.driver_number as number | null),
        country: r.country as string | null,
        isSralien: r.is_sralien as boolean,
        division: r.division_id as number | null,
        tier: r.tier as DriverTier | null,
      },
    ]),
  );
}

export function driverInfoFor(map: Map<string, DriverInfo>, steamId: string): DriverInfo {
  return map.get(steamId) ?? EMPTY_DRIVER_INFO;
}
