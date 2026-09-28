import { EMPEROR_ACC_BASE_URLS, EMPEROR_ACEVO_BASE_URL } from './emperor';
import { parseServerPurpose } from './server-purpose';
import { curatedPurpose } from '@/content/server-purposes';

// Live fleet status across every sim whose servers SRA actually hosts.
//
// The thing to understand here: one ACCSM *host* is not one race server. Each
// manager instance runs several, and they're enumerated in the healthcheck's
// `Servers` map keyed "0".."n" — accsm1 carries SRAM1/3/5/7, accsm2 carries
// SRAM2/4/6, sram1acevo carries the single AC Evo server. The old
// /api/acc/server-status derived a label from the HOSTNAME instead
// (accsm1 -> "SRAM1"), which is why the site only ever showed two servers and
// why the other five cards were just dead hosts rendered offline.
//
// The healthcheck already carries live track, session, driver count and
// championship name, so there's no need to infer "last raced" from each
// server's results list the way the old route did — one upstream call per
// host, not two.

export type FleetServerState = 'racing' | 'up' | 'idle';

export type FleetServer = {
  /** Short tag, e.g. "SRAM3" — pulled out of ServerName when it's embedded. */
  name: string;
  /** Full in-game browser name, e.g. "#SRAgg | Sim Racing Alliance | ... | #SRAM1". */
  fullName: string;
  /** Which manager instance serves it, e.g. "ACCSM1". */
  host: string;
  game: string;
  state: FleetServerState;
  drivers: number;
  session: string | null;
  trackName: string | null;
  championship: string | null;
  /** null when the manager doesn't report GameData (AC Evo doesn't). */
  isPrivate: boolean | null;
  /** e.g. "GT3 Free Practice · Quali conditions". null when unknown. */
  purpose: string | null;
  /**
   * 'curated' = from content/server-purposes.ts, authoritative.
   * 'observed' = parsed from the last COMPLETED session's advertised name, so
   * it lags a reconfiguration until a session finishes there. The UI says so
   * rather than presenting it as live config.
   */
  purposeSource: 'curated' | 'observed' | null;
  /** ISO date of the session `purpose` was observed from, when observed. */
  purposeObservedAt: string | null;
};

/** A manager instance we couldn't reach at all — its servers are unknowable. */
export type FleetHostDown = { host: string; game: string };

export type FleetStatus = { servers: FleetServer[]; hostsDown: FleetHostDown[] };

type HostDescriptor = { host: string; baseUrl: string; game: string };

