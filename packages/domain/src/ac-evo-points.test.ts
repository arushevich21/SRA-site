import { describe, it, expect } from 'vitest';
import {
  computeRacePositionPoints,
  computePoleSteamId,
  totalRoundPoints,
  ACEVO_POSITION_POINTS,
} from './ac-evo-points.js';
import type { AcEvoSessionResult, AcEvoDriverResult } from '@sra/shared-types';

function driver(overrides: Partial<AcEvoDriverResult>): AcEvoDriverResult {
  return {
    position: 1,
    driverName: 'Unknown',
    firstName: null,
    lastName: null,
    steamId: '',
    nation: null,
    carModel: null,
    raceNumber: null,
    startingPosition: null,
    lapsCompleted: 1,
    noLaps: false,
    bestLapMs: null,
    bestLap: null,
    sectorsMs: null,
    ...overrides,
  };
}

function session(
  sessionType: AcEvoSessionResult['sessionType'],
  results: AcEvoDriverResult[],
): AcEvoSessionResult {
  return {
    sessionType,
    sessionName: null,
    track: 'Road Atlanta',
    trackLayout: 'GP',
    serverName: null,
    seasonGuid: null,
    championshipId: null,
    isCompleted: true,
    serverStartTime: null,
    results,
  };
}

describe('computeRacePositionPoints', () => {
  it('maps finishing positions 1-10 to the MX5 Cup points table', () => {
    const race = session('Race', [
      driver({ position: 1, steamId: 'A' }),
      driver({ position: 2, steamId: 'B' }),
      driver({ position: 10, steamId: 'J' }),
    ]);
    const { points } = computeRacePositionPoints(race);
    expect(points['A']).toBe(25);
    expect(points['B']).toBe(18);
    expect(points['J']).toBe(1);
  });

  it('awards zero points for finishing position 11 and beyond', () => {
    const race = session('Race', [driver({ position: 11, steamId: 'K' })]);
    const { points } = computeRacePositionPoints(race);
    expect(points['K']).toBe(0);
  });

  it('ignores drivers with no steamId', () => {
    const race = session('Race', [driver({ position: 1, steamId: '' })]);
    const { points } = computeRacePositionPoints(race);
    expect(points).toEqual({});
  });

  it('finds the driver with the fastest valid race lap', () => {
    const race = session('Race', [
      driver({ position: 2, steamId: 'A', bestLapMs: 95000 }),
      driver({ position: 1, steamId: 'B', bestLapMs: 93000 }),
    ]);
    const { fastestLapSteamId } = computeRacePositionPoints(race);
    expect(fastestLapSteamId).toBe('B');
  });

  it('fastestLapSteamId is null when nobody set a valid lap', () => {
    const race = session('Race', [driver({ position: 1, steamId: 'A', bestLapMs: null })]);
    const { fastestLapSteamId } = computeRacePositionPoints(race);
    expect(fastestLapSteamId).toBeNull();
  });

  it('full position table matches the league spec exactly', () => {
    expect(ACEVO_POSITION_POINTS).toEqual([0, 25, 18, 15, 12, 10, 8, 6, 4, 2, 1]);
  });
});

describe('computePoleSteamId', () => {
  it('finds the driver with the best qualifying lap', () => {
    const qualify = session('Qualify', [
      driver({ position: 2, steamId: 'A', qualifyingBestMs: 97000 }),
      driver({ position: 1, steamId: 'B', qualifyingBestMs: 96000 }),
    ]);
    expect(computePoleSteamId(qualify)).toBe('B');
  });

  it('is null when nobody set a valid qualifying time', () => {
    const qualify = session('Qualify', [driver({ steamId: 'A', qualifyingBestMs: null })]);
    expect(computePoleSteamId(qualify)).toBeNull();
  });
});

describe('totalRoundPoints', () => {
  it('sums position points with fastest-lap and pole bonuses', () => {
    const total = totalRoundPoints({ A: 25, B: 18 }, 'B', 'A');
    expect(total).toEqual({ A: 30, B: 23 });
  });

  it('a driver can win the fastest-lap bonus without scoring position points', () => {
    const total = totalRoundPoints({ A: 25 }, 'Z', null);
    expect(total).toEqual({ A: 25, Z: 5 });
  });

  it('returns the position points unchanged when there are no bonuses', () => {
    const total = totalRoundPoints({ A: 25, B: 18 }, null, null);
    expect(total).toEqual({ A: 25, B: 18 });
  });
});
