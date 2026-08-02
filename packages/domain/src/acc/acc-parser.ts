import type {
  AccSessionType,
  AccDriverEntry,
  AccDriverResult,
  AccSessionResult,
  AccHotLapEntry,
} from '@sra/shared-types';
import { msToLaptime } from '../ac-evo/ac-evo-parser.js';
import { accCarModelName, accCupCategoryName, accCarClassName } from './acc-constants.js';

// ── raw API shapes — private, never exported ────────────────────────────────

type RawDriver = {
  firstName?: string;
  lastName?: string;
  playerId?: string;
  shortName?: string;
};

type RawCar = {
  carId: number;
  carModel: number;
  carGroup?: string;
  cupCategory?: number;
  raceNumber?: number;
  teamName?: string;
  drivers?: RawDriver[];
};

type RawTiming = {
  bestLap?: number;
  bestSplits?: number[];
  lapCount?: number;
  lastLap?: number;
  totalTime?: number;
};

type RawLeaderBoardLine = {
  car: RawCar;
  currentDriverIndex?: number;
  missingMandatoryPitstop?: number;
  timing?: RawTiming;
};

type RawSessionResult = {
  isWetSession?: number;
  bestlap?: number;
  bestSplits?: number[];
  leaderBoardLines?: RawLeaderBoardLine[];
};

// Flat per-lap log, one entry per completed lap across all cars, in session
// order (not grouped by car) — see fixtures/acc-results/RESULTS_FORMAT.md.
type RawLap = {
  carId: number;
  driverIndex?: number;
  isValidForBest?: boolean;
  laptime?: number;
};

type RawSession = {
  sessionType?: string;
  trackName?: string;
  serverName?: string;
  Date?: string;
  SessionFile?: string;
  metaData?: string;
  laps?: RawLap[];
  sessionResult?: RawSessionResult;
};

// ── helpers ──────────────────────────────────────────────────────────────────

// ACC's server writes this int32-max sentinel into bestLap/lastLap/bestSplits
// whenever a driver set no time at all (e.g. 0 laps completed). Every consumer
// must normalize it to null rather than treating it as a real (huge) laptime.
const NO_TIME_SENTINEL = 2147483647;

function normMs(ms: number | undefined): number | null {
  if (ms == null || ms >= NO_TIME_SENTINEL) return null;
  return ms;
}

function normSplits(splits: number[] | undefined): number[] | null {
  if (!splits || splits.length === 0) return null;
  if (splits.some((s) => s >= NO_TIME_SENTINEL)) return null;
  return splits;
}

// ACC's playerId is "S" + SteamID64 — strip the prefix so it matches the bare
// SteamID64 used elsewhere (e.g. AC Evo's player_id) as the identity anchor.
function stripSteamPrefix(playerId: string | undefined): string {
  if (!playerId) return '';
  return playerId.startsWith('S') ? playerId.slice(1) : playerId;
}

function mapSessionType(raw: string | undefined): AccSessionType {
  switch (raw) {
    case 'FP':
      return 'Practice';
    case 'Q':
      return 'Qualify';
    case 'R':
      return 'Race';
    default:
      return raw as AccSessionType;
  }
}

// metaData is a colon-delimited string, e.g.
// "championship:<championshipGuid>:<seasonGuid>" or "custom_race:<guid>"
// (no season segment). Not a structured object.
function parseMetaData(metaData: string | undefined): {
  championshipId: string | null;
  seasonId: string | null;
} {
  if (!metaData) return { championshipId: null, seasonId: null };
  const parts = metaData.split(':');
  return {
    championshipId: parts[1] ?? null,
    seasonId: parts[2] ?? null,
  };
}

function toDriverEntry(d: RawDriver): AccDriverEntry {
  return {
    firstName: d.firstName ?? null,
    lastName: d.lastName ?? null,
    steamId: stripSteamPrefix(d.playerId),
    shortName: d.shortName ?? null,
  };
}

// ── parser ───────────────────────────────────────────────────────────────────

// Mean laptime of a car's isValidForBest laps, across every driver of that
// car (endurance stints included) — matches how bestLap/totalTime are
// already aggregated per-car rather than per-individual-stint. Formation
// laps / pit-affected laps can produce huge laptime outliers even when
// flagged valid (see RESULTS_FORMAT.md), but isValidForBest is ACC's own
// resolved validity flag — no extra outlier filtering is layered on top of
// what the server itself already decided.
function avgCleanLapMsForCar(laps: RawLap[], carId: number): number | null {
  const valid = laps.filter((l) => l.carId === carId && l.isValidForBest && typeof l.laptime === 'number');
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, l) => acc + (l.laptime as number), 0);
  return Math.round(sum / valid.length);
}

