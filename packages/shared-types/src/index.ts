/**
 * Normalized View Models — the internal type contract for SRA Control Center.
 * Decouples all packages from the raw GridOS API payload shape.
 * See docs/adr/0001-normalized-view-models.md
 */
export {
  SimGridChampionshipSummary,
  SimGridChampionship,
  SimGridRace,
  SimGridTrack,
  SimGridStandingsEntry,
  GridOSError,
} from './simgrid.js';

export type {
  DriverRoundResult,
  DriverRoundScore,
  DriverSeasonResult,
  TeamSeasonResult,
  CountbackEntry,
} from './points-engine.js';

export {
  RaceRef,
  Ruling,
  PpEvent,
  RaceWarning,
  QualWarning,
  PendingBan,
  SeasonAdministration,
  SeasonBanState,
  DriverLedgerState,
  RulingEffect,
  EligibilityStatus,
} from './penalty-ledger.js';
