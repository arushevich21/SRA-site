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
  computePoleSteamId,
  totalRoundPoints,
  ACEVO_POSITION_POINTS,
  ACEVO_FASTEST_LAP_BONUS,
  ACEVO_POLE_BONUS,
} from './ac-evo/ac-evo-points.js';

export { parseAccSession } from './acc/acc-parser.js';

export {
  ACC_CAR_MODEL_NAMES,
  ACC_CUP_CATEGORY_NAMES,
  accCarModelName,
  accCupCategoryName,
} from './acc/acc-constants.js';

export {
  computeAccRacePoints,
  computeAccFastestQualifyingLapSteamId,
  totalAccRoundPoints,
  ACC_POSITION_POINTS,
  ACC_FASTEST_RACE_LAP_BONUS,
  ACC_FASTEST_QUALIFYING_LAP_BONUS,
} from './acc/acc-points.js';
