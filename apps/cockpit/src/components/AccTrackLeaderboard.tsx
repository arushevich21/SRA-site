'use client';

import { useMemo, useState } from 'react';
import type { AccHotLapEntry } from '@sra/shared-types';
import { accCarManufacturerIconName, accCarManufacturerLogoUrl } from '@sra/domain';
import type { DriverInfo } from '@/lib/driver-lookup';
import { getReferenceLegend, type LapTier } from '@/lib/acc/reference-times';
import { HotLapBoard, type HotLapBoardEntry } from './HotLapBoard';

const ALL_CLASSES = 'All';

// Entries as returned by lib/acc/tracks.ts's getAccTrackLeaderboard / lib/acc/
// hotstint.ts's getAccTrackHotStint — AccHotLapEntry enriched with the
// driver's registered number/nationality (see lib/driver-lookup.ts) and its
// reference-time tier (see lib/acc/reference-times.ts).
type AccBoardEntry = AccHotLapEntry & DriverInfo & { lapTier: LapTier | null };

// HotLapBoard is generic across sims — it just expects HotLapEntry's shape.
// AccHotLapEntry only differs by carModelName vs carModel, so map rather than
// forking the table component for ACC.
function toHotLapEntry(entry: AccBoardEntry): HotLapBoardEntry {
  const iconName = entry.carModel != null ? accCarManufacturerIconName(entry.carModel) : null;
  return {
    rank: entry.rank,
    steamId: entry.steamId,
    driverName: entry.driverName,
    carModel: entry.carModelName,
    bestLapMs: entry.bestLapMs,
    bestLap: entry.bestLap,
    sectorsMs: entry.sectorsMs,
    manufacturerIconName: iconName,
    manufacturerLogoUrl:
      !iconName && entry.carModel != null ? accCarManufacturerLogoUrl(entry.carModel) : null,
    driverNumber: entry.driverNumber,
    country: entry.country,
    isSralien: entry.isSralien,
    division: entry.division,
    tier: entry.tier,
    lapTier: entry.lapTier,
  };
}

export function AccTrackLeaderboard({
  leaderboardByCarGroup,
  currentSteamId,
  currentDivision,
  timeLabel,
  trackKey,
  variant,
}: {
  leaderboardByCarGroup: Record<string, AccBoardEntry[]>;
  currentSteamId?: string | null;
  // The signed-in user's own division — powers HotLapBoard's "My Division"
  // filter button. See getCurrentDriverContext in lib/current-driver.ts.
  currentDivision?: number | null;
  // Forwarded to HotLapBoard's time-column header — "Stint Avg" for the Hot
  // Stint board, default "Lap Time" otherwise.
  timeLabel?: string;
  // Which reference-time sheet to show as the cutoff legend (see
  // lib/acc/reference-times.ts) — 'lap' for Hot Lap boards, 'stint' for Hot
  // Stint. Omit on a board with no GT3 reference data (currently none do).
  trackKey: string;
  variant: 'lap' | 'stint';
}) {
  const classes = useMemo(() => Object.keys(leaderboardByCarGroup).sort(), [leaderboardByCarGroup]);
  const [selectedClass, setSelectedClass] = useState<string>(ALL_CLASSES);
  const referenceLegend = useMemo(() => getReferenceLegend(trackKey, variant), [trackKey, variant]);

  if (classes.length === 0) {
    return (
      <div className="border border-line/50 bg-carbon-2 px-6 py-8 text-center">
        <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
          No laps recorded yet for this track
        </p>
      </div>
    );
  }

  const entries =
    selectedClass === ALL_CLASSES
      ? Object.values(leaderboardByCarGroup)
          .flat()
          .sort((a, b) => a.bestLapMs - b.bestLapMs)
          .map((entry, i) => ({ ...entry, rank: i + 1 }))
      : (leaderboardByCarGroup[selectedClass] ?? []);

  return (
    <HotLapBoard
      entries={entries.map(toHotLapEntry)}
      currentSteamId={currentSteamId}
      currentDivision={currentDivision}
      timeLabel={timeLabel}
      referenceLegend={referenceLegend}
      classFilter={{ options: [ALL_CLASSES, ...classes], selected: selectedClass, onChange: setSelectedClass }}
    />
  );
}
