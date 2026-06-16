import { describe, it, expect, vi, afterEach } from 'vitest';
import { GridOSClient } from './client.js';
import { GridOSError } from '@sra/shared-types';

// ── fixtures ──────────────────────────────────────────────────────────────────

const RAW_TRACK = {
  id: 1,
  name: 'Red Bull Ring',
  in_game_name: 'red_bull_ring',
  game_id: 1,
  photo: null,
};

const RAW_RACE = {
  id: 57116,
  race_name: 'Round 1',
  display_name: 'Round 1',
  track: RAW_TRACK,
  starts_at: '2024-09-21T21:00:00.000Z',
  results_available: false,
  ended: true,
  published_at: null,
};

const RAW_CHAMPIONSHIP = {
  id: 9622,
  name: 'SRA GT3',
  start_date: '2024-09-01T00:00:00.000Z',
  end_date: null,
  capacity: 80,
  spots_taken: 26,
  teams_enabled: true,
  url: 'https://www.thesimgrid.com/championships/9622',
  results_url: 'https://www.thesimgrid.com/championships/9622/results',
  races: [RAW_RACE],
};

const RAW_STANDINGS_ENTRY = {
  id: 46962,
  team_id: 12285,
  display_name: 'Empresa Racing',
  active: true,
  participating_driver_ids: [101, 102],
  driver_pool_ids: [101, 102],
};

// Raw standings response is a 5-element mixed array: [TeamEntry[], [], null, {}, {pagination}]
const RAW_STANDINGS = [[RAW_STANDINGS_ENTRY], [], null, {}, {}];

// ── test helpers ──────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.example.com/v1';
const API_KEY = 'test-key';

function makeClient() {
  return new GridOSClient(BASE_URL, API_KEY);
}

type MockResponse = {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
};

