import type {
  AccSessionType,
  AccDriverEntry,
  AccDriverResult,
  AccSessionResult,
} from '@sra/shared-types';
import { msToLaptime } from '../ac-evo/ac-evo-parser.js';
import { accCarModelName, accCupCategoryName } from './acc-constants.js';

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

type RawSession = {
  sessionType?: string;
  trackName?: string;
  serverName?: string;
  Date?: string;
  SessionFile?: string;
  metaData?: string;
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

export function parseAccSession(raw: unknown): AccSessionResult {
  const s = raw as RawSession;
  const sr = s.sessionResult ?? {};
  const { championshipId, seasonId } = parseMetaData(s.metaData);

  // leaderBoardLines is already in finishing/session order (index 0 = winner /
  // pole-sitter / practice P1) — same principle as AC Evo's driver_standings:
  // trust the source's order rather than re-deriving it from lap times.
  const results: AccDriverResult[] = (sr.leaderBoardLines ?? []).map((line, idx) => {
    const drivers = (line.car.drivers ?? []).map(toDriverEntry);
    const currentDriverIndex = line.currentDriverIndex ?? 0;
    const currentDriver = drivers[currentDriverIndex];

    const timing = line.timing ?? {};
    const bestLapMs = normMs(timing.bestLap);

    return {
      position: idx + 1,
      carId: line.car.carId,
      carModel: line.car.carModel,
      carModelName: accCarModelName(line.car.carModel),
      carGroup: line.car.carGroup ?? null,
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
    isWetSession: Boolean(sr.isWetSession),
    bestLapMs: sessionBestLapMs,
    bestLap: msToLaptime(sessionBestLapMs),
    bestSplits: normSplits(sr.bestSplits),
    results,
  };
}
