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
  emptyLedger,
  applyRuling,
  recordAttendance,
  recordAbsence,
  computeActivePp,
  getEligibility,
} from './penalty-ledger.js';
