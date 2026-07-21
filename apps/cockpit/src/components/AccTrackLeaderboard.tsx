import type { AccHotLapEntry, HotLapEntry } from '@sra/shared-types';
import { Collapsible } from './Collapsible';
import { HotLapBoard } from './HotLapBoard';

// HotLapBoard is generic across sims — it just expects HotLapEntry's shape.
// AccHotLapEntry only differs by carModelName vs carModel, so map rather than
// forking the table component for ACC.
function toHotLapEntry(entry: AccHotLapEntry): HotLapEntry {
  return {
    rank: entry.rank,
    steamId: entry.steamId,
    driverName: entry.driverName,
    carModel: entry.carModelName,
    bestLapMs: entry.bestLapMs,
    bestLap: entry.bestLap,
    sectorsMs: entry.sectorsMs,
  };
}

export function AccTrackLeaderboard({
  leaderboardByCarGroup,
}: {
  leaderboardByCarGroup: Record<string, AccHotLapEntry[]>;
}) {
  const carGroups = Object.keys(leaderboardByCarGroup).sort();

  if (carGroups.length === 0) {
    return (
      <div className="border border-line/50 bg-carbon-2 px-6 py-8 text-center">
        <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
          No laps recorded yet for this track
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {carGroups.map((carGroup, idx) => (
        <Collapsible key={carGroup} defaultOpen={idx === 0} title={carGroup}>
          <HotLapBoard entries={leaderboardByCarGroup[carGroup].map(toHotLapEntry)} />
        </Collapsible>
      ))}
    </div>
  );
}
