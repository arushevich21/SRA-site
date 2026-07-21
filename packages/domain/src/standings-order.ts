export type StandingsRoundResult = {
  // Net points earned that round; null means the driver did not participate
  // (DNS) — distinct from a round raced for zero points.
  points: number | null;
};

export type StandingsEntrant = {
  totalPoints: number;
  // In round order (round 1 first).
  rounds: readonly StandingsRoundResult[];
};

// Full re-sort of a standings list, descending by points, with a tie-break so
// no two entrants ever share a rank:
//   1. More rounds participated (non-DNS) ranks higher — a driver who raced
//      more starts is ahead of one who scored the same total in fewer.
//   2. Otherwise, whoever's running total first reached the tied value ranks
//      higher ("got there first").
// Entrants tied on all three fall back to their original relative order
// (Array#sort is stable).
export function sortStandingsWithTiebreak<T extends StandingsEntrant>(
  entrants: readonly T[],
): T[] {
  return [...entrants].sort((a, b) => {
    if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;
    return compareTiedEntrants(a, b);
  });
}

function compareTiedEntrants(a: StandingsEntrant, b: StandingsEntrant): number {
  const aRaces = a.rounds.filter((r) => r.points !== null).length;
  const bRaces = b.rounds.filter((r) => r.points !== null).length;
  if (aRaces !== bRaces) return bRaces - aRaces;

  const aRound = roundReachedTotal(a.rounds, a.totalPoints);
  const bRound = roundReachedTotal(b.rounds, b.totalPoints);
  return aRound - bRound;
}

function roundReachedTotal(rounds: readonly StandingsRoundResult[], total: number): number {
  let cumulative = 0;
  for (let i = 0; i < rounds.length; i++) {
    cumulative += rounds[i].points ?? 0;
    if (cumulative >= total) return i;
  }
  return rounds.length;
}
