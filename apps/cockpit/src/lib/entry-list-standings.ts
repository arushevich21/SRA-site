import 'server-only';
import { accCarModelName } from '@sra/domain';
import type { EmperorChampionshipStandings } from '@sra/shared-types';
import { getDriverInfoBySteamIds, stripSteamIdPrefix, type DriverInfo } from '@/lib/driver-lookup';
import { supabase as adminClient } from '@/lib/supabase';

type RawEntryDriverJoin = {
  driver_id: string;
  drivers: { display_name: string | null; steam_id: string | null } | null;
};
type RawEntryJoin = {
  car_model_id: number | null;
  teams: { name: string } | { name: string }[] | null;
  registration_drivers: RawEntryDriverJoin[] | null;
};

// Before Emperor has any race results, its championship standings endpoint
// returns empty class groups (confirmed live for both LIAW and GT3 Team
// Series S19 — see the ACC-standings-server fix's PR). Rather than a bare
// "no standings yet" message, show the confirmed entry list itself at 0
// points — same registrations/registration_drivers data the register page's
// entry list reads, just reshaped into EmperorStandingsTable's format. Only
// possible for a championship that actually runs through our own
// registration system (registrationKey/registrationSeason set) — an AC Evo
// championship with no registration flow simply keeps the plain message.
export async function getEntryListAsZeroStandings(
  championshipKey: string,
  season: string,
  classTag: string,
  // Multi-division series only. One registration_key covers every division, so
  // without this every division's tab would show the whole series' entry list.
  divisionId?: number,
): Promise<EmperorChampionshipStandings | null> {
  let query = adminClient
    .from('registrations')
    .select('car_model_id, teams(name), registration_drivers(driver_id, drivers(display_name, steam_id))')
    .eq('championship_key', championshipKey)
    .eq('season', season)
    .eq('status', 'confirmed');

  if (divisionId != null) query = query.eq('division_id', divisionId);

  const { data } = await query;

  const entries = ((data ?? []) as unknown as RawEntryJoin[])
    .flatMap((r) =>
      (r.registration_drivers ?? []).map((rd) => ({
        driverName: rd.drivers?.display_name ?? 'Unknown Driver',
        // Mirrors Emperor's per-driver Teams map, so this pre-race shape and
        // the live one agree on where team membership is recorded.
        teamNames: [(Array.isArray(r.teams) ? r.teams[0] : r.teams)?.name].filter(
          (n): n is string => !!n,
        ),
        // Falls back to the driver's uuid on an unlinked/unverified Steam
        // account — this table only uses it as a React key and isn't
        // matched against anything, unlike the public leaderboards.
        steamId: rd.drivers?.steam_id ?? rd.driver_id,
        carModel: r.car_model_id != null ? accCarModelName(r.car_model_id) : null,
      })),
    )
    .sort((a, b) => a.driverName.localeCompare(b.driverName));

  if (entries.length === 0) return null;

  return {
    driverStandings: {
      [classTag]: entries.map((e, i) => ({
        position: i + 1,
        driverName: e.driverName,
        steamId: e.steamId,
        carModel: e.carModel,
        teamNames: e.teamNames,
        points: 0,
        pointsPenalty: 0,
        eventPoints: {},
        teamEventPoints: {},
        droppedEventIds: [],
      })),
    },
    teamStandings: {},
  };
}

// Division/tier badges (DriverTierBadge.tsx) need a batch driver lookup keyed
// by every steamId appearing across all class groups on the table being
// rendered — Emperor's standings payload itself carries no driver identity
// beyond steamId/driverName.
export async function getDriverInfoForStandings(
  data: EmperorChampionshipStandings,
): Promise<Record<string, DriverInfo>> {
  // Emperor's own standings payload carries steamId "S"-prefixed (ACC's
  // native format, confirmed live) — drivers.steam_id is stored bare, so the
  // lookup (and EmperorStandingsTable's read of the result) both need it
  // stripped, unlike getEntryListAsZeroStandings's entries, which already
  // come from drivers.steam_id directly and are bare already (stripping is a
  // no-op there).
  const steamIds = Object.values(data.driverStandings).flatMap((standings) =>
    standings.map((s) => stripSteamIdPrefix(s.steamId)),
  );
  return Object.fromEntries(await getDriverInfoBySteamIds(steamIds));
}
