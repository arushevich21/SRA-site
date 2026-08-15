/**
 * SRA domain package — league-owned business logic.
 * Pure functions only: no network, no database, no side effects.
 * See docs/domain/points-engine.md and docs/domain/penalty-ledger.md
 */

export function computeStandings(): never {
  throw new Error('not implemented');
}

export {
  computeDriverRoundScore,
  computeDriverSeasonTotal,
  computeTeamSeasonTotal,
  compareByCountback,
} from './points-engine.js';

export {
  emptyLedger,
  applyRuling,
  recordAttendance,
  recordAbsence,
  computeActivePp,
  getEligibility,
} from './penalty-ledger.js';

export {
  parseAcEvoSession,
  msToLaptime,
  isValidLap,
  aggregateHotLapLeaderboard,
} from './ac-evo/ac-evo-parser.js';

export {
  computeRacePositionPoints,
  computePole,
  totalRoundPoints,
  ACEVO_POSITION_POINTS,
  ACEVO_FASTEST_LAP_BONUS,
  ACEVO_POLE_BONUS,
} from './ac-evo/ac-evo-points.js';

export {
  parseAccSession,
  aggregateAccHotLapLeaderboard,
  computeAccEventKey,
} from './acc/acc-parser.js';

export {
  ACC_CAR_MODEL_NAMES,
  ACC_CUP_CATEGORY_NAMES,
  ACC_CAR_CLASS_NAMES,
  ACC_CAR_MANUFACTURER_ICON_NAMES,
  ACC_CAR_MANUFACTURER_CDN_SLUGS,
  accCarModelName,
  accCupCategoryName,
  accCarClassName,
  accCarManufacturerIconName,
} from './acc/acc-constants.js';

export {
  computeAccRacePoints,
  computeAccFastestQualifyingLapSteamId,
  totalAccRoundPoints,
  ACC_POSITION_POINTS,
  ACC_FASTEST_RACE_LAP_BONUS,
  ACC_FASTEST_QUALIFYING_LAP_BONUS,
} from './acc/acc-points.js';

export {
  sortStandingsWithTiebreak,
  type StandingsEntrant,
  type StandingsRoundResult,
} from './standings-order.js';

// UNUSED as of 2026-08-14: built for a Hot Stint Qualifying ingest pipeline
// that turned out to be unnecessary (that data already exists, correct,
// written by an external bot into acc_hotstint_leaderboard/
// classification_status — see supabase/migrations/
// 20260814_drop_hot_stint_ingest.sql). Kept, not deleted: it's a verified,
// tested implementation of gaps-and-islands rolling-average qualifying, on
// the same day this codebase started relying on someone else's version of
// the same computation — deleting it costs nothing to redo badly later.
// Left exported so it stays reachable without re-wiring if it's ever needed.
export {
  computeHotStintResults,
  type HotStintLapInput,
  type HotStintDriverResult,
} from './acc/hot-stint.js';
