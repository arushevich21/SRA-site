import type {
  EmperorResultListEntry,
  EmperorResultListPage,
  EmperorChampionshipStandings,
  EmperorDriverStanding,
  EmperorTeamStanding,
} from '@sra/shared-types';

type RawResultListEntry = {
  track: string;
  // AC Evo's results list uses manager_session_type; ACCSM's uses session_type.
  // Accept either — see normalizeListEntry.
  manager_session_type?: string;
  session_type?: string;
  date: string;
  results_json_url: string;
};

type RawResultListResponse = {
  results: RawResultListEntry[];
  num_pages: number;
  current_page: number;
};

type RawDriverStanding = {
  DriverName: string;
  DriverGUID: string;
  CarModel: string | null;
  Points: number;
  PointsPenalty: number;
  Position: number;
};

type RawTeamStanding = {
  TeamName: string;
  Points: number;
  PointsPenalty: number;
  Position: number;
};

type RawChampionshipStandingsResponse = {
  DriverStandings: Record<string, RawDriverStanding[]>;
  TeamStandings: Record<string, RawTeamStanding[]>;
};

export type EmperorHealthcheck = {
  game: string;
  eventInProgress: boolean;
  currentSession: string | null;
  numConnectedDrivers: number;
  trackName: string | null;
};

export type EmperorClientOptions = {
  // Minimum gap between consecutive requests made by this client instance.
  // Emperor's documented limit is ~2 req/min; default stays safely under that.
  minRequestIntervalMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class EmperorClient {
  private lastRequestAt = 0;

  constructor(
    private baseUrl: string,
    private opts: EmperorClientOptions = {},
  ) {}

  // Every request the client makes goes through here, so consumers never need
  // to hand-roll their own spacing/sleeps — see scripts/validate-ac-evo-lap-flags.ts
  // for what that looked like before this existed.
  private async throttledFetch(url: string): Promise<Response> {
    const minInterval = this.opts.minRequestIntervalMs ?? 31_000;
    const wait = this.lastRequestAt + minInterval - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();
    return fetch(url);
  }

  async getHealthcheck(): Promise<EmperorHealthcheck> {
    const res = await this.throttledFetch(`${this.baseUrl}/healthcheck.json`);
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

  // Emperor's results list API is 0-indexed (current_page: 0 for the first page).
  async getResultsList(page = 0): Promise<EmperorResultListPage> {
    const url = `${this.baseUrl}/api/results/list.json?page=${page}`;
    const res = await this.throttledFetch(url);
    if (!res.ok) throw new Error(`Emperor results list failed: ${res.status}`);
    const raw: RawResultListResponse = await res.json();
    return {
      entries: (raw.results ?? []).map(normalizeListEntry),
      currentPage: raw.current_page,
      numPages: raw.num_pages,
    };
  }

  async getAllResultsList(): Promise<EmperorResultListEntry[]> {
    const first = await this.getResultsList(0);
    const all = [...first.entries];
    for (let p = 1; p < first.numPages; p++) {
      const page = await this.getResultsList(p);
      all.push(...page.entries);
    }
    return all;
  }

  async downloadResult(resultsJsonUrl: string): Promise<unknown> {
    const url = resultsJsonUrl.startsWith('http')
      ? resultsJsonUrl
      : `${this.baseUrl}${resultsJsonUrl}`;
    const res = await this.throttledFetch(url);
    if (!res.ok) throw new Error(`Emperor result download failed: ${res.status} for ${url}`);
    return res.json();
  }

  async getChampionshipStandings(championshipId: string): Promise<EmperorChampionshipStandings> {
    const url = `${this.baseUrl}/api/championship/${championshipId}/standings.json`;
    const res = await this.throttledFetch(url);
    if (!res.ok) throw new Error(`Emperor championship standings failed: ${res.status}`);
    const raw: RawChampionshipStandingsResponse = await res.json();
    return normalizeChampionshipStandings(raw);
  }
}

function normalizeListEntry(raw: RawResultListEntry): EmperorResultListEntry {
  return {
    track: raw.track,
    sessionType: raw.manager_session_type ?? raw.session_type ?? '',
    date: raw.date,
    resultsJsonUrl: raw.results_json_url,
  };
}

function normalizeChampionshipStandings(
  raw: RawChampionshipStandingsResponse,
): EmperorChampionshipStandings {
  if (typeof raw?.DriverStandings !== 'object' || raw.DriverStandings === null) {
    throw new Error('Emperor championship standings: malformed DriverStandings shape');
  }
  if (typeof raw?.TeamStandings !== 'object' || raw.TeamStandings === null) {
    throw new Error('Emperor championship standings: malformed TeamStandings shape');
  }

  // Emperor returns null (not []) for a class with no entries — e.g. TeamStandings
  // on a single-driver cup with no teams.
  const driverStandings: Record<string, EmperorDriverStanding[]> = {};
  for (const [className, entries] of Object.entries(raw.DriverStandings)) {
    driverStandings[className] = (entries ?? []).map((d) => ({
      position: d.Position,
      driverName: d.DriverName,
      steamId: d.DriverGUID,
      carModel: d.CarModel ?? null,
      points: d.Points,
      pointsPenalty: d.PointsPenalty,
    }));
  }

  const teamStandings: Record<string, EmperorTeamStanding[]> = {};
  for (const [className, entries] of Object.entries(raw.TeamStandings)) {
    teamStandings[className] = (entries ?? []).map((t) => ({
      position: t.Position,
      teamName: t.TeamName,
      points: t.Points,
      pointsPenalty: t.PointsPenalty,
    }));
  }

  return { driverStandings, teamStandings };
}