function stubFetch(...responses: MockResponse[]) {
  let call = 0;
  const mock = vi.fn().mockImplementation(() => {
    const res = responses[Math.min(call, responses.length - 1)];
    call++;
    return Promise.resolve({
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      headers: { get: (name: string) => res.headers?.[name] ?? null },
      json: () => Promise.resolve(res.body ?? null),
    });
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ── request headers ───────────────────────────────────────────────────────────

describe('request headers', () => {
  it('sends Bearer token and Cloudflare-bypass headers on every request', async () => {
    const fetchMock = stubFetch({ status: 200, body: [] });
    await makeClient().getChampionships();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Bearer ${API_KEY}`);
    expect(headers['Accept']).toBe('application/json');
    expect(headers['User-Agent']).toMatch(/Mozilla/);
    expect(headers['Accept-Language']).toBeTruthy();
  });
});

// ── getChampionships ──────────────────────────────────────────────────────────

describe('getChampionships', () => {
  it('happy path: returns normalized list of championship summaries', async () => {
    stubFetch({ status: 200, body: [{ id: 9622, name: 'SRA GT3' }] });
    const result = await makeClient().getChampionships();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 9622, name: 'SRA GT3' });
  });

  it('returns an empty array when the list is empty', async () => {
    stubFetch({ status: 200, body: [] });
    expect(await makeClient().getChampionships()).toEqual([]);
  });
});

// ── getChampionship ───────────────────────────────────────────────────────────

describe('getChampionship', () => {
  it('happy path: normalizes all snake_case fields to camelCase', async () => {
    stubFetch({ status: 200, body: RAW_CHAMPIONSHIP });
    const result = await makeClient().getChampionship(9622);
    expect(result.id).toBe(9622);
    expect(result.startDate).toBe(RAW_CHAMPIONSHIP.start_date);
    expect(result.endDate).toBeNull();
    expect(result.spotsTaken).toBe(26);
    expect(result.teamsEnabled).toBe(true);
    expect(result.resultsUrl).toBe(RAW_CHAMPIONSHIP.results_url);
  });

  it('track is a SimGridTrack object, not a string', async () => {
    stubFetch({ status: 200, body: RAW_CHAMPIONSHIP });
    const result = await makeClient().getChampionship(9622);
    const track = result.races[0].track;
    expect(typeof track).toBe('object');
    expect(track.id).toBe(1);
    expect(track.name).toBe('Red Bull Ring');
    expect(track.inGameName).toBe('red_bull_ring');
  });

  it('races embed normalized race objects', async () => {
    stubFetch({ status: 200, body: RAW_CHAMPIONSHIP });
    const result = await makeClient().getChampionship(9622);
    const race = result.races[0];
    expect(race.id).toBe(57116);
    expect(race.name).toBe('Round 1');
    expect(race.displayName).toBe('Round 1');
    expect(race.resultsAvailable).toBe(false);
    expect(race.publishedAt).toBeNull();
  });
});

// ── getRace ───────────────────────────────────────────────────────────────────

describe('getRace', () => {
  it('happy path: returns normalized race', async () => {
    stubFetch({ status: 200, body: RAW_RACE });
    const result = await makeClient().getRace(57116);
    expect(result.id).toBe(57116);
    expect(result.name).toBe('Round 1');
    expect(result.ended).toBe(true);
    expect(result.publishedAt).toBeNull();
  });

  it('track is a SimGridTrack object with inGameName', async () => {
    stubFetch({ status: 200, body: RAW_RACE });
    const result = await makeClient().getRace(57116);
    expect(typeof result.track).toBe('object');
    expect(result.track.inGameName).toBe('red_bull_ring');
  });
});

// ── getChampionshipStandings ──────────────────────────────────────────────────

describe('getChampionshipStandings', () => {
  it('happy path: extracts entries from the 5-element mixed-array envelope', async () => {
    stubFetch({ status: 200, body: RAW_STANDINGS });
    const result = await makeClient().getChampionshipStandings(9622);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(46962);
    expect(result[0].teamId).toBe(12285);
    expect(result[0].displayName).toBe('Empresa Racing');
    expect(result[0].participatingDriverIds).toEqual([101, 102]);
  });

  it('throws GridOSError when response is not an array', async () => {
    stubFetch({ status: 200, body: { data: [] } });
    await expect(makeClient().getChampionshipStandings(9622)).rejects.toBeInstanceOf(GridOSError);
  });

  it('throws GridOSError when first element of the envelope is not an array', async () => {
    stubFetch({ status: 200, body: [null, [], null, {}, {}] });
    await expect(makeClient().getChampionshipStandings(9622)).rejects.toBeInstanceOf(GridOSError);
  });
});

// ── retry — 429 ───────────────────────────────────────────────────────────────

describe('retry — 429', () => {
  it('retries after the Retry-After delay and returns success', async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(
      { status: 429, headers: { 'Retry-After': '0' } },
      { status: 200, body: [{ id: 1, name: 'SRA' }] },
    );
    const promise = makeClient().getChampionships();
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result[0].id).toBe(1);
  });

  it('Retry-After is interpreted as seconds, not milliseconds', async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(
      { status: 429, headers: { 'Retry-After': '1' } },
      { status: 200, body: [] },
    );
    const promise = makeClient().getChampionships();
    // if sleep received raw header value (1ms), the retry would have fired by now
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // completing the full 1000ms sleep fires the retry
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await promise;
  });

  it('throws GridOSError(429) after exhausting all 3 attempts', async () => {
    vi.useFakeTimers();
    stubFetch(
      { status: 429, headers: { 'Retry-After': '0' } },
      { status: 429, headers: { 'Retry-After': '0' } },
      { status: 429, headers: { 'Retry-After': '0' } },
    );
    const promise = makeClient().getChampionships();
    // attach the rejection handler before advancing timers to avoid unhandled-rejection noise
    const assertion = expect(promise).rejects.toMatchObject({ status: 429 });
    await vi.runAllTimersAsync();
    await assertion;
  });
});

// ── retry — 5xx ───────────────────────────────────────────────────────────────

describe('retry — 5xx', () => {
  it('retries on 500 and succeeds on the second attempt', async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(
      { status: 500 },
      { status: 200, body: [{ id: 1, name: 'SRA' }] },
    );
    const promise = makeClient().getChampionships();
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result[0].id).toBe(1);
  });

  it('throws GridOSError after exhausting all 3 attempts', async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch({ status: 503 }, { status: 503 }, { status: 503 });
    const promise = makeClient().getChampionships();
    // attach before advancing to avoid unhandled-rejection noise
    const assertion = expect(promise).rejects.toMatchObject({ status: 503 });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('applies exponential backoff: 500ms then 1000ms between retries', async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch({ status: 500 }, { status: 500 }, { status: 200, body: [] });
    const promise = makeClient().getChampionships();

    // first failure → sleep(500ms * 2^0 = 500ms)
    await vi.advanceTimersByTimeAsync(499);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // timer fires → second attempt
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // second failure → sleep(500ms * 2^1 = 1000ms)
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); // timer fires → third attempt
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await promise;
  });
});

// ── retry — network error ─────────────────────────────────────────────────────

describe('retry — network error', () => {
  it('retries on fetch rejection and throws GridOSError(0) after exhaustion', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);
    const promise = makeClient().getChampionships();
    // attach before advancing to avoid unhandled-rejection noise
    const assertion = expect(promise).rejects.toMatchObject({ status: 0, endpoint: '/championships' });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

// ── 4xx — non-retryable ───────────────────────────────────────────────────────

describe('4xx — non-retryable', () => {
  it('throws GridOSError(401) immediately without retrying', async () => {
    const fetchMock = stubFetch({ status: 401 });
    await expect(makeClient().getChampionships()).rejects.toMatchObject({
      status: 401,
      endpoint: '/championships',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws GridOSError(404) immediately for a missing resource', async () => {
    const fetchMock = stubFetch({ status: 404 });
    await expect(makeClient().getChampionship(9999)).rejects.toMatchObject({
      status: 404,
      endpoint: '/championships/9999',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('401 and 404 carry different status codes so callers can distinguish them', async () => {
    stubFetch({ status: 401 });
    const authErr = (await makeClient().getChampionship(9622).catch((e: unknown) => e)) as GridOSError;

    stubFetch({ status: 404 });
    const notFoundErr = (await makeClient().getChampionship(9999).catch((e: unknown) => e)) as GridOSError;

    expect(authErr.status).toBe(401);
    expect(notFoundErr.status).toBe(404);
    expect(authErr.status).not.toBe(notFoundErr.status);
  });
});
