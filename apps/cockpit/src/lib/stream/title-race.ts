import {
  driverCeiling,
  driverFloor,
  teamCeiling,
  teamFloor,
  titleStatuses,
  type TitleRaceEntrant,
  type TitleRaceInput,
} from '@sra/domain';
import { stripSteamIdPrefix } from '@/lib/driver-lookup';
import type { DivisionStandings } from './overlay-data';

// Which rows the standings overlay marks as champion or still in a title fight.
// The maths is in @sra/domain (title-race.ts); this picks the championships a
// division actually awards and feeds them.
//
// Drivers: one title per tier (Gold, Silver) where the division runs tiers,
// else one for the whole grid. A driver with no tier on file isn't in a tier
// title, so they're never marked. Teams: one title for the table.

export type TitleMark = { status: 'champion' | 'contender'; label: string };

export type TitleMarks = {
  drivers: Map<string, TitleMark>; // keyed by the row's steamId as Emperor sent it
  teams: Map<string, TitleMark>; // keyed by teamName
};

const NONE: TitleMarks = { drivers: new Map(), teams: new Map() };

// Early in a season nearly everyone can still win. Marking most of the table
// says nothing, so a fight is only shown once it has narrowed to under half
// of the field.
function narrowEnough(contenders: number, field: number): boolean {
  return contenders > 0 && contenders * 2 < field;
}

export function titleRaceForDivision(standings: DivisionStandings, totalRounds: number): TitleMarks {
  if (standings.source !== 'live' || standings.drivers.length === 0 || totalRounds <= 0) return NONE;

  const input: TitleRaceInput = {
    totalRounds,
    roundsScored: standings.roundsScored,
    // Emperor drops a fixed number of rounds; the most any driver has dropped
    // so far is that number (a full-season driver always has it applied).
    drops: Math.max(0, ...standings.drivers.map((d) => d.droppedEventIds.length)),
  };

  const drivers = new Map<string, TitleMark>();
  const tierOf = (steamId: string) => standings.driverInfo[stripSteamIdPrefix(steamId)]?.tier ?? null;
  const anyTiers = standings.drivers.some((d) => tierOf(d.steamId) != null);

  const groups = new Map<string, typeof standings.drivers>();
  for (const d of standings.drivers) {
    const key = anyTiers ? tierOf(d.steamId) : 'all';
    if (key == null) continue;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }

  for (const [tier, rows] of groups) {
    const title = tier === 'gold' ? 'Gold ' : tier === 'silver' ? 'Silver ' : '';
    const entrants: TitleRaceEntrant[] = rows.map((d) => ({
      scores: Object.values(d.eventPoints),
      penalty: d.pointsPenalty,
    }));
    const statuses = titleStatuses(
      entrants.map((e) => ({ floor: driverFloor(e, input), ceiling: driverCeiling(e, input) })),
    );
    const fight = narrowEnough(statuses.filter((s) => s === 'contender').length, rows.length);
    statuses.forEach((status, i) => {
      if (status === 'champion') drivers.set(rows[i]!.steamId, { status, label: `${title}Champion` });
      else if (status === 'contender' && fight)
        drivers.set(rows[i]!.steamId, { status, label: `${title}Title Fight` });
    });
  }

  const teams = new Map<string, TitleMark>();
  if (standings.teams.length > 0) {
    // Each team's drivers, with only the points they scored for this team —
    // the same split team totals are built from (applyIndividualTeamDrops).
    const members = standings.teams.map((t) =>
      standings.drivers
        .filter((d) => d.teamEventPoints[t.teamName])
        .map((d): TitleRaceEntrant => ({ scores: Object.values(d.teamEventPoints[t.teamName]!) })),
    );
    const statuses = titleStatuses(
      standings.teams.map((t, i) => ({
        floor: teamFloor(members[i]!, input) - t.pointsPenalty,
        ceiling: teamCeiling(members[i]!, input) - t.pointsPenalty,
      })),
    );
    const fight = narrowEnough(statuses.filter((s) => s === 'contender').length, standings.teams.length);
    statuses.forEach((status, i) => {
      const name = standings.teams[i]!.teamName;
      if (status === 'champion') teams.set(name, { status, label: 'Team Champions' });
      else if (status === 'contender' && fight) teams.set(name, { status, label: 'Title Fight' });
    });
  }

  return { drivers, teams };
}
