import { describe, it, expect } from 'vitest';
import { roundNights } from '../content/championships.js';
import type { ScheduleRound } from '../content/championships.js';

const base: ScheduleRound = {
  round: 1,
  track: 'Silverstone',
  date: '2026-09-22T21:00:00',
  raceLength: '60 min',
};

const SPLIT: ScheduleRound = {
  ...base,
  divisionStartsAt: { 2: '2026-09-23T21:00:00', 4: '2026-09-23T21:00:00' },
};

describe('roundNights', () => {
  it('groups a split-night round into two labelled nights', () => {
    expect(roundNights(SPLIT, [1, 2, 3, 4])).toEqual([
      { startsAt: '2026-09-22T21:00:00', divisionIds: [1, 3] },
      { startsAt: '2026-09-23T21:00:00', divisionIds: [2, 4] },
    ]);
  });

  it('orders nights chronologically, not by division number', () => {
    const inverted: ScheduleRound = {
      ...base,
      // D1/D3 shifted later instead — the Tuesday group is now 2 and 4.
      divisionStartsAt: { 1: '2026-09-23T21:00:00', 3: '2026-09-23T21:00:00' },
    };
    expect(roundNights(inverted, [1, 2, 3, 4]).map((n) => n.divisionIds)).toEqual([
      [2, 4],
      [1, 3],
    ]);
  });

  it('returns one unlabelled night for an ungraded series', () => {
    expect(roundNights(base, [])).toEqual([
      { startsAt: '2026-09-22T21:00:00', divisionIds: [] },
    ]);
  });

  it('returns one unlabelled night when every division races together', () => {
    // Four badges saying "all of them" is noise, not information.
    expect(roundNights(base, [1, 2, 3, 4])).toEqual([
      { startsAt: '2026-09-22T21:00:00', divisionIds: [] },
    ]);
  });

  it('collapses to one night when an override matches the round date', () => {
    const redundant: ScheduleRound = { ...base, divisionStartsAt: { 2: base.date! } };
    expect(roundNights(redundant, [1, 2])).toEqual([
      { startsAt: '2026-09-22T21:00:00', divisionIds: [] },
    ]);
  });

  it('handles three distinct nights', () => {
    const three: ScheduleRound = {
      ...base,
      divisionStartsAt: { 2: '2026-09-23T21:00:00', 3: '2026-09-24T21:00:00' },
    };
    expect(roundNights(three, [1, 2, 3])).toEqual([
      { startsAt: '2026-09-22T21:00:00', divisionIds: [1] },
      { startsAt: '2026-09-23T21:00:00', divisionIds: [2] },
      { startsAt: '2026-09-24T21:00:00', divisionIds: [3] },
    ]);
  });

  it('sorts a TBA night last', () => {
    const tba: ScheduleRound = { ...base, date: null, divisionStartsAt: { 2: '2026-09-23T21:00:00' } };
    const nights = roundNights(tba, [1, 2]);
    expect(nights[0].startsAt).toBe('2026-09-23T21:00:00');
    expect(nights[1].startsAt).toBeNull();
  });
});
