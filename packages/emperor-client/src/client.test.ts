import { describe, it, expect, vi, afterEach } from 'vitest';
import { EmperorClient } from './client.js';

const BASE_URL = 'https://emperor.example.com';

type MockResponse = {
  status: number;
  body?: unknown;
};

function stubFetch(...responses: MockResponse[]) {
  let call = 0;
  const mock = vi.fn().mockImplementation(() => {
    const res = responses[Math.min(call, responses.length - 1)];
    call++;
    return Promise.resolve({
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      json: () => Promise.resolve(res.body ?? null),
    });
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Throttling is tested in isolation below — default test clients to no delay
// so the rest of the suite isn't waiting on it.
function makeClient() {
  return new EmperorClient(BASE_URL, { minRequestIntervalMs: 0 });
}

// ── getResultsList pagination ───────────────────────────────────────────────
//
// Emperor's results list API is 0-indexed: requesting the first page means
// page=0 (current_page: 0 in the response), not page=1. The default used to
// be page=1, which silently returned an empty page on single-page result
// sets — this regression test pins the corrected default.

describe('getResultsList', () => {
  it('defaults to page=0, not page=1', async () => {
    const fetchMock = stubFetch({
      status: 200,
      body: { num_pages: 1, current_page: 0, results: [] },
    });
    await makeClient().getResultsList();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('page=0');
  });

  it('treats a null `results` field as an empty page rather than throwing', async () => {
    stubFetch({ status: 200, body: { num_pages: 0, current_page: 1, results: null } });
    const result = await makeClient().getResultsList(1);
    expect(result.entries).toEqual([]);
  });

  it('normalizes snake_case fields to camelCase', async () => {
    stubFetch({
      status: 200,
      body: {
        num_pages: 1,
        current_page: 0,
        results: [
          {
            track: 'Road Atlanta',
            manager_session_type: 'Qualifying',
            date: '2026-06-30T01:37:46Z',
            results_json_url: '/server/0/results/download/results_20260630_013746_qualify.json',
          },
        ],
      },
    });
    const result = await makeClient().getResultsList(0);
    expect(result.entries).toEqual([
      {
        track: 'Road Atlanta',
        sessionType: 'Qualifying',
        date: '2026-06-30T01:37:46Z',
        resultsJsonUrl: '/server/0/results/download/results_20260630_013746_qualify.json',
      },
    ]);
  });
});

// ── getAllResultsList ────────────────────────────────────────────────────────

describe('getAllResultsList', () => {
  it('starts at page 0 and includes its entries (regression: used to skip page 0)', async () => {
    const fetchMock = stubFetch({
      status: 200,
      body: {
        num_pages: 1,
        current_page: 0,
        results: [
          {
            track: 'Road Atlanta',
            manager_session_type: 'Race',
            date: '2026-06-30T02:11:11Z',
            results_json_url: '/server/0/results/download/results_20260630_021111_race.json',
          },
        ],
      },
    });
    const all = await makeClient().getAllResultsList();
    expect(all).toHaveLength(1);
    expect(all[0].track).toBe('Road Atlanta');
    // single-page result set — must not request page 1 (out of range)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('page=0');
  });

  it('walks pages 0..numPages-1 and aggregates entries from every page', async () => {
    const fetchMock = stubFetch(
      {
        status: 200,
        body: {
          num_pages: 3,
          current_page: 0,
          results: [{ track: 'A', manager_session_type: 'Race', date: 'd0', results_json_url: '/0' }],
        },
      },
      {
        status: 200,
        body: {
          num_pages: 3,
          current_page: 1,
          results: [{ track: 'B', manager_session_type: 'Race', date: 'd1', results_json_url: '/1' }],
        },
      },
      {
        status: 200,
        body: {
          num_pages: 3,
          current_page: 2,
          results: [{ track: 'C', manager_session_type: 'Race', date: 'd2', results_json_url: '/2' }],
        },
      },
    );
    const all = await makeClient().getAllResultsList();
    expect(all.map((e) => e.track)).toEqual(['A', 'B', 'C']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toContain('page=2');
  });
});

// ── request throttling ───────────────────────────────────────────────────────
//
// Emperor's documented limit is ~2 req/min. Nothing in this client enforced
// that before — every consumer (including the validation script) had to
// hand-roll its own sleep(). This pins the client's own spacing so that
// becomes true for every consumer automatically.

describe('request throttling', () => {
  it('does not delay the first request on a fresh client', async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch({ status: 200, body: { num_pages: 1, current_page: 0, results: [] } });
    const client = new EmperorClient(BASE_URL, { minRequestIntervalMs: 31_000 });
    await client.getResultsList(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('delays a second request until minRequestIntervalMs has elapsed', async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch({ status: 200, body: { num_pages: 1, current_page: 0, results: [] } });
    const client = new EmperorClient(BASE_URL, { minRequestIntervalMs: 31_000 });

    await client.getResultsList(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = client.getResultsList(0);
    await vi.advanceTimersByTimeAsync(30_999);
    expect(fetchMock).toHaveBeenCalledTimes(1); // not yet — still inside the window

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2); // window elapsed — fires now

    await second;
    vi.useRealTimers();
  });

  it('does not add a delay once the interval has already elapsed naturally', async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch({ status: 200, body: { num_pages: 1, current_page: 0, results: [] } });
    const client = new EmperorClient(BASE_URL, { minRequestIntervalMs: 1_000 });

    await client.getResultsList(0);
    await vi.advanceTimersByTimeAsync(5_000); // well past the interval
    await client.getResultsList(0);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe('getChampionshipStandings', () => {
  // Shapes taken from a live ACCSM response (LIAW championship, accsm1).
  // The point of this fixture is what the TEAM rows do NOT contain.
  const liveShape = {
    DriverStandings: {
      '': [
        {
          DriverName: 'Joel Moffatt',
          DriverGUID: 'S76561197960416683',
          CarModel: 'Ferrari 296 GT3',
          Points: 805,
          PointsPenalty: 0,
          Position: 1,
          Teams: {
            'BOP THE LEXUS': {
              EventIDs: {
                'ev-zandvoort': { RaceNumber: 64, Points: 180 },
                'ev-ricard': { RaceNumber: 64, Points: 192 },
                'ev-bathurst': { RaceNumber: 64, Points: 157 },
              },
              Points: 529,
            },
          },
          IgnoredEventIDs: { 'ev-bathurst': {} },
        },
      ],
    },
    TeamStandings: {
      // No Position key — Emperor genuinely does not send one for teams.
      '': [
        { TeamName: 'BOP THE LEXUS', Points: 805, PointsPenalty: 0, IgnoredEventIDs: { 'ev-bathurst': {} } },
        { TeamName: 'Balkan Blast', Points: 723, PointsPenalty: 0, IgnoredEventIDs: {} },
        { TeamName: 'fake race car, real pain', Points: 654, PointsPenalty: 0, IgnoredEventIDs: {} },
      ],
    },
  };

  it('derives team positions from array order, since Emperor sends none', async () => {
    stubFetch({ status: 200, body: liveShape });
    const standings = await new EmperorClient(BASE_URL).getChampionshipStandings('abc');

    expect(standings.teamStandings[''].map((t) => [t.position, t.teamName])).toEqual([
      [1, 'BOP THE LEXUS'],
      [2, 'Balkan Blast'],
      [3, 'fake race car, real pain'],
    ]);
  });

  it('preserves Emperor’s own team order rather than re-sorting on points', async () => {
    // A tie Emperor has already resolved one way must not be reordered by us.
    stubFetch({
      status: 200,
      body: {
        DriverStandings: { '': [] },
        TeamStandings: {
          '': [
            { TeamName: 'We are so Jason', Points: 654, PointsPenalty: 0 },
            { TeamName: 'fake race car, real pain', Points: 654, PointsPenalty: 0 },
          ],
        },
      },
    });
    const standings = await new EmperorClient(BASE_URL).getChampionshipStandings('abc');
    expect(standings.teamStandings[''].map((t) => t.teamName)).toEqual([
      'We are so Jason',
      'fake race car, real pain',
    ]);
  });

  it('reads driver positions from Emperor, which does send them', async () => {
    stubFetch({ status: 200, body: liveShape });
    const standings = await new EmperorClient(BASE_URL).getChampionshipStandings('abc');
    expect(standings.driverStandings[''][0].position).toBe(1);
    expect(standings.driverStandings[''][0].steamId).toBe('S76561197960416683');
  });

  it('keeps per-event points and the dropped event on driver rows', async () => {
    stubFetch({ status: 200, body: liveShape });
    const [joel] = (await new EmperorClient(BASE_URL).getChampionshipStandings('abc')).driverStandings[''];
    expect(joel.eventPoints).toEqual({ 'ev-zandvoort': 180, 'ev-ricard': 192, 'ev-bathurst': 157 });
    expect(joel.droppedEventIds).toEqual(['ev-bathurst']);
  });

  it('keeps the dropped event on team rows, and tolerates its absence', async () => {
    stubFetch({ status: 200, body: liveShape });
    const teams = (await new EmperorClient(BASE_URL).getChampionshipStandings('abc')).teamStandings[''];
    expect(teams[0].droppedEventIds).toEqual(['ev-bathurst']);
    expect(teams[1].droppedEventIds).toEqual([]);
  });

  it('sums the same event across teams for a driver who switched mid-season', async () => {
    stubFetch({
      status: 200,
      body: {
        DriverStandings: {
          '': [
            {
              DriverName: 'X', DriverGUID: 'S1', CarModel: null, Points: 0, PointsPenalty: 0, Position: 1,
              Teams: {
                A: { EventIDs: { e1: { Points: 10 } } },
                B: { EventIDs: { e1: { Points: 5 }, e2: { Points: 7 } } },
              },
            },
          ],
        },
        TeamStandings: { '': [] },
      },
    });
    const [x] = (await new EmperorClient(BASE_URL).getChampionshipStandings('abc')).driverStandings[''];
    expect(x.eventPoints).toEqual({ e1: 15, e2: 7 });
    expect(x.teamEventPoints).toEqual({ A: { e1: 10 }, B: { e1: 5, e2: 7 } });
    expect(x.teamNames).toEqual(['A', 'B']);
  });

  it('treats a null class group as empty (Emperor returns null, not [])', async () => {
    stubFetch({
      status: 200,
      body: { DriverStandings: { '': null }, TeamStandings: { '': null } },
    });
    const standings = await new EmperorClient(BASE_URL).getChampionshipStandings('abc');
    expect(standings.driverStandings['']).toEqual([]);
    expect(standings.teamStandings['']).toEqual([]);
  });
});
