import { describe, it, expect } from 'vitest';
import { computeHotStintResults, type HotStintLapInput } from './hot-stint.js';

function lap(
  steamId: string,
  sessionId: string,
  lapIndex: number,
  lapTimeMs: number,
  isValid = true,
  driverName = 'Driver ' + steamId,
): HotStintLapInput {
  return { steamId, driverName, sessionId, lapIndex, lapTimeMs, isValid };
}

describe('computeHotStintResults', () => {
  it('omits a driver with fewer than N valid laps', () => {
    const laps = [lap('1', 's1', 0, 100_000), lap('1', 's1', 1, 100_000), lap('1', 's1', 2, 100_000)];
    const results = computeHotStintResults(laps, 5);
    expect(results).toHaveLength(0);
  });

  it('breaks a would-be window on an invalid lap mid-run', () => {
    // 3 valid, 1 invalid, 3 valid — no single island reaches 5.
    const laps = [
      lap('1', 's1', 0, 100_000),
      lap('1', 's1', 1, 100_000),
      lap('1', 's1', 2, 100_000),
      lap('1', 's1', 3, 100_000, false),
      lap('1', 's1', 4, 100_000),
      lap('1', 's1', 5, 100_000),
      lap('1', 's1', 6, 100_000),
    ];
    expect(computeHotStintResults(laps, 5)).toHaveLength(0);
  });

  it('picks the faster window from the shorter of two islands', () => {
    // Island A: 6 laps averaging 110_000ms in every 5-window.
    // Island B: exactly 5 laps averaging 105_000ms — shorter, but faster.
    const islandA = [110_000, 110_000, 110_000, 110_000, 110_000, 110_000].map((t, i) =>
      lap('1', 's1', i, t),
    );
    const islandB = [105_000, 105_000, 105_000, 105_000, 105_000].map((t, i) =>
      lap('1', 's1', 10 + i, t),
    );
    const results = computeHotStintResults([...islandA, ...islandB], 5);
    expect(results).toHaveLength(1);
    expect(results[0].bestAvgMs).toBe(105_000);
    expect(results[0].windowLapMs).toEqual([105_000, 105_000, 105_000, 105_000, 105_000]);
  });

  it('finds the best window across multiple sessions for the same driver', () => {
    const sessionOneLaps = [116_000, 115_500, 115_200, 115_100, 115_300].map((t, i) =>
      lap('1', 's1', i, t),
    );
    const sessionTwoLaps = [113_000, 112_800, 112_900, 113_100, 112_700].map((t, i) =>
      lap('1', 's2', i, t),
    );
    const results = computeHotStintResults([...sessionOneLaps, ...sessionTwoLaps], 5);
    expect(results).toHaveLength(1);
    expect(results[0].windowSessionId).toBe('s2');
    expect(results[0].bestAvgMs).toBe(
      Math.round((113_000 + 112_800 + 112_900 + 113_100 + 112_700) / 5),
    );
  });

  it('accepts a driver with exactly N valid laps (boundary)', () => {
    const laps = [100_000, 101_000, 99_000, 100_500, 99_500].map((t, i) => lap('1', 's1', i, t));
    const results = computeHotStintResults(laps, 5);
    expect(results).toHaveLength(1);
    expect(results[0].bestAvgMs).toBe(
      Math.round((100_000 + 101_000 + 99_000 + 100_500 + 99_500) / 5),
    );
  });

  it('is a pure/deterministic function — identical input yields identical output', () => {
    // Stands in for "re-ingest produces identical results": a real ingest's
    // DB-layer unique constraint + upsert is what would prevent duplicate
    // rows from ever reaching this function — this asserts the computation
    // itself has no hidden ordering/mutation dependency that could make two
    // runs over the same deduplicated input diverge. (This function is
    // currently unused — see index.ts's comment on why it's kept.)
    const laps = [
      lap('1', 's1', 0, 100_000),
      lap('1', 's1', 1, 99_000),
      lap('1', 's1', 2, 98_500),
      lap('1', 's1', 3, 99_200),
      lap('1', 's1', 4, 98_900),
      lap('2', 's1', 0, 200_000, false),
    ];
    const first = computeHotStintResults(laps, 5);
    const second = computeHotStintResults([...laps], 5);
    expect(second).toEqual(first);
  });

  it('excludes a driver from the board entirely rather than showing zero laps (identity note)', () => {
    // No laps at all for this steamId (e.g. unmatched/NULL steam_id upstream)
    // simply never appears — there is no zero-lap placeholder entry.
    const laps = [lap('1', 's1', 0, 100_000)];
    const results = computeHotStintResults(laps, 5);
    expect(results.find((r) => r.steamId === 'ghost')).toBeUndefined();
  });

  it('ranks drivers ascending by best average', () => {
    const driverA = [100_000, 100_000, 100_000, 100_000, 100_000].map((t, i) => lap('a', 's1', i, t));
    const driverB = [99_000, 99_000, 99_000, 99_000, 99_000].map((t, i) => lap('b', 's1', i, t));
    const results = computeHotStintResults([...driverA, ...driverB], 5);
    expect(results.map((r) => r.steamId)).toEqual(['b', 'a']);
  });
});
