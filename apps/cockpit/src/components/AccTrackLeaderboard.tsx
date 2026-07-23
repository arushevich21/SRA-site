'use client';

import { useMemo, useState } from 'react';
import type { AccHotLapEntry } from '@sra/shared-types';
import { accCarManufacturerIconName, accCarManufacturerLogoUrl } from '@sra/domain';
import { HotLapBoard, type HotLapBoardEntry } from './HotLapBoard';

const ALL_CLASSES = 'All';

// HotLapBoard is generic across sims — it just expects HotLapEntry's shape.
// AccHotLapEntry only differs by carModelName vs carModel, so map rather than
// forking the table component for ACC.
function toHotLapEntry(entry: AccHotLapEntry): HotLapBoardEntry {
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
  };
}

export function AccTrackLeaderboard({
  leaderboardByCarGroup,
  currentSteamId,
}: {
  leaderboardByCarGroup: Record<string, AccHotLapEntry[]>;
  currentSteamId?: string | null;
}) {
  const classes = useMemo(() => Object.keys(leaderboardByCarGroup).sort(), [leaderboardByCarGroup]);
  const [selectedClass, setSelectedClass] = useState<string>(ALL_CLASSES);

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
      classFilter={{ options: [ALL_CLASSES, ...classes], selected: selectedClass, onChange: setSelectedClass }}
    />
  );
}
