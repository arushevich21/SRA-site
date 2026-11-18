import { BEST_QUAL_BONUS, FASTEST_LAP_BONUS, POSITION_POINTS } from '../points-engine.js';

// Who has clinched a title, and who can still mathematically win it, from the
// standings as they stand plus the rounds left to run.
//
// The drop rule is what makes this non-obvious. With D drop rounds, a driver's
// final total is their best (totalRounds - D) scores. A missed or still-to-run
// round is a 0, so every remaining round can only ever push a driver UP: a bad
// night tonight simply becomes the new drop and the old drop comes back in.
// That's why a driver's floor is not their current total — it's their total
// with the remaining rounds scored as zeros, then re-dropped.
//
// Clinched: the leader's floor beats every rival's ceiling outright.
// Alive: a driver's ceiling reaches the best floor among their rivals. Every
// rival scoring 0 while this driver takes the maximum is a real outcome (they
// all DNF), so this is exact, not an estimate. A tie is treated as alive —
// the tie-break isn't modelled here, so we never call a title it might lose.

/** One round's best possible score for a single driver: win, pole, fastest lap. */
export const MAX_ROUND_POINTS = POSITION_POINTS[1]! + FASTEST_LAP_BONUS + BEST_QUAL_BONUS;

/** What a two-driver team can take from one round at best: a 1–2 with both bonuses. */
const TEAM_ROUND_SPLITS: [number, number][] = (() => {
  const p1 = POSITION_POINTS[1]!;
  const p2 = POSITION_POINTS[2]!;
  const bonus = FASTEST_LAP_BONUS + BEST_QUAL_BONUS;
  const splits: [number, number][] = [];
  for (let toWinner = 0; toWinner <= bonus; toWinner++) {
    const a = p1 + toWinner;
    const b = p2 + bonus - toWinner;
    splits.push([a, b], [b, a]);
  }
  return splits;
})();

export type TitleRaceEntrant = {
  /** Scores in the rounds already run, one per scored event. Missing events are 0s — pass them or not, the array is padded. */
  scores: number[];
  /** Points deducted outright (Emperor's pointsPenalty). */
  penalty?: number;
};

export type TitleRaceInput = {
  totalRounds: number;
  roundsScored: number;
  /** How many rounds each entrant drops. */
  drops: number;
};

export type TitleStatus = 'champion' | 'contender' | 'out';

function countedTotal(scores: number[], counted: number): number {
  return scores
    .slice()
    .sort((a, b) => b - a)
    .slice(0, Math.max(0, counted))
    .reduce((s, x) => s + x, 0);
}

function padded(e: TitleRaceEntrant, input: TitleRaceInput): number[] {
  const scores = e.scores.slice(0, input.roundsScored);
  while (scores.length < input.roundsScored) scores.push(0);
  return scores;
}

/** Final total if every remaining round scores `perRound`. */
export function projectedTotal(e: TitleRaceEntrant, input: TitleRaceInput, perRound: number[]): number {
  const remaining = Math.max(0, input.totalRounds - input.roundsScored);
  const scores = padded(e, input);
  for (let i = 0; i < remaining; i++) scores.push(perRound[i] ?? perRound[perRound.length - 1] ?? 0);
  return countedTotal(scores, input.totalRounds - input.drops) - (e.penalty ?? 0);
}

export function driverFloor(e: TitleRaceEntrant, input: TitleRaceInput): number {
  return projectedTotal(e, input, [0]);
}

export function driverCeiling(e: TitleRaceEntrant, input: TitleRaceInput): number {
  return projectedTotal(e, input, [MAX_ROUND_POINTS]);
}

/**
 * A team's total is the sum of its drivers' own counted totals (each driver
 * drops their own worst round — see applyIndividualTeamDrops). Its ceiling is
 * the best 1–2 finish every remaining round, with the bonuses split whichever
 * way helps most once each driver's drop is accounted for.
 */
export function teamFloor(members: TitleRaceEntrant[], input: TitleRaceInput): number {
  return members.reduce((s, m) => s + driverFloor(m, input), 0);
}

export function teamCeiling(members: TitleRaceEntrant[], input: TitleRaceInput): number {
  if (members.length === 0) return 0;
  if (members.length === 1) return driverCeiling(members[0]!, input);
  if (members.length > 2) {
    // A mid-season swap left more than two names on the team. Generous on
    // purpose: an overstated ceiling can only delay a "champion" call, never
    // make a wrong one.
    return members.reduce((s, m) => s + driverCeiling(m, input), 0);
  }
  const [a, b] = members as [TitleRaceEntrant, TitleRaceEntrant];
  return Math.max(
    ...TEAM_ROUND_SPLITS.map(([x, y]) => projectedTotal(a, input, [x]) + projectedTotal(b, input, [y])),
  );
}

/**
 * Title status for every entrant in one championship (one tier, or the teams
 * table), given each one's floor and ceiling. Index-aligned with the input.
 */
export function titleStatuses(bounds: { floor: number; ceiling: number }[]): TitleStatus[] {
  if (bounds.length === 0) return [];
  if (bounds.length === 1) return ['champion'];

  const statuses = bounds.map((_, i): TitleStatus => {
    const rivals = bounds.filter((_, j) => j !== i);
    const self = bounds[i]!;
    if (rivals.every((r) => self.floor > r.ceiling)) return 'champion';
    const bestRivalFloor = Math.max(...rivals.map((r) => r.floor));
    return self.ceiling >= bestRivalFloor ? 'contender' : 'out';
  });

  // Someone has it locked: nobody else is in a fight for it.
  if (statuses.includes('champion')) return statuses.map((s) => (s === 'champion' ? s : 'out'));
  return statuses;
}
