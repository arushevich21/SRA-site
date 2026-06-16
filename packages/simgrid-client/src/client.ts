import type {
  SimGridChampionship,
  SimGridChampionshipSummary,
  SimGridRace,
  SimGridTrack,
  SimGridStandingsEntry,
} from '@sra/shared-types';
import { GridOSError } from '@sra/shared-types';

// ── raw API shapes — private, never exported ──────────────────────────────────

type RawTrack = {
  id: number;
  name: string;
  in_game_name: string;
};

type RawRace = {
  id: number;
  race_name: string;
  display_name: string;
  track: RawTrack;
  starts_at: string;
  results_available: boolean;
  ended: boolean;
  published_at: string | null;
};

type RawChampionship = {
  id: number;
  name: string;
  start_date: string;
  end_date: string | null;
  capacity: number;
  spots_taken: number;
  teams_enabled: boolean;
  url: string;
  results_url: string;
  races: RawRace[];
};

type RawChampionshipSummary = {
  id: number;
  name: string;
};

type RawStandingsEntry = {
  id: number;
  team_id: number;
  display_name: string;
  active: boolean;
  participating_driver_ids: number[];
  driver_pool_ids: number[];
};

// ── normalizers — raw API → NVM ───────────────────────────────────────────────

function normalizeTrack(raw: RawTrack): SimGridTrack {
  return {
    id: raw.id,
    name: raw.name,
    inGameName: raw.in_game_name,
  };
}

function normalizeRace(raw: RawRace): SimGridRace {
  return {
    id: raw.id,
    name: raw.race_name,
    displayName: raw.display_name,
    track: normalizeTrack(raw.track), // SimGridTrack object, not a string
    startsAt: raw.starts_at,
    resultsAvailable: raw.results_available,
    ended: raw.ended,
    publishedAt: raw.published_at,
  };
}

function normalizeChampionship(raw: RawChampionship): SimGridChampionship {
  return {
    id: raw.id,
    name: raw.name,
    startDate: raw.start_date,
    endDate: raw.end_date,
    capacity: raw.capacity,
    spotsTaken: raw.spots_taken,
    teamsEnabled: raw.teams_enabled,
    url: raw.url,
    resultsUrl: raw.results_url,
    races: raw.races.map(normalizeRace),
  };
}

function normalizeChampionshipSummary(raw: RawChampionshipSummary): SimGridChampionshipSummary {
  return { id: raw.id, name: raw.name };
}

function normalizeStandingsEntry(raw: RawStandingsEntry): SimGridStandingsEntry {
  return {
    id: raw.id,
    teamId: raw.team_id,
    displayName: raw.display_name,
    active: raw.active,
    participatingDriverIds: raw.participating_driver_ids,
    driverPoolIds: raw.driver_pool_ids,
  };
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const CLOUDFLARE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
} as const;

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── client ────────────────────────────────────────────────────────────────────

export class GridOSClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  async getChampionships(): Promise<SimGridChampionshipSummary[]> {
    const raw = await this.request('/championships') as RawChampionshipSummary[];
    return raw.map(normalizeChampionshipSummary);
  }

  async getChampionship(id: number): Promise<SimGridChampionship> {
    const raw = await this.request(`/championships/${id}`) as RawChampionship;
    return normalizeChampionship(raw);
  }

  async getRace(id: number): Promise<SimGridRace> {
    const raw = await this.request(`/races/${id}`) as RawRace;
    return normalizeRace(raw);
  }

  async getChampionshipStandings(id: number): Promise<SimGridStandingsEntry[]> {
    const path = `/championships/${id}/standings`;
    const raw = await this.request(path);
    // Raw response is a 5-element mixed array: [TeamEntry[], [], null, {}, {pagination}]
    if (!Array.isArray(raw) || !Array.isArray(raw[0])) {
      throw new GridOSError(0, path, 'Unexpected standings response shape');
    }
    return (raw[0] as RawStandingsEntry[]).map(normalizeStandingsEntry);
  }

  // ── request with retry / backoff ────────────────────────────────────────────

  private async request(path: string): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      ...CLOUDFLARE_HEADERS,
    };

    let lastError: GridOSError | undefined;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, { headers });

        if (res.status === 429) {
          const retryAfterSec = parseInt(res.headers.get('Retry-After') ?? '1', 10);
          lastError = new GridOSError(429, path, `Rate limited; retry after ${retryAfterSec}s`);
          if (attempt < MAX_ATTEMPTS - 1) {
            await sleep(retryAfterSec * 1000);
          }
          continue;
        }

        if (res.status >= 500) {
          lastError = new GridOSError(res.status, path, `Server error ${res.status}`);
          if (attempt < MAX_ATTEMPTS - 1) {
            await sleep(BASE_BACKOFF_MS * 2 ** attempt);
          }
          continue;
        }

        if (!res.ok) {
          // 4xx (except 429): non-retryable
          throw new GridOSError(res.status, path, `HTTP ${res.status}`);
        }

        return await res.json();
      } catch (err) {
        if (err instanceof GridOSError) throw err;
        // Network error (DNS failure, timeout, connection refused)
        const msg = err instanceof Error ? err.message : String(err);
        lastError = new GridOSError(0, path, msg);
        if (attempt < MAX_ATTEMPTS - 1) {
          await sleep(BASE_BACKOFF_MS * 2 ** attempt);
        }
      }
    }

    throw lastError ?? new GridOSError(0, path, 'Request failed after max attempts');
  }
}
