import { describe, it, expect } from 'vitest';
import { buildDriverRounds, buildTeamRounds, pairOrphanEvents, type RoundEvent } from './round-standings.js';

const JOEL = '76561197960416683';
const FIRE = '76561198000000002';
const GUY = '76561198000000003';

function race(order: [steamId: string, bestLapMs: number | null, laps?: number][]) {
  return {
    results: order.map(([steamId, bestLapMs, laps = 10], i) => ({
      position: i + 1,
      bestLapMs,
      lapsCompleted: laps,
      driverSteamIds: [steamId],
    })),
  };
}

// R1 Zandvoort: single race, Joel wins, Fire has the fastest lap.
// R2 Bathurst: two races (LIAW night); finish = race 2 where Guy wins;
//              Joel sets FL in race 1 only.
const events: RoundEvent[] = [
  {
    eventId: 'ev-zandvoort',
    round: 1,
    track: 'Zandvoort',
    races: [race([[JOEL, 95000], [FIRE, 94500], [GUY, 96000]])],
  },
  {
    eventId: 'ev-bathurst',
    round: 2,
    track: 'Bathurst',
    races: [
      race([[JOEL, 120000], [GUY, 121000], [FIRE, 122000]]),
      race([[GUY, 121500], [FIRE, 121400], [JOEL, 123000]]),
    ],
  },
];

describe('buildDriverRounds', () => {
  it('lines Emperor points up under events and flags the drop', () => {
    const rounds = buildDriverRounds(
      { steamId: `S${JOEL}`, eventPoints: { 'ev-zandvoort': 180, 'ev-bathurst': 157 }, droppedEventIds: ['ev-bathurst'] },
      events,
    );
    expect(rounds.cells.map((c) => [c.points, c.dropped])).toEqual([
      [180, false],
      [157, true],
    ]);
  });

  it('reads finish from the FINAL race of a multi-race night', () => {
    const joel = buildDriverRounds({ steamId: `S${JOEL}`, eventPoints: {}, droppedEventIds: [] }, events);
    const guy = buildDriverRounds({ steamId: `S${GUY}`, eventPoints: {}, droppedEventIds: [] }, events);
    expect(joel.cells.map((c) => c.finish)).toEqual([1, 3]);
    expect(guy.cells.map((c) => c.finish)).toEqual([3, 1]);
  });

  it('counts a fastest lap in ANY race of the night, once per night', () => {
    const joel = buildDriverRounds({ steamId: `S${JOEL}`, eventPoints: {}, droppedEventIds: [] }, events);
    const fire = buildDriverRounds({ steamId: `S${FIRE}`, eventPoints: {}, droppedEventIds: [] }, events);
    expect(joel.cells.map((c) => c.fastestLap)).toEqual([false, true]);
    expect(fire.cells.map((c) => c.fastestLap)).toEqual([true, true]);
    expect(joel.fastestLaps).toBe(1);
    expect(fire.fastestLaps).toBe(2);
  });

  it('ignores a best lap from a car that completed no laps', () => {
    const ev: RoundEvent = {
      eventId: 'e',
      round: 1,
      track: 't',
      races: [race([[JOEL, 100000], [FIRE, 1, 0]])],
    };
    const fire = buildDriverRounds({ steamId: `S${FIRE}`, eventPoints: {}, droppedEventIds: [] }, [ev]);
    expect(fire.cells[0].fastestLap).toBe(false);
  });

  it('leaves points null for an event the driver has no entry for', () => {
    const rounds = buildDriverRounds(
      { steamId: `S${GUY}`, eventPoints: { 'ev-bathurst': 212 }, droppedEventIds: ['ev-zandvoort'] },
      events,
    );
    // A missed round can still be the drop — Emperor drops the worst score,
    // and a no-show is 0.
    expect(rounds.cells[0]).toEqual({ points: null, dropped: true, finish: 3, fastestLap: false });
  });

  it('accepts an already-bare steamId', () => {
    const rounds = buildDriverRounds({ steamId: JOEL, eventPoints: {}, droppedEventIds: [] }, events);
    expect(rounds.cells[0].finish).toBe(1);
  });
});

