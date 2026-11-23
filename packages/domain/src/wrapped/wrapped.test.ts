import { describe, expect, it } from 'vitest';
import {
  seasonNumbers,
  findNemesis,
  pickArchetype,
  percentileOf,
  type WrappedRace,
} from './wrapped.js';

const A = '76561190000000001';
const B = '76561190000000002';
const C = '76561190000000003';
const D = '76561190000000004';

const entry = (steamId: string, position: number, laps = 30, totalTimeMs = 3_600_000) => ({
  steamId,
  position,
  laps,
  totalTimeMs,
});

// Four rounds at two tracks; A and B swap P1/P2 three times, C sits next to A once.
const RACES: WrappedRace[] = [
  { round: 1, trackKey: 'spa', entries: [entry(A, 1), entry(B, 2), entry(C, 3), entry(D, 4)] },
  { round: 2, trackKey: 'monza', entries: [entry(B, 1), entry(A, 2), entry(D, 3), entry(C, 4)] },
  { round: 3, trackKey: 'spa', entries: [entry(C, 1), entry(A, 2), entry(D, 3), entry(B, 4)] },
  { round: 4, trackKey: 'monza', entries: [entry(A, 1, 28, 3_000_000), entry(B, 2), entry(C, 3)] },
];

describe('seasonNumbers', () => {
  const lengths = { spa: 7004, monza: 5793 };

  it('sums races, laps, distance and time on track', () => {
    const n = seasonNumbers(A, RACES, lengths, 412);
    expect(n.races).toBe(4);
    expect(n.laps).toBe(30 + 30 + 30 + 28);
    // 60 laps of Spa + 58 of Monza
    expect(n.km).toBeCloseTo((60 * 7004 + 58 * 5793) / 1000, 6);
    expect(n.hours).toBeCloseTo((3 * 3_600_000 + 3_000_000) / 3_600_000, 6);
    expect(n.practiceLaps).toBe(412);
  });

  it('only counts rounds the driver started', () => {
    const n = seasonNumbers(D, RACES, lengths, 0);
    expect(n.races).toBe(3);
    expect(n.laps).toBe(90);
  });

  it('leaves distance out of tracks with no known length rather than guessing', () => {
    const n = seasonNumbers(A, RACES, { spa: 7004 }, 0);
    expect(n.km).toBeCloseTo((60 * 7004) / 1000, 6);
    expect(n.kmIncomplete).toBe(true);
  });
});

describe('findNemesis', () => {
  it('picks the driver finished next to most often, with the record between them', () => {
    // A–B adjacent in rounds 1, 2, 4. A–C adjacent in round 3 only (C P1, A P2).
    const n = findNemesis(A, RACES)!;
    expect(n.steamId).toBe(B);
    expect(n.sideBySide).toBe(3);
    expect(n.ahead).toBe(3); // A beat B in rounds 1, 3, 4 (all races together, not just adjacent ones)
    expect(n.behind).toBe(1);
    expect(n.racesTogether).toBe(4);
  });

  it('breaks a side-by-side tie by the closer head-to-head record', () => {
    const races: WrappedRace[] = [
      { round: 1, trackKey: 'x', entries: [entry(A, 1), entry(B, 2), entry(C, 3)] },
      { round: 2, trackKey: 'x', entries: [entry(C, 1), entry(A, 2), entry(B, 3)] },
      { round: 3, trackKey: 'x', entries: [entry(B, 1), entry(C, 2), entry(A, 3)] },
    ];
    // A–B adjacent rounds 1, 2 (2x); A–C adjacent rounds 2, 3 (2x).
    // vs B: A ahead 2–1. vs C: A ahead 1–2... both margin 1; then most races together (3 each);
    // then lowest steamId for determinism.
    expect(findNemesis(A, races)!.steamId).toBe(B);
  });

  it('returns null when the driver never finished next to anyone', () => {
    const races: WrappedRace[] = [{ round: 1, trackKey: 'x', entries: [entry(A, 1)] }];
    expect(findNemesis(A, races)).toBeNull();
  });
});

describe('percentileOf', () => {
  it('is the share of the field this value beats or ties, 0..1', () => {
    expect(percentileOf(10, [1, 5, 10, 20])).toBe(0.75);
    expect(percentileOf(20, [1, 5, 10, 20])).toBe(1);
    expect(percentileOf(1, [1, 5, 10, 20])).toBe(0.25);
  });

  it('is 0 for an empty field', () => {
    expect(percentileOf(3, [])).toBe(0);
  });
});

describe('pickArchetype', () => {
  const base = { roundsStarted: 6, totalRounds: 8, consistencyPct: 0.5, gainPct: 0.5, lossPct: 0.5, practicePct: 0.5 };

  it('takes the most extreme trait when it clears the bar', () => {
    expect(pickArchetype({ ...base, consistencyPct: 0.95, practicePct: 0.9 }).key).toBe('metronome');
    expect(pickArchetype({ ...base, practicePct: 0.97 }).key).toBe('grinder');
    expect(pickArchetype({ ...base, gainPct: 0.9 }).key).toBe('charger');
    expect(pickArchetype({ ...base, lossPct: 0.92 }).key).toBe('qualifier');
  });

  it('falls back to ironman for a full season, then racer', () => {
    expect(pickArchetype({ ...base, roundsStarted: 8 }).key).toBe('ironman');
    expect(pickArchetype(base).key).toBe('racer');
  });

  it('resolves exact ties in a fixed order so the same data always gives the same card', () => {
    const tie = { ...base, consistencyPct: 0.9, gainPct: 0.9 };
    expect(pickArchetype(tie).key).toBe('metronome');
  });
});
