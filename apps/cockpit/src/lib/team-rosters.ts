import type { EmperorDriverStanding } from '@sra/shared-types';

// Pure roster-inversion logic, deliberately split out of TeamStandingsTable.tsx
// the same way driver-tier-badge.ts was split out of driver-lookup.ts: the
// component pulls in DriverTierBadge and the server-only driver lookup, which
// makes it unimportable from a plain unit test. This has no imports but a type.

export type TeamMember = {
  driverName: string;
  steamId: string;
  carModel: string | null;
};

/**
 * Builds teamName -> roster from the DRIVER standings.
 *
 * This is the only place the linkage exists: Emperor's team rows carry a name
 * and points and nothing else, while each driver row carries a `Teams` map
 * naming the teams they've been entered under. So a roster is assembled by
 * inverting the driver list, never by reading anything off the team row.
 *
 * Team names are the join key because that is all Emperor gives us — there is
 * no team id anywhere in the payload. Two distinct teams sharing a name would
 * therefore merge; `teams.name` is UNIQUE in our own store (20260814f), so
 * entries that came through our registration flow cannot collide.
 *
 * A driver listing more than one team (a mid-season team change — confirmed
 * live on LIAW) appears under each, which is what the payload actually says.
 */
export function buildTeamRosters(
  driverStandings: Record<string, EmperorDriverStanding[]>,
): Map<string, TeamMember[]> {
  const rosters = new Map<string, TeamMember[]>();

  for (const standings of Object.values(driverStandings)) {
    // Driver standings arrive ranked, so each roster comes out in championship
    // order — the team's strongest driver first, which is the order you would
    // want to read them in anyway.
    for (const d of standings) {
      for (const teamName of d.teamNames) {
        const member: TeamMember = {
          driverName: d.driverName,
          steamId: d.steamId,
          carModel: d.carModel,
        };
        const existing = rosters.get(teamName);
        if (existing) existing.push(member);
        else rosters.set(teamName, [member]);
      }
    }
  }

  return rosters;
}
