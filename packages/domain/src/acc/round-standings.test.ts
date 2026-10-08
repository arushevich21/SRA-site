import { describe, it, expect } from 'vitest';
import type { EmperorDriverStanding } from '@sra/shared-types';
import {
  applyIndividualTeamDrops,
  buildDriverRounds,
  buildTeamRounds,
  pairOrphanEvents,
  type RoundEvent,
} from './round-standings.js';

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
  const teams = [{ teamName: 'FM | TBD' }, { teamName: 'CM-TBD' }, { teamName: 'Solo' }];
  // FM's drivers drop DIFFERENT rounds — the case the team drop rule is about.
  const drivers: { teamEventPoints: Record<string, Record<string, number>>; droppedEventIds: string[] }[] = [
    { teamEventPoints: { 'FM | TBD': { 'ev-zandvoort': 100, 'ev-bathurst': 50 } }, droppedEventIds: ['ev-bathurst'] },
    { teamEventPoints: { 'FM | TBD': { 'ev-zandvoort': 80, 'ev-bathurst': 60 } }, droppedEventIds: ['ev-zandvoort'] },
    { teamEventPoints: { 'CM-TBD': { 'ev-zandvoort': 90, 'ev-bathurst': 120 } }, droppedEventIds: [] },
    { teamEventPoints: { 'CM-TBD': { 'ev-zandvoort': 90 } }, droppedEventIds: [] },
    { teamEventPoints: { Solo: { 'ev-bathurst': 110 } }, droppedEventIds: ['ev-bathurst'] },
    // A team Emperor doesn't list in this group is ignored, not invented.
    { teamEventPoints: { Ghost: { 'ev-zandvoort': 999 } }, droppedEventIds: [] },
  ];

  it('sums each team’s drivers per event and carries each driver’s own drop', () => {
    const rounds = buildTeamRounds(teams, drivers, events);
    expect(rounds.get('FM | TBD')).toEqual([
      { points: 180, droppedPoints: 80, dropped: false, rank: 1 }, // tied with CM on 180
      { points: 110, droppedPoints: 50, dropped: false, rank: 2 },
    ]);
    expect(rounds.get('CM-TBD')).toEqual([
      { points: 180, droppedPoints: 0, dropped: false, rank: 1 },
      { points: 120, droppedPoints: 0, dropped: false, rank: 1 },
    ]);
  });

  it('marks a night fully dropped only when every scorer dropped it', () => {
    const rounds = buildTeamRounds(teams, drivers, events);
    expect(rounds.get('Solo')![1]).toEqual({ points: 110, droppedPoints: 110, dropped: true, rank: 2 });
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
    expect(rounds.get('Solo')![0]).toEqual({ points: null, droppedPoints: 0, dropped: false, rank: null });
  });

  it('attributes a switched driver’s nights to the team they were on', () => {
    const rounds = buildTeamRounds(
      [{ teamName: 'A' }, { teamName: 'B' }],
      [{ teamEventPoints: { A: { 'ev-zandvoort': 10 }, B: { 'ev-bathurst': 20 } }, droppedEventIds: [] }],
      events,
    );
    expect(rounds.get('A')!.map((c) => c.points)).toEqual([10, null]);
    expect(rounds.get('B')!.map((c) => c.points)).toEqual([null, 20]);
  });
});

describe('applyIndividualTeamDrops', () => {
  const R = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'];
  const pts = (values: number[]) => Object.fromEntries(R.map((r, i) => [r, values[i]]));
  function driver(team: string, values: number[], dropped: string[]): EmperorDriverStanding {
    return {
      position: 1,
      driverName: team,
      steamId: `S${team}${values[0]}`,
      carModel: null,
      points: 0,
      pointsPenalty: 0,
      teamNames: [team],
      eventPoints: pts(values),
      teamEventPoints: { [team]: pts(values) },
      droppedEventIds: dropped,
    };
  }
  const team = (teamName: string, points: number, pointsPenalty = 0) => ({
    position: 0,
    teamName,
    points,
    pointsPenalty,
    droppedEventIds: ['r4'],
  });

  // The league's reference sheet: Driver 1 drops R1 (35), Driver 2 drops R4
  // (0). Emperor dropped the team's lowest COMBINED week (R4, 100) for 582;
  // the rule is each driver's own lowest week, for 647.
  const reference = () => ({
    driverStandings: {
      '': [driver('Ref', [35, 37, 69, 100, 50, 88], ['r1']), driver('Ref', [80, 79, 64, 0, 55, 25], ['r4'])],
    },
    teamStandings: { '': [team('Ref', 582)] },
  });

  it('drops each driver’s own lowest week, not the team’s lowest combined week', () => {
    const out = applyIndividualTeamDrops(reference());
    expect(out.teamStandings[''][0]).toMatchObject({ teamName: 'Ref', points: 647, droppedEventIds: [] });
  });

  it('re-ranks teams on the new totals and leaves driver standings alone', () => {
    const input = reference();
    input.driverStandings[''].push(driver('Other', [100, 100, 100, 100, 100, 100], ['r6']));
    input.teamStandings[''] = [team('Other', 600), team('Ref', 582)].map((t) => ({ ...t }));
    // Other: 600 - 100 = 500, below Ref's 647 — Ref moves up to P1.
    const out = applyIndividualTeamDrops(input);
    expect(out.teamStandings[''].map((t) => [t.position, t.teamName, t.points])).toEqual([
      [1, 'Ref', 647],
      [2, 'Other', 500],
    ]);
    expect(out.driverStandings).toBe(input.driverStandings);
  });

  it('still deducts the team’s points penalty', () => {
    const input = reference();
    input.teamStandings[''] = [team('Ref', 582, 10)];
    expect(applyIndividualTeamDrops(input).teamStandings[''][0].points).toBe(637);
  });

  it('keeps Emperor’s figure for a team with no per-team driver points', () => {
    const input = reference();
    input.teamStandings[''].push(team('Unlinked', 300));
    const unlinked = applyIndividualTeamDrops(input).teamStandings[''].find((t) => t.teamName === 'Unlinked');
    expect(unlinked?.points).toBe(300);
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
