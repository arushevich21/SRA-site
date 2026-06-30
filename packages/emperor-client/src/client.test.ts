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

function makeClient() {
  return new EmperorClient(BASE_URL);
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