describe('buildTeamRounds', () => {
  const teams = [
    { teamName: 'FM | TBD', droppedEventIds: ['ev-bathurst'] },
    { teamName: 'CM-TBD', droppedEventIds: [] },
    { teamName: 'Solo', droppedEventIds: [] },
  ];
  const drivers: { teamEventPoints: Record<string, Record<string, number>> }[] = [
    { teamEventPoints: { 'FM | TBD': { 'ev-zandvoort': 100, 'ev-bathurst': 50 } } },
    { teamEventPoints: { 'FM | TBD': { 'ev-zandvoort': 80, 'ev-bathurst': 60 } } },
    { teamEventPoints: { 'CM-TBD': { 'ev-zandvoort': 90, 'ev-bathurst': 120 } } },
    { teamEventPoints: { 'CM-TBD': { 'ev-zandvoort': 90 } } },
    { teamEventPoints: { Solo: { 'ev-bathurst': 110 } } },
    // A team Emperor doesn't list in this group is ignored, not invented.
    { teamEventPoints: { Ghost: { 'ev-zandvoort': 999 } } },
  ];

  it('sums each team’s drivers per event and ranks teams within the round', () => {
    const rounds = buildTeamRounds(teams, drivers, events);
    expect(rounds.get('FM | TBD')).toEqual([
      { points: 180, dropped: false, rank: 1 }, // tied with CM on 180
      { points: 110, dropped: true, rank: 2 },
    ]);
    expect(rounds.get('CM-TBD')).toEqual([
      { points: 180, dropped: false, rank: 1 },
      { points: 120, dropped: false, rank: 1 },
    ]);
  });

  it('uses competition ranking: a tie shares the rank and the next skips', () => {
    const rounds = buildTeamRounds(teams, drivers, events);
    // Zandvoort: FM 180, CM 180, Solo none. Both rank 1; nobody is rank 2.
    expect(rounds.get('FM | TBD')![0].rank).toBe(1);
    expect(rounds.get('CM-TBD')![0].rank).toBe(1);
    // Bathurst: CM 120 (1), Solo 110 (2), FM 110 (2).
    expect(rounds.get('Solo')![1].rank).toBe(2);
    expect(rounds.get('FM | TBD')![1].rank).toBe(2);
  });

  it('leaves points and rank null for an event a team did not score', () => {
    const rounds = buildTeamRounds(teams, drivers, events);
    expect(rounds.get('Solo')![0]).toEqual({ points: null, dropped: false, rank: null });
  });

  it('attributes a switched driver’s nights to the team they were on', () => {
    const rounds = buildTeamRounds(
      [{ teamName: 'A', droppedEventIds: [] }, { teamName: 'B', droppedEventIds: [] }],
      [{ teamEventPoints: { A: { 'ev-zandvoort': 10 }, B: { 'ev-bathurst': 20 } } }],
      events,
    );
    expect(rounds.get('A')!.map((c) => c.points)).toEqual([10, null]);
    expect(rounds.get('B')!.map((c) => c.points)).toEqual([null, 20]);
  });
});

describe('pairOrphanEvents', () => {
  it('pairs each orphan event with the round whose classified drivers it scored', () => {
    const pairs = pairOrphanEvents(
      [
        { eventId: 'ev-a', scorerSteamIds: ['S1', 'S2', 'S3'] },
        { eventId: 'ev-b', scorerSteamIds: ['S2', 'S4', 'S5'] },
      ],
      [
        { key: 'ricard', classifiedSteamIds: ['4', '5', '2'] },
        { key: 'zandvoort', classifiedSteamIds: ['1', '2', '3'] },
      ],
    );
    expect(pairs.get('ev-a')).toBe('zandvoort');
    expect(pairs.get('ev-b')).toBe('ricard');
  });

  it('never assigns one round to two events, and leaves a no-overlap orphan unpaired', () => {
    const pairs = pairOrphanEvents(
      [
        { eventId: 'ev-a', scorerSteamIds: ['S1', 'S2'] },
        { eventId: 'ev-b', scorerSteamIds: ['S1'] },
        { eventId: 'ev-c', scorerSteamIds: ['S9'] },
      ],
      [{ key: 'only', classifiedSteamIds: ['1', '2'] }],
    );
    expect(pairs.get('ev-a')).toBe('only');
    expect(pairs.has('ev-b')).toBe(false);
    expect(pairs.has('ev-c')).toBe(false);
  });
});
