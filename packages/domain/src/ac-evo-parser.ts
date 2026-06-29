import type {
  AcEvoSessionType,
  AcEvoDriverResult,
  AcEvoSessionResult,
} from '@sra/shared-types';

// ── raw API shapes — private, never exported ────────────────────────────────

type GuidPair = { a: string; b: string };

type RawDriver = {
  guid: GuidPair;
  first_name?: string;
  last_name?: string;
  nickname?: string;
  player_id?: string;
  nation?: string;
};

type RawLap = {
  car_key: GuidPair;
  driver_key: GuidPair;
  time: number;
  split?: number[];
  flags?: number;
};

type RawCar = {
  car_id: GuidPair;
  model_displayname?: string;
  race_number?: number;
};

type RawCarStanding = {
  car_id: GuidPair;
  starting_position?: number;
};

type RawSession = {
  server_name?: string;
  season_guid?: string;
  session_name?: string;
  session_type?: string;
  track_name?: string;
  track_layout_name?: string;
  championship_id?: GuidPair;
  is_completed?: boolean;
  server_manager?: { server_start_time?: string };
  drivers?: RawDriver[];
  laps?: RawLap[];
  cars?: RawCar[];
  car_standings?: RawCarStanding[];
  driver_standings?: GuidPair[];
  time_standings?: number[];
};

// ── helpers ──────────────────────────────────────────────────────────────────

function gkey(g: GuidPair): string {
  return `${g.a}:${g.b}`;
}

export function msToLaptime(ms: number | null | undefined): string | null {
  if (!ms) return null;
  const totalS = Math.floor(ms / 1000);
  const millis = ms % 1000;
  const minutes = Math.floor(totalS / 60);
  const seconds = totalS % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

// ── parser ───────────────────────────────────────────────────────────────────

export function parseAcEvoSession(raw: unknown): AcEvoSessionResult {
  const s = raw as RawSession;
  const sessionType = (s.session_type ?? 'Unknown') as AcEvoSessionType;

  const drivers = new Map<string, RawDriver>();
  for (const d of s.drivers ?? []) {
    drivers.set(gkey(d.guid), d);
  }

  const lapsByDriver = new Map<string, RawLap[]>();
  for (const lap of s.laps ?? []) {
    const k = gkey(lap.driver_key);
    const arr = lapsByDriver.get(k) ?? [];
    arr.push(lap);
    lapsByDriver.set(k, arr);
  }

  const driverToCar = new Map<string, string>();
  for (const lap of s.laps ?? []) {
    driverToCar.set(gkey(lap.driver_key), gkey(lap.car_key));
  }

  const carMeta = new Map<string, { model?: string; raceNumber?: number }>();
  for (const c of s.cars ?? []) {
    carMeta.set(gkey(c.car_id), {
      model: c.model_displayname,
      raceNumber: c.race_number,
    });
  }

  const startPos = new Map<string, number>();
  for (const cs of s.car_standings ?? []) {
    if (cs.starting_position != null) {
      startPos.set(gkey(cs.car_id), cs.starting_position);
    }
  }

  const finishing = s.driver_standings ?? [];
  const times = s.time_standings ?? [];

  const results: AcEvoDriverResult[] = finishing.map((g, idx) => {
    const pos = idx + 1;
    const k = gkey(g);
    const d = drivers.get(k);
    const driverLaps = lapsByDriver.get(k) ?? [];

    const lapTimes = driverLaps.map((l) => l.time).filter((t) => t > 0);
    const bestLapMs = lapTimes.length > 0 ? Math.min(...lapTimes) : null;

    const rawTime = idx < times.length ? times[idx] : null;

    const carKey = driverToCar.get(k);
    const meta = carKey ? carMeta.get(carKey) : undefined;

    const driverName =
      d?.nickname ||
      [d?.first_name, d?.last_name].filter(Boolean).join(' ') ||
      'Unknown';

    const entry: AcEvoDriverResult = {
      position: pos,
      driverName,
      firstName: d?.first_name ?? null,
      lastName: d?.last_name ?? null,
      steamId: d?.player_id ?? '',
      nation: d?.nation ?? null,
      carModel: meta?.model ?? null,
      raceNumber: meta?.raceNumber ?? null,
      startingPosition: carKey ? (startPos.get(carKey) ?? null) : null,
      lapsCompleted: driverLaps.length,
      noLaps: driverLaps.length === 0,
      bestLapMs,
      bestLap: msToLaptime(bestLapMs),
    };

    if (sessionType === 'Race') {
      entry.totalTimeMs = rawTime ?? undefined;
    } else if (sessionType === 'Qualify') {
      entry.qualifyingBestMs = rawTime || null;
      entry.qualifyingBest = msToLaptime(rawTime || null);
      entry.setValidTime = Boolean(rawTime);
    }

    return entry;
  });

  return {
    sessionType,
    sessionName: s.session_name ?? null,
    track: s.track_name ?? '',
    trackLayout: s.track_layout_name ?? null,
    serverName: s.server_name ?? null,
    seasonGuid: s.season_guid ?? null,
    championshipId: s.championship_id ? gkey(s.championship_id) : null,
    isCompleted: s.is_completed ?? false,
    serverStartTime: s.server_manager?.server_start_time ?? null,
    results,
  };
}
