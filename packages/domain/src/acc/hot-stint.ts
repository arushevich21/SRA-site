// Hot Stint Qualifying: gaps-and-islands rolling-average computation.
//
// An "island" is a run of consecutive valid laps within one (session, driver)
// pair. Consecutive means contiguous lapIndex values, not just "both valid" —
// a gap in lapIndex (e.g. from a dropped/never-ingested lap) breaks the chain
// exactly like an invalid lap does, since either case means we can't prove
// the driver's pace was uninterrupted across that gap.
//
// lapIndex is not a field the raw ACC results JSON provides — it's assigned
// at ingest from the flat laps[] array's position, filtered to one car. That
// array position is documented as "session order" but is otherwise an
// assumption about the source, not a schema guarantee (see RESULTS_FORMAT.md
// and the ingest code that derives it) — carried forward here as the
// precondition callers must uphold: lapIndex must be gap-free and ordered
// per (sessionId, steamId) for a driver's own real laps, or islands will be
// computed as though laps were missing.

export type HotStintLapInput = {
  steamId: string;
  driverName: string;
  // Groups laps into a session for contiguity purposes — laps from different
  // sessions are never treated as part of the same island, even if a
  // driver's lapIndex happens to be numbered similarly across sessions.
  sessionId: string;
  lapIndex: number;
  lapTimeMs: number;
  isValid: boolean;
};

export type HotStintDriverResult = {
  steamId: string;
  driverName: string;
  bestAvgMs: number;
  // The N lap times that produced bestAvgMs, in lap order — admin-only.
  windowLapMs: number[];
  windowSessionId: string;
  totalLaps: number;
  validLaps: number;
  // Population stdev (ms) over every valid lap for this driver, across every
  // session — a rough "how spiky was this driver's pace" signal for admins,
  // not itself part of the ranking.
  consistencySpreadMs: number;
};

function stdevMs(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.round(Math.sqrt(variance));
}

// Splits one (session, driver)'s laps, already sorted by lapIndex ascending,
// into maximal runs of valid + gap-free-contiguous laps.
function computeIslands(sortedLaps: HotStintLapInput[]): HotStintLapInput[][] {
  const islands: HotStintLapInput[][] = [];
  let current: HotStintLapInput[] = [];

  for (const lap of sortedLaps) {
    const prev = current[current.length - 1];
    const contiguous = prev != null && lap.lapIndex === prev.lapIndex + 1;
    if (lap.isValid && (current.length === 0 || contiguous)) {
      current.push(lap);
    } else {
      if (current.length > 0) islands.push(current);
      current = lap.isValid ? [lap] : [];
    }
  }
  if (current.length > 0) islands.push(current);
  return islands;
}

// Best (minimum) full-window average within a single island, or null if the
// island is shorter than windowSize.
function bestWindowInIsland(
  island: HotStintLapInput[],
  windowSize: number,
): { avgMs: number; windowLapMs: number[] } | null {
  if (island.length < windowSize) return null;
  let best: { avgMs: number; windowLapMs: number[] } | null = null;
  for (let start = 0; start + windowSize <= island.length; start++) {
    const window = island.slice(start, start + windowSize);
    const windowLapMs = window.map((l) => l.lapTimeMs);
    const avgMs = windowLapMs.reduce((a, b) => a + b, 0) / windowSize;
    if (!best || avgMs < best.avgMs) best = { avgMs, windowLapMs };
  }
  return best;
}

// Aggregates laps (already deduplicated by the ingest's unique constraint —
// this function assumes no duplicate rows) into one ranked result per driver.
// Drivers with no island reaching windowSize laps are omitted entirely,
// rather than appearing with a null/zero time — the caller (leaderboard,
// division-assignment) must never read "absent" as "set a time of zero".
export function computeHotStintResults(
  laps: HotStintLapInput[],
  windowSize: number,
): HotStintDriverResult[] {
  const bySteamId = new Map<string, HotStintLapInput[]>();
  for (const lap of laps) {
    const arr = bySteamId.get(lap.steamId);
    if (arr) arr.push(lap);
    else bySteamId.set(lap.steamId, [lap]);
  }

  const results: HotStintDriverResult[] = [];

  for (const [steamId, driverLaps] of bySteamId) {
    const driverName = driverLaps[0].driverName;
    const totalLaps = driverLaps.length;
    const validLaps = driverLaps.filter((l) => l.isValid).length;

    const bySession = new Map<string, HotStintLapInput[]>();
    for (const lap of driverLaps) {
      const arr = bySession.get(lap.sessionId);
      if (arr) arr.push(lap);
      else bySession.set(lap.sessionId, [lap]);
    }

    let best: { avgMs: number; windowLapMs: number[]; sessionId: string } | null = null;
    for (const [sessionId, sessionLaps] of bySession) {
      const sorted = [...sessionLaps].sort((a, b) => a.lapIndex - b.lapIndex);
      const islands = computeIslands(sorted);
      for (const island of islands) {
        const candidate = bestWindowInIsland(island, windowSize);
        if (candidate && (!best || candidate.avgMs < best.avgMs)) {
          best = { ...candidate, sessionId };
        }
      }
    }

    if (!best) continue; // fewer than windowSize valid laps in any single island

    results.push({
      steamId,
      driverName,
      bestAvgMs: Math.round(best.avgMs),
      windowLapMs: best.windowLapMs,
      windowSessionId: best.sessionId,
      totalLaps,
      validLaps,
      consistencySpreadMs: stdevMs(driverLaps.filter((l) => l.isValid).map((l) => l.lapTimeMs)),
    });
  }

  return results.sort((a, b) => a.bestAvgMs - b.bestAvgMs || a.steamId.localeCompare(b.steamId));
}
