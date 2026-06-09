/**
 * Normalized View Models — the internal type contract for SRA Control Center.
 * Decouples all packages from the raw GridOS API payload shape.
 * See docs/adr/0001-normalized-view-models.md
 *
 * Placeholder — expand as the GridOS integration is defined (Phase 0 spike).
 */
export type NormalizedEvent = Record<string, unknown>;

export type {
  DriverRoundResult,
  DriverRoundScore,
  DriverSeasonResult,
  TeamSeasonResult,
  CountbackEntry,
} from './points-engine.js';
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