function accsmHostLabel(baseUrl: string): string {
  const m = baseUrl.match(/accsm(\d+)/i);
  return m ? `ACCSM${m[1]}` : baseUrl.replace(/^https?:\/\//, '').split('.')[0].toUpperCase();
}

const FLEET: HostDescriptor[] = [
  ...EMPEROR_ACC_BASE_URLS.map((baseUrl) => ({ host: accsmHostLabel(baseUrl), baseUrl, game: 'ACC' })),
  // Single manager instance for AC Evo, so a short label is enough — the
  // host line exists to say which ACCSM instance to open, not to echo the
  // hostname back.
  { host: 'ACEVO', baseUrl: EMPEROR_ACEVO_BASE_URL, game: 'AC Evo' },
];

const FETCH_TIMEOUT_MS = 8000;
export const FLEET_REVALIDATE_SECONDS = 60;

type HealthcheckServer = {
  ServerName?: string;
  EventInProgress?: boolean;
  EventIsChampionship?: boolean;
  ChampionshipName?: string;
  NumConnectedDrivers?: number;
  CurrentSession?: string;
  TrackName?: string;
  GameData?: { IsPrivate?: boolean } | null;
};

type Healthcheck = { OK?: boolean; Servers?: Record<string, HealthcheckServer> };

type ResultsListRow = { server_id?: number; date?: string; results_json_url?: string };
type ResultsList = { results?: ResultsListRow[] };

// Server CONFIG changes far more slowly than server status, so the purpose
// lookup gets its own long cache window. At 60s it would mean 8 extra upstream
// fetches a minute to re-learn something that changes a few times a season.
const PURPOSE_REVALIDATE_SECONDS = 3600;
// The newest session per server usually lands on page 0, but an idle box (a
// championship-only server) can be pushed off it. Two pages is a reasonable
// stopping point — beyond that a server is idle enough that a curated label is
// the right answer anyway.
const PURPOSE_RESULT_PAGES = 2;

async function cachedJson<T>(url: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    // ACC writes these files with a UTF-8 BOM, which JSON.parse rejects.
    const text = (await res.text()).replace(/^\uFEFF/, '');
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Newest advertised server name per server_id for one host. The healthcheck
 * only gives the manager's internal label, so the advertised name — the one
 * encoding what the box is for — has to come from a completed session.
 */
async function fetchAdvertisedNames(
  baseUrl: string,
): Promise<Map<string, { name: string; date: string | null }>> {
  const newest = new Map<string, ResultsListRow>();

  for (let page = 0; page < PURPOSE_RESULT_PAGES; page++) {
    // Emperor's results API is 0-indexed and newest-first.
    const list = await cachedJson<ResultsList>(
      `${baseUrl}/api/results/list.json?page=${page}`,
      PURPOSE_REVALIDATE_SECONDS,
    );
    if (!list?.results?.length) break;
    for (const row of list.results) {
      const key = String(row.server_id ?? '');
      if (key && !newest.has(key)) newest.set(key, row);
    }
  }

  const entries = await Promise.all(
    [...newest.entries()].map(async ([key, row]) => {
      if (!row.results_json_url) return null;
      const result = await cachedJson<{ serverName?: string }>(
        `${baseUrl}${row.results_json_url}`,
        PURPOSE_REVALIDATE_SECONDS,
      );
      if (!result?.serverName) return null;
      return [key, { name: result.serverName, date: row.date ?? null }] as const;
    }),
  );

  return new Map(entries.filter((e): e is NonNullable<typeof e> => e !== null));
}

// "#SRAgg | Sim Racing Alliance | Main Server #1 | #SRAM1" -> "SRAM1".
// ACC already reports the bare tag, so this is a no-op there.
export function shortServerName(fullName: string): string {
  const m = fullName.match(/#?\b(SRAM\d+)\b/i);
  return m ? m[1].toUpperCase() : fullName;
}

/** Sorts SRAM1..SRAM7 numerically regardless of which host reported them. */
function sramNumber(name: string): number {
  const m = name.match(/SRAM(\d+)/i);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

async function fetchHost(
  d: HostDescriptor,
): Promise<{ servers: FleetServer[]; down: boolean }> {
  let hc: Healthcheck | null = null;
  try {
    const res = await fetch(`${d.baseUrl}/healthcheck.json`, {
      next: { revalidate: FLEET_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.ok) hc = (await res.json()) as Healthcheck;
  } catch {
    hc = null;
  }

  if (!hc?.Servers) return { servers: [], down: true };

  // Best-effort: a host that answers the healthcheck but not the results API
  // still yields full status, just without purpose labels.
  const advertised = await fetchAdvertisedNames(d.baseUrl);

  const servers = Object.entries(hc.Servers).map(([serverId, s]): FleetServer => {
    const fullName = s.ServerName ?? 'Unnamed server';
    // -1 means the manager has no live count (the event isn't running), which
    // is not the same as "zero drivers connected" — clamp, don't render it.
    const drivers = Math.max(0, s.NumConnectedDrivers ?? 0);
    const running = s.EventInProgress ?? false;

    const name = shortServerName(fullName);
    const seen = advertised.get(serverId);
    const curated = curatedPurpose(d.game, name);
    const observed = parseServerPurpose(seen?.name);

    return {
      name,
      fullName,
      host: d.host,
      game: d.game,
      state: !running ? 'idle' : drivers > 0 ? 'racing' : 'up',
      drivers,
      session: s.CurrentSession?.trim() ? s.CurrentSession : null,
      trackName: s.TrackName?.trim() ? s.TrackName : null,
      championship: s.EventIsChampionship && s.ChampionshipName ? s.ChampionshipName : null,
      isPrivate: s.GameData ? (s.GameData.IsPrivate ?? null) : null,
      purpose: curated ?? observed,
      purposeSource: curated ? 'curated' : observed ? 'observed' : null,
      purposeObservedAt: curated ? null : observed ? (seen?.date ?? null) : null,
    };
  });

  return { servers, down: false };
}

export async function getFleetStatus(): Promise<FleetStatus> {
  const results = await Promise.all(FLEET.map(fetchHost));

  const servers = results.flatMap((r) => r.servers);
  const hostsDown = FLEET.filter((_, i) => results[i].down).map((d) => ({
    host: d.host,
    game: d.game,
  }));

  servers.sort((a, b) => sramNumber(a.name) - sramNumber(b.name) || a.name.localeCompare(b.name));

  return { servers, hostsDown };
}
