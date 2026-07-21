import { describe, it, expect } from 'vitest';
import { sortStandingsWithTiebreak, type StandingsEntrant } from './standings-order.js';

function entrant(id: string, totalPoints: number, rounds: (number | null)[]): StandingsEntrant & { id: string } {
  return { id, totalPoints, rounds: rounds.map((points) => ({ points })) };
}

describe('sortStandingsWithTiebreak', () => {
  it('sorts by points descending when there is no tie', () => {
    const result = sortStandingsWithTiebreak([
      entrant('a', 20, [20]),
      entrant('b', 40, [40]),
    ]);
    expect(result.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('breaks a tie in favor of whoever reached the total first, when race counts match', () => {
    // Omar hits 30 in round 1; Jeremy hits 30 by round 2. Same participation count (3).
    const omar = entrant('omar', 30, [30, 0, 0]);
    const jeremy = entrant('jeremy', 30, [10, 20, 0]);
    const result = sortStandingsWithTiebreak([jeremy, omar]);
    expect(result.map((e) => e.id)).toEqual(['omar', 'jeremy']);
  });

  it('overrides the reached-first rule when one entrant raced more', () => {
    // Omar: 30 points from a single completed race, DNS the other two.
    const omar = entrant('omar', 30, [30, null, null]);
    // Jeremy: same 30 points, but across two completed races (one for 0),
    // DNS only once — more races participated wins regardless of timing.
    const jeremy = entrant('jeremy', 30, [0, 30, null]);
    const result = sortStandingsWithTiebreak([omar, jeremy]);
    expect(result.map((e) => e.id)).toEqual(['jeremy', 'omar']);
  });

  it('never produces duplicate ranks: three-way tie resolves to a strict order', () => {
    const a = entrant('a', 30, [30, null, null]); // 1 race
    const b = entrant('b', 30, [30, 0, null]); // 2 races, reached total round 0
    const c = entrant('c', 30, [10, 20, null]); // 2 races, reached total round 1
    const result = sortStandingsWithTiebreak([a, b, c]);
    expect(result.map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });

  it('preserves original order for entrants fully tied on every criterion', () => {
    const a = entrant('a', 30, [30]);
    const b = entrant('b', 30, [30]);
    const result = sortStandingsWithTiebreak([a, b]);
    expect(result.map((e) => e.id)).toEqual(['a', 'b']);
  });
});
