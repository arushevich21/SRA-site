import { describe, it, expect } from 'vitest';
import {
  computeAccRacePoints,
  computeAccFastestQualifyingLapSteamId,
  totalAccRoundPoints,
  ACC_POSITION_POINTS,
  ACC_FASTEST_RACE_LAP_BONUS,
  ACC_FASTEST_QUALIFYING_LAP_BONUS,
} from './acc-points.js';
import type { AccSessionResult, AccDriverResult } from '@sra/shared-types';

function driver(overrides: Partial<AccDriverResult>): AccDriverResult {
  return {
    position: 1,
    carId: 1,
    carModel: 8,
    carModelName: null,
    carGroup: 'GT3',
    cupCategory: null,
    cupCategoryName: null,
    raceNumber: null,
    teamName: null,
    drivers: [],
    currentDriverSteamId: '',
    lapsCompleted: 1,
    bestLapMs: null,
    bestLap: null,
    sectorsMs: null,
    lastLapMs: null,
    totalTimeMs: null,
    missingMandatoryPitstop: null,
    ...overrides,
  };
}

function session(
  sessionType: AccSessionResult['sessionType'],
  results: AccDriverResult[],
): AccSessionResult {
  return {
    sessionType,
    track: 'nurburgring',
    serverName: null,
    date: null,
    sessionFile: null,
    championshipId: null,
    seasonId: null,
    isWetSession: false,
    bestLapMs: null,
    bestLap: null,
    bestSplits: null,
    results,
  };
}

describe('computeAccRacePoints', () => {
  it('maps finishing positions 1-3 and 40 to the SRA ACC points reference', () => {
    const race = session('Race', [
      driver({ position: 1, currentDriverSteamId: 'A' }),
      driver({ position: 2, currentDriverSteamId: 'B' }),
      driver({ position: 3, currentDriverSteamId: 'C' }),
      driver({ position: 40, currentDriverSteamId: 'Z' }),
    ]);
    const { points } = computeAccRacePoints(race);
    expect(points['A']).toBe(110);
    expect(points['B']).toBe(100);
    expect(points['C']).toBe(92);
    expect(points['Z']).toBe(1);
  });

  it('ACC_POSITION_POINTS matches the SRA ACC points reference exactly', () => {
    expect(ACC_POSITION_POINTS).toEqual([
      0,
      110, 100, 92, 85, 80, 76, 72, 68, 64, 60, // 1-10
      57, 54, 51, 48, 45, 43, 41, 39, 37, 35, // 11-20
      33, 31, 29, 27, 25, 23, 21, 19, 17, 15, // 21-30
      13, 11, 9, 7, 6, 5, 4, 3, 2, 1, // 31-40
    ]);
  });

  it('computeAccRacePoints matches ACC_POSITION_POINTS for every position 1-40', () => {
    const race = session(
      'Race',
      ACC_POSITION_POINTS.slice(1).map((_, i) =>
        driver({ position: i + 1, currentDriverSteamId: `P${i + 1}` }),
      ),
    );
    const { points } = computeAccRacePoints(race);
    for (let pos = 1; pos <= 40; pos++) {
      expect(points[`P${pos}`]).toBe(ACC_POSITION_POINTS[pos]);
    }
  });

  it('ACC_FASTEST_RACE_LAP_BONUS and ACC_FASTEST_QUALIFYING_LAP_BONUS are both 1, per the SRA reference', () => {
    expect(ACC_FASTEST_RACE_LAP_BONUS).toBe(1);
    expect(ACC_FASTEST_QUALIFYING_LAP_BONUS).toBe(1);
  });

  it('awards zero position points for finishing beyond P40', () => {
    const race = session('Race', [driver({ position: 41, currentDriverSteamId: 'K' })]);
    const { points } = computeAccRacePoints(race);
    expect(points['K']).toBe(0);
  });

  it('ignores results with no currentDriverSteamId', () => {
    const race = session('Race', [driver({ position: 1, currentDriverSteamId: '' })]);
    const { points } = computeAccRacePoints(race);
    expect(points).toEqual({});
  });

  it('finds the driver with the fastest valid race lap and bakes the +1 bonus into points', () => {
    const race = session('Race', [
      driver({ position: 2, currentDriverSteamId: 'A', bestLapMs: 95000 }),
      driver({ position: 1, currentDriverSteamId: 'B', bestLapMs: 93000 }),
    ]);
    const { points, fastestRaceLapSteamId } = computeAccRacePoints(race);
    expect(fastestRaceLapSteamId).toBe('B');
    expect(points['B']).toBe(110 + 1); // P1 + Fastest Race Lap bonus
    expect(points['A']).toBe(100); // P2, no bonus
  });

  it('fastestRaceLapSteamId is null when nobody set a valid lap', () => {
    const race = session('Race', [driver({ position: 1, currentDriverSteamId: 'A', bestLapMs: null })]);
    const { fastestRaceLapSteamId } = computeAccRacePoints(race);
    expect(fastestRaceLapSteamId).toBeNull();
  });
});

describe('computeAccFastestQualifyingLapSteamId', () => {
  it('finds the driver with the fastest qualifying lap', () => {
    const qualify = session('Qualify', [
      driver({ position: 2, currentDriverSteamId: 'A', bestLapMs: 97000 }),
      driver({ position: 1, currentDriverSteamId: 'B', bestLapMs: 96000 }),
    ]);
    expect(computeAccFastestQualifyingLapSteamId(qualify)).toBe('B');
  });

  it('is null when nobody set a valid lap', () => {
    const qualify = session('Qualify', [driver({ currentDriverSteamId: 'A', bestLapMs: null })]);
    expect(computeAccFastestQualifyingLapSteamId(qualify)).toBeNull();
  });
});

describe('totalAccRoundPoints', () => {
  it('adds the Fastest Qualifying Lap bonus on top of race points', () => {
    const total = totalAccRoundPoints({ A: 110, B: 100 }, 'B');
    expect(total).toEqual({ A: 110, B: 101 });
  });

  it('a driver can win the Fastest Qualifying Lap bonus without scoring race points', () => {
    const total = totalAccRoundPoints({ A: 110 }, 'Z');
    expect(total).toEqual({ A: 110, Z: 1 });
  });

  it('returns the race points unchanged when there is no qualifying bonus', () => {
    const total = totalAccRoundPoints({ A: 110, B: 100 }, null);
    expect(total).toEqual({ A: 110, B: 100 });
  });
});
