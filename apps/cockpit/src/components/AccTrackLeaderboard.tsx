'use client';

import { useMemo, useState, useTransition } from 'react';
import type { AccHotLapEntry } from '@sra/shared-types';
import { accCarManufacturerIconName, accCarManufacturerLogoUrl } from '@sra/domain';
import type { DriverInfo } from '@/lib/driver-lookup';
import { getReferenceLegend, type LapTier } from '@/lib/acc/reference-times';
import { ACC_CLASSES, LEADERBOARD_PAGE_SIZE } from '@/lib/acc/leaderboard-constants';
import { HotLapBoard, type HotLapBoardEntry } from './HotLapBoard';
import { fetchAccLeaderboardPage } from '@/app/[sim]/leaderboards/actions';

const ALL_CLASSES = 'All';

// Page numbers to render around `current`, collapsing long runs into '...'
// markers — always first, last, current, and one neighbor on each side, so
// any page is reachable in one click regardless of how many pages exist.
// Below 8 pages there's nothing to collapse, so every number just shows.
function pageWindow(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | '...')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push('...');
    out.push(p);
    prev = p;
  }
  return out;
}

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
  initialEntries,
  initialTotalCount,
  trackKey,
  variant,
  scope,
  season,
  qualifying,
  timeLabel,
}: {
  initialEntries: AccBoardEntry[];
  initialTotalCount: number;
  trackKey: string;
  variant: 'lap' | 'stint';
  // Board identity — passed through on every page/class refetch so switching
  // pages or classes queries the same board the initial server render used.
  scope: 'persistent' | 'seasonal';
  season: string;
  qualifying?: boolean; // stint only, ignored for 'lap'
  // Forwarded to HotLapBoard's time-column header — "Stint Avg" for the Hot
  // Stint board, default "Lap Time" otherwise.
  timeLabel?: string;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [page, setPage] = useState(1);
  const [selectedClass, setSelectedClass] = useState<string>(ALL_CLASSES);
  const [isPending, startTransition] = useTransition();
  const referenceLegend = useMemo(() => getReferenceLegend(trackKey, variant), [trackKey, variant]);

  function load(newPage: number, newClass: string) {
    startTransition(async () => {
      const result = await fetchAccLeaderboardPage({
        trackKey,
        variant,
        scope,
        season,
        qualifying,
        page: newPage,
        classFilter: newClass === ALL_CLASSES ? undefined : newClass,
      });
      setEntries(result.entries as AccBoardEntry[]);
      setTotalCount(result.totalCount);
      setPage(newPage);
      setSelectedClass(newClass);
    });
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / LEADERBOARD_PAGE_SIZE));

  return (
    <div className={['flex flex-col gap-3', isPending ? 'opacity-60' : ''].join(' ')}>
      <HotLapBoard
        entries={entries.map(toHotLapEntry)}
        timeLabel={timeLabel}
        referenceLegend={referenceLegend}
        classFilter={{
          options: [ALL_CLASSES, ...ACC_CLASSES],
          selected: selectedClass,
          onChange: (cls) => load(1, cls),
        }}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 flex-wrap pt-2">
          <button
            type="button"
            disabled={page <= 1 || isPending}
            onClick={() => load(page - 1, selectedClass)}
            className="font-mono text-[13px] tracking-[.15em] uppercase px-3 py-1.5 border border-line/50 text-txt-3 hover:text-txt hover:border-line transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            ← Prev
          </button>

          {pageWindow(page, totalPages).map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} className="font-mono text-[13px] text-txt-3 px-1">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                disabled={isPending}
                onClick={() => p !== page && load(p, selectedClass)}
                aria-current={p === page ? 'page' : undefined}
                className={[
                  'font-mono text-[13px] tracking-[.1em] w-9 h-[34px] border transition-colors disabled:cursor-not-allowed',
                  p === page
                    ? 'border-[var(--sim-accent)] text-[var(--sim-accent)]'
                    : 'border-line/50 text-txt-3 hover:text-txt hover:border-line cursor-pointer',
                ].join(' ')}
              >
                {p}
              </button>
            ),
          )}

          <button
            type="button"
            disabled={page >= totalPages || isPending}
            onClick={() => load(page + 1, selectedClass)}
            className="font-mono text-[13px] tracking-[.15em] uppercase px-3 py-1.5 border border-line/50 text-txt-3 hover:text-txt hover:border-line transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
