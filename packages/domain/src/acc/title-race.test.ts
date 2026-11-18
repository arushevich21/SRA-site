import { describe, expect, it } from 'vitest';
import {
  MAX_ROUND_POINTS,
  driverCeiling,
  driverFloor,
  teamCeiling,
  teamFloor,
  titleStatuses,
  type TitleRaceInput,
} from './title-race.js';

// S19 Division 1 after 7 of 8 rounds, one drop round. Real numbers.
const S19: TitleRaceInput = { totalRounds: 8, roundsScored: 7, drops: 1 };
const MR_SIR = { scores: [112, 111, 100, 100, 101, 100, 60] }; // 624, drops 60
const DAN_CRAN = { scores: [100, 57, 92, 85, 60, 76, 100] }; // 513, drops 57
const DINK_DONK = { scores: [64, 111, 112, 111, 112] }; // 510, missed two
const GUY = { scores: [80, 60, 16, 11, 64, 72, 92] }; // 384, drops 11
const JON_LAZ = { scores: [68, 100, 72, 60, 80, 80, 76] }; // 476, drops 60
const BRYAN = { scores: [9, 37, 41, 39, 41, 43, 41] }; // 242, drops 9
const JASON = { scores: [37, 41, 29, 37, 64] }; // 208, missed two
const BOOSTERSKI = { scores: [0, 15, 25, 33, 23, 15, 29] }; // 140
const MARVIN = { scores: [0, 29, 17, 19, 17, 13, 43] }; // 138

const bounds = (e: { scores: number[] }) => ({ floor: driverFloor(e, S19), ceiling: driverCeiling(e, S19) });

describe('driver floor and ceiling', () => {
  it('a blank last round brings the old drop back in rather than costing points', () => {
    expect(driverFloor(MR_SIR, S19)).toBe(684); // 624 + the 60 he was dropping
    expect(driverFloor(DAN_CRAN, S19)).toBe(570);
  });

  it('a driver dropping a missed round keeps every point of the next one', () => {
    expect(driverFloor(DINK_DONK, S19)).toBe(510);
    expect(driverCeiling(DINK_DONK, S19)).toBe(510 + MAX_ROUND_POINTS);
  });

  it('the best single round is a win with pole and fastest lap', () => {
    expect(MAX_ROUND_POINTS).toBe(112);
  });

  it('with no rounds left, floor and ceiling are both the counted total', () => {
    const done = { totalRounds: 7, roundsScored: 7, drops: 1 };
    expect(driverFloor(MR_SIR, done)).toBe(624);
    expect(driverCeiling(MR_SIR, done)).toBe(624);
  });

  it('takes penalties off both ends', () => {
    expect(driverFloor({ ...MR_SIR, penalty: 10 }, S19)).toBe(674);
  });
});

describe('titleStatuses', () => {
  it('calls the S19 D1 Gold title for Mr Sir with a round to go', () => {
    expect(titleStatuses([MR_SIR, DAN_CRAN, DINK_DONK].map(bounds))).toEqual(['champion', 'out', 'out']);
  });

  it('keeps the S19 D1 Silver fight open down to the last mathematical chance', () => {
    // Bryan's floor is 251. Boosterski can reach 252 with a perfect night;
    // Marvin tops out at 250.
    expect(titleStatuses([BRYAN, JASON, BOOSTERSKI, MARVIN].map(bounds))).toEqual([
      'contender',
      'contender',
      'contender',
      'out',
    ]);
  });

  it('treats a tie on the line as still alive', () => {
    expect(titleStatuses([{ floor: 100, ceiling: 120 }, { floor: 50, ceiling: 100 }])).toEqual([
      'contender',
      'contender',
    ]);
  });

  it('a lone entrant is the champion', () => {
    expect(titleStatuses([{ floor: 0, ceiling: 0 }])).toEqual(['champion']);
  });
});

describe('teams', () => {
  it('sums each driver’s own floor', () => {
    expect(teamFloor([MR_SIR, GUY], S19)).toBe(1008 + 60 + 11);
    expect(teamFloor([DAN_CRAN, JON_LAZ], S19)).toBe(989 + 57 + 60);
  });

  it('caps a two-driver team at a 1–2 finish, not two wins', () => {
    // 513 + 476 + 110 + 100 + both bonuses.
    expect(teamCeiling([DAN_CRAN, JON_LAZ], S19)).toBe(989 + 212);
  });

  it('keeps the S19 D1 teams title open between the top two', () => {
    const tse = [{ scores: [92, 85, 60, 80, 92, 60, 85] }, { scores: [54, 76, 80, 72, 48, 51, 23] }];
    const teams = [[MR_SIR, GUY], [DAN_CRAN, JON_LAZ], tse].map((m) => ({
      floor: teamFloor(m, S19),
      ceiling: teamCeiling(m, S19),
    }));
    expect(titleStatuses(teams)).toEqual(['contender', 'contender', 'out']);
  });
});
