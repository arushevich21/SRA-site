import { describe, it, expect } from 'vitest';
import {
  computeDriverRoundScore,
  computeDriverSeasonTotal,
  computeTeamSeasonTotal,
  compareByCountback,
} from './points-engine.js';
import type { CountbackEntry, DriverRoundResult, DriverRoundScore } from '@sra/shared-types';

// ─── test helpers ─────────────────────────────────────────────────────────────

// Position points per the spec table. Used in mkScore so test inputs don't
// depend on the function under test.
const PP: Readonly<Record<number, number>> = {
  1: 110, 2: 100, 3: 92,  4: 85,  5: 80,  6: 76,  7: 72,  8: 68,  9: 64, 10: 60,
  11: 57, 12: 54, 13: 51, 14: 48, 15: 45, 16: 43, 17: 41, 18: 39, 19: 37, 20: 35,
  21: 33, 22: 31, 23: 29, 24: 27, 25: 25, 26: 23, 27: 21, 28: 19, 29: 17, 30: 15,
  31: 13, 32: 11, 33: 9,  34: 7,  35: 6,  36: 5,  37: 4,  38: 3,  39: 2,  40: 1,
};

function mkResult(
  driverId: string,
  roundIndex: number,
  position: number | null,
  setFastestLap = false,
  setBestQualLap = false,
): DriverRoundResult {
  return { driverId, roundIndex, position, setFastestLap, setBestQualLap };
}

// Builds a DriverRoundScore without calling the function under test.
function mkScore(
  driverId: string,
  roundIndex: number,
  position: number | null,
  fl = false,
  bql = false,
): DriverRoundScore {
  const positionPoints = position !== null ? (PP[position] ?? 0) : 0;
  const fastestLapBonus = fl ? 1 : 0;
  const bestQualBonus = bql ? 1 : 0;
  return { driverId, roundIndex, position, positionPoints, fastestLapBonus, bestQualBonus, total: positionPoints + fastestLapBonus + bestQualBonus };
}

function entry(
  positions: (number | null)[],
  mostRecentRoundPosition: number | null = null,
  registrationOrder = 0,
): CountbackEntry {
  return { positions, mostRecentRoundPosition, registrationOrder };
}

// ─── computeDriverRoundScore — position points ────────────────────────────────

describe('computeDriverRoundScore — position points', () => {
  it('P1 scores 110', () => {
    const r = computeDriverRoundScore(mkResult('d1', 0, 1));
    expect(r.positionPoints).toBe(110);
    expect(r.total).toBe(110);
  });

  it('P10 scores 60', () => {
    expect(computeDriverRoundScore(mkResult('d1', 0, 10)).positionPoints).toBe(60);
  });

  it('P40 scores 1', () => {
    expect(computeDriverRoundScore(mkResult('d1', 0, 40)).positionPoints).toBe(1);
  });

  it('P41 scores 0', () => {
    const r = computeDriverRoundScore(mkResult('d1', 0, 41));
    expect(r.positionPoints).toBe(0);
    expect(r.total).toBe(0);
  });

  it('null position (not classified) scores 0 position points', () => {
    const r = computeDriverRoundScore(mkResult('d1', 0, null));
    expect(r.positionPoints).toBe(0);
    expect(r.position).toBeNull();
  });
});

// ─── computeDriverRoundScore — bonuses ───────────────────────────────────────

describe('computeDriverRoundScore — bonuses', () => {
  it('fastest race lap adds +1', () => {
    const r = computeDriverRoundScore(mkResult('d1', 0, 1, true, false));
    expect(r.fastestLapBonus).toBe(1);
    expect(r.total).toBe(111);
  });

  it('best qualifying lap adds +1', () => {
    const r = computeDriverRoundScore(mkResult('d1', 0, 1, false, true));
    expect(r.bestQualBonus).toBe(1);
    expect(r.total).toBe(111);
  });

  it('both bonuses add +2 to the round total', () => {
    const r = computeDriverRoundScore(mkResult('d1', 0, 1, true, true));
    expect(r.fastestLapBonus).toBe(1);
    expect(r.bestQualBonus).toBe(1);
    expect(r.total).toBe(112);
  });

  it('bonuses apply even when driver is not classified (setter need not finish)', () => {
    const r = computeDriverRoundScore(mkResult('d1', 0, null, true, true));
    expect(r.positionPoints).toBe(0);
    expect(r.total).toBe(2);
  });
});

