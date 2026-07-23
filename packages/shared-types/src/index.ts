/**
 * Normalized View Models — the internal type contract for SRA Control Center.
 * Decouples all packages from the raw GridOS API payload shape.
 * See docs/adr/0001-normalized-view-models.md
 */
export type {
  SimGridChampionshipSummary,
  SimGridChampionship,
  SimGridRace,
  SimGridTrack,
  SimGridStandingsEntry,
} from './simgrid.js';

export { GridOSError } from './simgrid.js';

export type {
  DriverRoundResult,
  DriverRoundScore,
  DriverSeasonResult,
  TeamSeasonResult,
  CountbackEntry,
} from './points-engine.js';

export type {
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

export type {
  AcEvoSessionType,
  AcEvoDriverResult,
  AcEvoSessionResult,
  EmperorResultListEntry,
  EmperorResultListPage,
  EmperorDriverStanding,
  EmperorTeamStanding,
  EmperorChampionshipStandings,
  HotLapEntry,
} from './ac-evo.js';

export type {
  AccSessionType,
  AccDriverEntry,
  AccDriverResult,
  AccSessionResult,
  AccHotLapEntry,
} from './acc.js';
