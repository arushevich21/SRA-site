import type {
  EmperorResultListEntry,
  EmperorResultListPage,
} from '@sra/shared-types';

type RawResultListEntry = {
  track: string;
  manager_session_type: string;
  date: string;
  results_json_url: string;
};

type RawResultListResponse = {
  results: RawResultListEntry[];
  num_pages: number;
  current_page: number;
};

export type EmperorHealthcheck = {
  game: string;
  eventInProgress: boolean;
  currentSession: string | null;
  numConnectedDrivers: number;
  trackName: string | null;
};

export class EmperorClient {
  constructor(private baseUrl: string) {}

  async getHealthcheck(): Promise<EmperorHealthcheck> {
    const res = await fetch(`${this.baseUrl}/healthcheck.json`);
    if (!res.ok) throw new Error(`Emperor healthcheck failed: ${res.status}`);
    const raw = await res.json();
    return {
      game: raw.Game ?? '',
      eventInProgress: raw.EventInProgress ?? false,
      currentSession: raw.CurrentSession ?? null,
      numConnectedDrivers: raw.NumConnectedDrivers ?? 0,
      trackName: raw.TrackName ?? null,
    };
  }

  async getResultsList(page = 1): Promise<EmperorResultListPage> {
    const url = `${this.baseUrl}/api/results/list.json?page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Emperor results list failed: ${res.status}`);
    const raw: RawResultListResponse = await res.json();
    return {
      entries: raw.results.map(normalizeListEntry),
      currentPage: raw.current_page,
      numPages: raw.num_pages,
    };
  }

  async getAllResultsList(): Promise<EmperorResultListEntry[]> {
    const first = await this.getResultsList(1);
    const all = [...first.entries];
    for (let p = 2; p <= first.numPages; p++) {
      const page = await this.getResultsList(p);
      all.push(...page.entries);
    }
    return all;
  }

  async downloadResult(resultsJsonUrl: string): Promise<unknown> {
    const url = resultsJsonUrl.startsWith('http')
      ? resultsJsonUrl
      : `${this.baseUrl}${resultsJsonUrl}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Emperor result download failed: ${res.status} for ${url}`);
    return res.json();
  }
}

function normalizeListEntry(raw: RawResultListEntry): EmperorResultListEntry {
  return {
    track: raw.track,
    sessionType: raw.manager_session_type,
    date: raw.date,
    resultsJsonUrl: raw.results_json_url,
  };
}