// ─── computeDriverSeasonTotal — drop ─────────────────────────────────────────

describe('computeDriverSeasonTotal — drop', () => {
  it('DNF (null position → 0) is the natural drop candidate', () => {
    // 8 rounds: rounds 0-6 = P1 (110 pts), round 7 = DNF (0 pts)
    const scores = [
      ...Array.from({ length: 7 }, (_, i) => mkScore('d1', i, 1)),
      mkScore('d1', 7, null),
    ];
    const result = computeDriverSeasonTotal('d1', scores);
    expect(result.droppedRoundIndex).toBe(7);
    expect(result.seasonTotal).toBe(7 * 110);
  });

  it('drops the single worst event total (best 7 of 8)', () => {
    // R0-R6 = P1 (110 pts), R7 = P10 (60 pts) → drop R7
    const scores = [
      ...Array.from({ length: 7 }, (_, i) => mkScore('d1', i, 1)),
      mkScore('d1', 7, 10),
    ];
    const result = computeDriverSeasonTotal('d1', scores);
    expect(result.droppedRoundIndex).toBe(7);
    expect(result.seasonTotal).toBe(7 * 110); // 770
  });

  it('identifies the correct dropped round when the worst is not the last', () => {
    // R0 = P20 (35 pts), R1-R7 = P1 (110 pts) → drop R0
    const scores = [
      mkScore('d1', 0, 20),
      ...Array.from({ length: 7 }, (_, i) => mkScore('d1', i + 1, 1)),
    ];
    const result = computeDriverSeasonTotal('d1', scores);
    expect(result.droppedRoundIndex).toBe(0);
    expect(result.seasonTotal).toBe(7 * 110); // 770
  });

  it('when two rounds tie for worst, drops the one with the higher roundIndex', () => {
    // R0=P20(35), R1=P20(35), R2-R7=P1(110) → both tied; drop R1 (higher index)
    const scores = [
      mkScore('d1', 0, 20), // 35 pts
      mkScore('d1', 1, 20), // 35 pts
      ...Array.from({ length: 6 }, (_, i) => mkScore('d1', i + 2, 1)), // 110 pts each
    ];
    const result = computeDriverSeasonTotal('d1', scores);
    expect(result.droppedRoundIndex).toBe(1);
    expect(result.seasonTotal).toBe(35 + 6 * 110); // 695
  });
});

// ─── computeTeamSeasonTotal ──────────────────────────────────────────────────

