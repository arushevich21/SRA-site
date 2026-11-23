// Card shape for Season Wrapped — shared by the server builder and the
// client story player. Types only; safe to import anywhere.
import type { SeasonNumbers, Archetype } from '@sra/domain';

export type WrappedDriverCard = {
  steamId: string;
  name: string;
  number: number | null;
  division: number;
  numbers: SeasonNumbers;
  practicePct: number;
  distanceCompare: string;
  nemesis: {
    name: string;
    number: number | null;
    sideBySide: number;
    ahead: number;
    behind: number;
    racesTogether: number;
  } | null;
  archetype: Archetype;
  /** The number behind the archetype, for the card's evidence line. */
  archetypeEvidence: string;
  roundsStarted: number;
  totalRounds: number;
  /** Season strip: every round in order; position null = didn't start. */
  rounds: { round: number; code: string; track: string; position: number | null; field: number }[];
  /** Rivalry chart: both finishing positions per round (null = not classified). */
  rivalry: { round: number; code: string; me: number | null; them: number | null }[];
  /** Field plot behind the archetype: everyone's value, the driver's own marked. */
  field: { label: string; values: number[]; mine: number; higherIsBetter: boolean };
  /** Easter eggs earned this season (rendered as extra slides). */
  easterEggs: EasterEgg[];
  driverId: string | null;
  /** Head to head with the teammate they shared the most rounds with. */
  teammate: {
    name: string;
    number: number | null;
    team: string;
    race: { me: number; them: number };
    quali: { me: number; them: number };
  } | null;
  /** Qualifying vs the flag, over rounds with both. */
  saturday: {
    avgQuali: number;
    avgFinish: number;
    gained: number;
    bestGain: { places: number; track: string } | null;
  } | null;
  /** Purple = fastest best-lap sector in the division that race. */
  sectors: { purple: number; best: { rank: number; sector: number; track: string } } | null;
  /** SRA rating (composite × 100) across the season's rounds. */
  rating: { start: number; end: number; peak: number; peakTrack: string } | null;
  clean: { pp: number; warnings: number; cleanRounds: number; rounds: number };
};

/** Jaguar G3 (ACC model 14): arguably the slowest car on the S19 grid. */
export type EasterEgg =
  | {
      kind: 'jag';
      races: number;
      best: number;
      /** Different drivers who finished behind them at least once. */
      beaten: number;
    }
  | {
      /** #1 on the season's Sweatshop board (laps on the hot-lap servers). */
      kind: 'sweat';
      laps: number;
      margin: number;
      runnerUp: string;
      /** Days with a practice session on SRA servers, of the season's days. */
      days: number;
      seasonDays: number;
    };

export type WrappedRosterEntry = { steamId: string; name: string; division: number };

/** Launch window: the prompt, homepage card and nav link show until this. */
export const WRAPPED_UNTIL = Date.parse('2026-12-15T05:00:00Z'); // Dec 15, midnight ET

export function wrappedLive(now = Date.now()): boolean {
  return now < WRAPPED_UNTIL;
}

/** What the launch prompt / homepage card should show this visitor. */
export type WrappedPromptState =
  | { state: 'off' | 'signed-out' | 'no-card' }
  | { state: 'ready'; seen: boolean; name: string; number: number | null };

/** The league's season as a story: the series as a whole, and its champions. */
export type LeagueWrapped = {
  drivers: number;
  starts: number;
  rounds: number;
  divisions: number;
  laps: number;
  km: number;
  hours: number;
  mostWins: { names: string[]; wins: number } | null;
  purpleKing: { name: string; purple: number } | null;
  sweatiest: { name: string; laps: number } | null;
  /** Drivers who raced 6+ rounds without a penalty point or warning. */
  spotless: number;
  /** Smallest drivers' title margin across the divisions. */
  closest: { division: number; margin: number; champion: string } | null;
  champions: {
    division: number;
    driver: { name: string; number: number | null; points: number; margin: number; wins: number };
    silver: { name: string; number: number | null; overall: number } | null;
    team: { name: string; drivers: string[]; points: number; margin: number } | null;
  }[];
};
