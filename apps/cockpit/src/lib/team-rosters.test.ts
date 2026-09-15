import { describe, it, expect } from 'vitest';
import type { EmperorDriverStanding } from '@sra/shared-types';
import { buildTeamRosters } from './team-rosters.js';

function driver(
  position: number,
  driverName: string,
  teamNames: string[],
  steamId = `S7656119${position}`,
): EmperorDriverStanding {
  return {
    position,
    driverName,
    steamId,
    carModel: 'Ferrari 296 GT3',
    points: 100 - position,
    pointsPenalty: 0,
    teamNames,
  };
}

describe('buildTeamRosters', () => {
  it('inverts the driver list into per-team rosters', () => {
    const rosters = buildTeamRosters({
      '': [
        driver(1, 'Joel Moffatt', ['BOP THE LEXUS']),
        driver(2, 'Anton Rushevich', ['Balkan Blast']),
        driver(3, 'Kevin Smith', ['BOP THE LEXUS']),
      ],
    });

    expect(rosters.get('BOP THE LEXUS')?.map((m) => m.driverName)).toEqual([
      'Joel Moffatt',
      'Kevin Smith',
    ]);
    expect(rosters.get('Balkan Blast')?.map((m) => m.driverName)).toEqual(['Anton Rushevich']);
  });

  it('keeps each roster in championship order, strongest driver first', () => {
    // Deliberately supplied out of rank order within the team.
    const rosters = buildTeamRosters({
      '': [driver(4, 'Slower', ['Team A']), driver(9, 'Slowest', ['Team A'])],
    });
    expect(rosters.get('Team A')?.map((m) => m.driverName)).toEqual(['Slower', 'Slowest']);
  });

  it('lists a driver under every team they raced for (mid-season change)', () => {
    // Confirmed live on LIAW: one driver carried two team entries.
    const rosters = buildTeamRosters({
      '': [driver(1, 'Jason Allen', ['Mecca Test', 'We are so back'])],
    });
    expect(rosters.get('Mecca Test')?.map((m) => m.driverName)).toEqual(['Jason Allen']);
    expect(rosters.get('We are so back')?.map((m) => m.driverName)).toEqual(['Jason Allen']);
  });

  it('omits unattached drivers rather than inventing a team for them', () => {
    const rosters = buildTeamRosters({ '': [driver(1, 'Unattached', [])] });
    expect(rosters.size).toBe(0);
  });

  it('merges rosters across class groups', () => {
    // A multiclass championship splits drivers across class keys, but a team
    // is a team — its roster must not be split by the class its drivers sit in.
    const rosters = buildTeamRosters({
      LMP2: [driver(1, 'A Driver', ['Shared Team'])],
      LMGT3: [driver(1, 'B Driver', ['Shared Team'], 'S765611992')],
    });
    expect(rosters.get('Shared Team')?.map((m) => m.driverName)).toEqual([
      'A Driver',
      'B Driver',
    ]);
  });

  it('returns no roster for a team nobody is listed against', () => {
    const rosters = buildTeamRosters({ '': [driver(1, 'Joel', ['Team A'])] });
    expect(rosters.get('Ghost Team')).toBeUndefined();
  });
});