describe('computeTeamSeasonTotal', () => {
  it('team total = driverA.seasonTotal + driverB.seasonTotal', () => {
    // driverA: 8 × P2 (100 pts) → drop one → seasonTotal = 700
    const aScores = Array.from({ length: 8 }, (_, i) => mkScore('dA', i, 2));
    // driverB: 8 × P3 (92 pts) → drop one → seasonTotal = 644
    const bScores = Array.from({ length: 8 }, (_, i) => mkScore('dB', i, 3));
    const result = computeTeamSeasonTotal('t1', aScores, bScores);
    expect(result.driverA.seasonTotal).toBe(7 * 100); // 700
    expect(result.driverB.seasonTotal).toBe(7 * 92);  // 644
    expect(result.teamTotal).toBe(700 + 644);          // 1344
  });

  it('each driver drops their own worst round independently (different dropped rounds)', () => {
    // driverA: R0=P20(35), R1-R7=P1(110) → drop R0 → seasonTotal = 770
    const aScores = [
      mkScore('dA', 0, 20),
      ...Array.from({ length: 7 }, (_, i) => mkScore('dA', i + 1, 1)),
    ];
    // driverB: R0-R6=P1(110), R7=P20(35) → drop R7 → seasonTotal = 770
    const bScores = [
      ...Array.from({ length: 7 }, (_, i) => mkScore('dB', i, 1)),
      mkScore('dB', 7, 20),
    ];
    const result = computeTeamSeasonTotal('t1', aScores, bScores);
    expect(result.driverA.droppedRoundIndex).toBe(0);
    expect(result.driverB.droppedRoundIndex).toBe(7);
    expect(result.teamTotal).toBe(770 + 770); // 1540
  });

  // OPEN (non-blocking): one-driver round — absent driver defaults to 0 contribution.
  // If the spec later defines a different rule for mid-season roster changes, update this test.
  it('one-driver round: absent driver contributes 0 to the team total', () => {
    const aScores = Array.from({ length: 8 }, (_, i) => mkScore('dA', i, 1)); // 8 × P1
    const bScores: DriverRoundScore[] = []; // driverB has no rounds
    const result = computeTeamSeasonTotal('t1', aScores, bScores);
    expect(result.driverB.seasonTotal).toBe(0);
    expect(result.teamTotal).toBe(result.driverA.seasonTotal);
  });
});

// ─── compareByCountback — driver ─────────────────────────────────────────────

describe('compareByCountback — driver', () => {
  it('more wins ranks higher', () => {
    const a = entry([1, 2, 3, 4]); // 1 win
    const b = entry([2, 2, 3, 4]); // 0 wins
    expect(compareByCountback(a, b)).toBeLessThan(0);
    expect(compareByCountback(b, a)).toBeGreaterThan(0);
  });

  it('equal wins: more second-place finishes ranks higher', () => {
    const a = entry([2, 2, 3, 4]); // 2 × P2
    const b = entry([2, 3, 3, 4]); // 1 × P2
    expect(compareByCountback(a, b)).toBeLessThan(0);
  });

  it('identical position arrays, same registrationOrder → returns 0', () => {
    const a = entry([1, 2, 3], null, 0);
    const b = entry([1, 2, 3], null, 0);
    expect(compareByCountback(a, b)).toBe(0);
  });
});

// ─── compareByCountback — team (pooled positions) ────────────────────────────

describe('compareByCountback — team (pooled positions)', () => {
  it('team with more pooled wins ranks higher', () => {
    const a = entry([1, 2, 3, 4]); // pool with 1 win
    const b = entry([2, 2, 3, 4]); // pool with 0 wins
    expect(compareByCountback(a, b)).toBeLessThan(0);
  });

  it('team with more pooled 2nds ranks higher when wins are equal', () => {
    const a = entry([2, 2, 3, 4]); // 2 × P2
    const b = entry([2, 3, 3, 4]); // 1 × P2
    expect(compareByCountback(a, b)).toBeLessThan(0);
  });
});

// ─── compareByCountback — ultimate fallback (OPEN, non-blocking) ─────────────
// Default per spec: best finish in most-recent round, then registration order.
// To change the tiebreaker, update mostRecentRoundPosition or registrationOrder.

describe('compareByCountback — ultimate fallback', () => {
  it('identical position countback: better most-recent-round finish ranks higher', () => {
    const a = entry([1, 2, 3], 2, 0); // most-recent: P2
    const b = entry([1, 2, 3], 3, 1); // most-recent: P3
    expect(compareByCountback(a, b)).toBeLessThan(0);
  });

  it('identical countback and most-recent-round: lower registrationOrder ranks higher', () => {
    const a = entry([1, 2, 3], 2, 1); // registered 1st
    const b = entry([1, 2, 3], 2, 2); // registered 2nd
    expect(compareByCountback(a, b)).toBeLessThan(0);
  });
});
