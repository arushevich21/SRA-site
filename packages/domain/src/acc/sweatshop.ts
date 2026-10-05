// Sweatshop: who has turned the most hot-lap-server laps in a season.
//
// Input is acc_hotlap_leaderboard's seasonal rows — one per (track, car,
// driver, wet/dry), each carrying that combination's own total_laps /
// total_valid_laps (written by the SRA-Bot ingest). A driver who switched cars
// or ran wet and dry has several rows at one track, and each row's counts are
// distinct laps (confirmed against S19 data), so totals are plain sums.
//
// Hot stint laps are not added on top: the stint board is built from the same
// hot-lap-server sessions, so those laps are already in these counts.

export type SweatshopLapRow = {
  steamId: string;
  // acc_hotlap_leaderboard.driver_name — a bot-written snapshot. Callers prefer
  // the live drivers.display_name when the steamId resolves to a driver.
  driverName: string;
  trackKey: string;
  totalLaps: number;
  validLaps: number;
  bestLapMs: number;
};

export type SweatshopDriverTotal = {
  steamId: string;
  driverName: string;
  laps: number;
  validLaps: number;
  // Competition ranking ("1, 1, 3"): drivers on equal laps share a rank, so a
  // tie for the most laps puts the sweat icon on both.
  rank: number;
  // Lower bound on time spent lapping: each row's laps × that row's best lap.
  // Real laps (out laps, invalid laps, traffic) are slower, so this
  // undercounts — display it as approximate.
  approxSecondsLapping: number;
};

type LapCounts = { laps: number; validLaps: number };

export function aggregateSweatshop(
  rows: SweatshopLapRow[],
  opts: { trackKey?: string } = {},
): SweatshopDriverTotal[] {
  const byDriver = new Map<
    string,
    { laps: number; validLaps: number; ms: number; name: string; nameLaps: number }
  >();

  for (const r of rows) {
    if (opts.trackKey != null && r.trackKey !== opts.trackKey) continue;
    const d = byDriver.get(r.steamId);
    if (!d) {
      byDriver.set(r.steamId, {
        laps: r.totalLaps,
        validLaps: r.validLaps,
        ms: r.totalLaps * r.bestLapMs,
        name: r.driverName,
        nameLaps: r.totalLaps,
      });
      continue;
    }
    d.laps += r.totalLaps;
    d.validLaps += r.validLaps;
    d.ms += r.totalLaps * r.bestLapMs;
    // The snapshot name can differ between rows (a rename between sessions);
    // the busiest row is the most likely to be current.
    if (r.totalLaps > d.nameLaps) {
      d.name = r.driverName;
      d.nameLaps = r.totalLaps;
    }
  }

  const sorted = [...byDriver.entries()]
    .filter(([, d]) => d.laps > 0)
    .sort(([aId, a], [bId, b]) => b.laps - a.laps || a.name.localeCompare(b.name) || aId.localeCompare(bId));

  let rank = 0;
  return sorted.map(([steamId, d], i) => {
    if (i === 0 || d.laps !== sorted[i - 1][1].laps) rank = i + 1;
    return {
      steamId,
      driverName: d.name,
      laps: d.laps,
      validLaps: d.validLaps,
      rank,
      approxSecondsLapping: Math.round(d.ms / 1000),
    };
  });
}

export function validPercent({ laps, validLaps }: LapCounts): number | null {
  if (laps <= 0) return null;
  return Math.round((validLaps / laps) * 100);
}

// How a driver's valid-lap rate compares to the field's — picks the tone of
// the leader callouts (from "annoyingly tidy" down to full track-limits
// roast). Tiers are 10-point bands relative to the field, not absolute
// percentages, so a track whose limits catch everyone (Paul Ricard ran ~55%
// valid in S19) doesn't roast its leader for doing what everyone did:
//
//   spotless  ≥ 10 points above the field
//   clean     within 10 points either side
//   sloppy    10–20 points below
//   wild      20–30 points below
//   feral     30+ points below
//
// The field rate is lap-weighted (all valid laps / all laps), so a handful of
// short sessions can't skew it. `field` may include the driver themself.
export type ValidityTier = 'spotless' | 'clean' | 'sloppy' | 'wild' | 'feral';

export function validityTier(driver: LapCounts, field: LapCounts[]): ValidityTier {
  if (driver.laps <= 0) return 'clean';
  let laps = 0;
  let valid = 0;
  for (const f of field) {
    laps += f.laps;
    valid += f.validLaps;
  }
  if (laps <= 0) return 'clean';
  // Rounded to kill float noise right on a band edge (70.00000000000001).
  const gap = Math.round(((valid / laps) * 100 - (driver.validLaps / driver.laps) * 100) * 1000) / 1000;
  if (gap <= -10) return 'spotless';
  if (gap < 10) return 'clean';
  if (gap < 20) return 'sloppy';
  if (gap < 30) return 'wild';
  return 'feral';
}