export function parseAccSession(raw: unknown): AccSessionResult {
  const s = raw as RawSession;
  const sr = s.sessionResult ?? {};
  const { championshipId, seasonId } = parseMetaData(s.metaData);
  const laps = s.laps ?? [];

  // leaderBoardLines is already in finishing/session order (index 0 = winner /
  // pole-sitter / practice P1) — same principle as AC Evo's driver_standings:
  // trust the source's order rather than re-deriving it from lap times.
  const results: AccDriverResult[] = (sr.leaderBoardLines ?? []).map((line, idx) => {
    const drivers = (line.car.drivers ?? []).map(toDriverEntry);
    const currentDriverIndex = line.currentDriverIndex ?? 0;
    const currentDriver = drivers[currentDriverIndex];

    const timing = line.timing ?? {};
    const bestLapMs = normMs(timing.bestLap);
    const avgCleanLapMs = avgCleanLapMsForCar(laps, line.car.carId);

    return {
      position: idx + 1,
      carId: line.car.carId,
      carModel: line.car.carModel,
      carModelName: accCarModelName(line.car.carModel),
      // Prefer our own authoritative class lookup over the server-reported
      // value — a server's class config can be wrong (confirmed: Oulton Park
      // reported TCX cars as "GT3"). Fall back to the server's value only for
      // a car ID our table doesn't cover yet (e.g. a brand new game update).
      carGroup: accCarClassName(line.car.carModel) ?? line.car.carGroup ?? null,
      cupCategory: line.car.cupCategory ?? null,
      cupCategoryName:
        line.car.cupCategory == null ? null : accCupCategoryName(line.car.cupCategory),
      raceNumber: line.car.raceNumber ?? null,
      teamName: line.car.teamName || null,
      drivers,
      currentDriverSteamId: currentDriver?.steamId ?? null,
      lapsCompleted: timing.lapCount ?? 0,
      bestLapMs,
      bestLap: msToLaptime(bestLapMs),
      sectorsMs: normSplits(timing.bestSplits),
      lastLapMs: normMs(timing.lastLap),
      totalTimeMs: normMs(timing.totalTime),
      // -1 = not applicable for this session type (FP/Q); 0/1 for Race.
      missingMandatoryPitstop:
        line.missingMandatoryPitstop == null || line.missingMandatoryPitstop < 0
          ? null
          : Boolean(line.missingMandatoryPitstop),
      avgCleanLapMs,
      avgCleanLap: msToLaptime(avgCleanLapMs),
    };
  });

  const sessionBestLapMs = normMs(sr.bestlap);

  return {
    sessionType: mapSessionType(s.sessionType),
    track: s.trackName ?? '',
    serverName: s.serverName ?? null,
    date: s.Date ?? null,
    sessionFile: s.SessionFile ?? null,
    championshipId,
    seasonId,
    metaDataRaw: s.metaData ?? null,
    isWetSession: Boolean(sr.isWetSession),
    bestLapMs: sessionBestLapMs,
    bestLap: msToLaptime(sessionBestLapMs),
    bestSplits: normSplits(sr.bestSplits),
    results,
  };
}

// ── race-event grouping ──────────────────────────────────────────────────────

// Groups a session into the "race event" its FP/Q/R siblings belong to.
// metaDataRaw is the only reliable discriminant between a real championship
// round and a custom race (see the field's doc comment in shared-types), so
// it anchors the key; track guards against two different metaData strings
// coincidentally sharing a value across venues, and the date bucket (not the
// full timestamp) guards against a championship round or a reused
// custom_race id recurring at the same track later — FP/Q/R of one event all
// land on the same calendar day, so this still groups them together.
export function computeAccEventKey(session: AccSessionResult): string {
  const dateBucket = session.date ? session.date.slice(0, 10) : 'unknown-date';
  return `${session.metaDataRaw ?? 'none'}|${session.track}|${dateBucket}`;
}

// ── hot-lap leaderboard ─────────────────────────────────────────────────────

// Mirrors aggregateHotLapLeaderboard (ac-evo-parser.ts), but keyed by
// (carGroup, steamId) instead of just steamId — ACC times aren't comparable
// across classes (GT3 vs GT4), so each class gets its own ranking. Attributed
// to currentDriverSteamId, same caveat as acc-points.ts's fastestLapSteamId:
// for a multi-driver car, a co-driver's lap can't be individually credited
// from this data alone.
export function aggregateAccHotLapLeaderboard(sessions: AccSessionResult[]): AccHotLapEntry[] {
  const bestByKey = new Map<string, Omit<AccHotLapEntry, 'rank'>>();

  for (const session of sessions) {
    for (const r of session.results) {
      const steamId = r.currentDriverSteamId;
      if (!steamId || r.bestLapMs == null || !r.carGroup) continue;
      // Keyed by (steamId, carModel, isWetSession) — carGroup is a pure
      // function of carModel (see accCarClassName), so including it in the
      // key would be redundant; a driver's fastest lap in each car is
      // tracked independently, so switching cars doesn't discard their best
      // time in the one they left. Wet and dry bests are likewise kept
      // independent — a wet-session lap shouldn't discard (or be discarded
      // by) a driver's dry best in the same car (see
      // acc_hotlap_leaderboard's composite PK).
      const key = `${steamId}:${r.carModel}:${session.isWetSession}`;
      const existing = bestByKey.get(key);
      if (!existing || r.bestLapMs < existing.bestLapMs) {
        const driver = r.drivers.find((d) => d.steamId === steamId);
        const driverName =
          [driver?.firstName, driver?.lastName].filter(Boolean).join(' ') ||
          driver?.shortName ||
          'Unknown';
        bestByKey.set(key, {
          steamId,
          driverName,
          carGroup: r.carGroup,
          carModel: r.carModel,
          carModelName: r.carModelName,
          bestLapMs: r.bestLapMs,
          bestLap: msToLaptime(r.bestLapMs)!,
          sectorsMs: r.sectorsMs,
          isWetSession: session.isWetSession,
        });
      }
    }
  }

  const byCarGroup = new Map<string, Omit<AccHotLapEntry, 'rank'>[]>();
  for (const entry of bestByKey.values()) {
    const arr = byCarGroup.get(entry.carGroup) ?? [];
    arr.push(entry);
    byCarGroup.set(entry.carGroup, arr);
  }

  const result: AccHotLapEntry[] = [];
  for (const entries of byCarGroup.values()) {
    entries.sort((a, b) => a.bestLapMs - b.bestLapMs);
    entries.forEach((entry, i) => result.push({ ...entry, rank: i + 1 }));
  }
  return result;
}
