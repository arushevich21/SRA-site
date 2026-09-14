import { describe, it, expect } from 'vitest';
import {
  matchAccRoundsToResultEventsFrom,
  SPLIT_NIGHT_MATCH_WINDOW_MS,
  type AccRaceEventSummary,
} from './round-match.js';

const D1_GUID = '66ec4e93-75b4-498c-bd66-8d66267af36c';
const D2_GUID = 'a81898a5-0330-4e28-8881-34a0d72f2d04';

// 9:00 PM Eastern on the given day, as the UTC instant acc_race_sessions
// records. 2026-09-22 is EDT (UTC-4), so 21:00 local = 01:00 UTC next day.
function easternNightUtc(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1, 1, 0, 0)).toISOString();
}

function event(
  eventKey: string,
  date: string,
  championshipId: string | null,
  track = 'Silverstone',
): AccRaceEventSummary {
  return {
    eventKey,
    track,
    serverName: null,
    date,
    championshipId,
    seasonId: null,
    sessionTypes: ['Race'],
  };
}

// Round 1: D1/D3 Tuesday 9/22, D2/D4 Wednesday 9/23 — same track.
const TUESDAY_RACE = event('ev-d1', easternNightUtc('2026-09-22'), D1_GUID);
const WEDNESDAY_RACE = event('ev-d2', easternNightUtc('2026-09-23'), D2_GUID);
const EVENTS = [TUESDAY_RACE, WEDNESDAY_RACE];

const scheduleFor = (date: string) => [{ round: 1, track: 'Silverstone', date }];

describe('split-night round matching', () => {
  it("matches each division to its own night via its own championship id", () => {
    const d1 = matchAccRoundsToResultEventsFrom(
      EVENTS,
      scheduleFor('2026-09-22T21:00:00'),
      D1_GUID,
      SPLIT_NIGHT_MATCH_WINDOW_MS,
    );
    const d2 = matchAccRoundsToResultEventsFrom(
      EVENTS,
      scheduleFor('2026-09-23T21:00:00'),
      D2_GUID,
      SPLIT_NIGHT_MATCH_WINDOW_MS,
    );

    expect(d1.get(1)).toBe('ev-d1');
    expect(d2.get(1)).toBe('ev-d2');
  });

  it('does not cross-match nights when ACCSM tagged no championship (Custom Race)', () => {
    // This is the case the championship-id pass cannot help with, and the one
    // the default 48h window got wrong: Tuesday and Wednesday are ~24h apart.
    const untagged = [
      event('ev-tue', easternNightUtc('2026-09-22'), null),
      event('ev-wed', easternNightUtc('2026-09-23'), null),
    ];

    const d1 = matchAccRoundsToResultEventsFrom(
      untagged,
      scheduleFor('2026-09-22T21:00:00'),
      null,
      SPLIT_NIGHT_MATCH_WINDOW_MS,
    );
    const d2 = matchAccRoundsToResultEventsFrom(
      untagged,
      scheduleFor('2026-09-23T21:00:00'),
      null,
      SPLIT_NIGHT_MATCH_WINDOW_MS,
    );

    expect(d1.get(1)).toBe('ev-tue');
    expect(d2.get(1)).toBe('ev-wed');
  });

  it('would cross-match at the default 48h window — why the narrow one exists', () => {
    // Regression guard: proves the window is load-bearing, not decoration.
    // With 48h both nights are candidates and the nearest-wins tiebreak is the
    // only thing separating them — which fails as soon as a race runs late.
    const untagged = [event('ev-wed', easternNightUtc('2026-09-23'), null)];
    const wideOpen = matchAccRoundsToResultEventsFrom(
      untagged,
      scheduleFor('2026-09-22T21:00:00'), // D1's Tuesday
      null,
    );
    expect(wideOpen.get(1)).toBe('ev-wed'); // wrong division's race

    const narrow = matchAccRoundsToResultEventsFrom(
      untagged,
      scheduleFor('2026-09-22T21:00:00'),
      null,
      SPLIT_NIGHT_MATCH_WINDOW_MS,
    );
    expect(narrow.has(1)).toBe(false); // correctly unlinked
  });

  it('accepts every division id at once, for "does this round have any results"', () => {
    const anyDivision = matchAccRoundsToResultEventsFrom(
      EVENTS,
      scheduleFor('2026-09-22T21:00:00'),
      [D1_GUID, D2_GUID],
    );
    expect(anyDivision.get(1)).toBe('ev-d1');
  });

  it('ignores events with a null championship id when ids are supplied', () => {
    const mixed = [event('ev-untagged', easternNightUtc('2026-09-22'), null)];
    const matches = matchAccRoundsToResultEventsFrom(
      mixed,
      scheduleFor('2026-09-22T21:00:00'),
      [D1_GUID],
      SPLIT_NIGHT_MATCH_WINDOW_MS,
    );
    // Falls through to the track pass, which still finds it — the point is
    // that a null championshipId never counts as matching a supplied id.
    expect(matches.get(1)).toBe('ev-untagged');
  });
});
