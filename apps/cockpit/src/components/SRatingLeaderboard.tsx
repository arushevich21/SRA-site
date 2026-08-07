'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import type { SRatingRow } from '@/lib/acc/srating';
import { getDriverTierBadge } from '@/lib/driver-tier-badge';
import { useCurrentDriverContext } from '@/hooks/useCurrentDriverContext';

function fmtPct(v: number | null): string {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`;
}

// Row id other components (e.g. the "jump to my rank" button on
// SRatingSelfCard) scroll to — keyed by driverId since it's stable across
// re-sorts, unlike the row's position in the table.
export function srowId(driverId: string): string {
  return `srating-row-${driverId}`;
}

type SortKey = 'composite' | 'pace' | 'racecraft' | 'races' | 'season';

// All columns sort highest-first — every one of these is a "bigger is
// better" metric (including last_season, where higher = more recent), so
// there's no ascending mode to toggle into.
const SORTERS: Record<SortKey, (r: SRatingRow) => number | null> = {
  composite: (r) => r.composite,
  pace: (r) => r.pacePct,
  racecraft: (r) => r.osPct,
  races: (r) => r.numRaces,
  season: (r) => r.lastSeason,
};

function SortableHeader({
  label,
  sortKey,
  activeKey,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === activeKey;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={[
          'font-mono text-[13px] tracking-[.15em] uppercase whitespace-nowrap cursor-pointer transition-colors',
          active ? 'text-txt' : 'text-txt-3 hover:text-txt-2',
        ].join(' ')}
        style={active ? { color: 'var(--sim-accent)' } : undefined}
      >
        {label}
        <span className="inline-block w-3 text-center">{active ? '▾' : ''}</span>
      </button>
    </th>
  );
}

export function SRatingLeaderboard({ rows }: { rows: SRatingRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('composite');
  const { driverId } = useCurrentDriverContext();

  const sortedRows = useMemo(() => {
    const value = SORTERS[sortKey];
    return [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av;
    });
  }, [rows, sortKey]);

  return (
    <div className="border border-line bg-panel overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            <th className="font-mono text-[13px] tracking-[.15em] uppercase text-txt-3 py-2 pl-6 pr-3 w-16 whitespace-nowrap">
              #
            </th>
            <th className="font-mono text-[13px] tracking-[.15em] uppercase text-txt-3 py-2 pr-3 whitespace-nowrap">
              Driver
            </th>
            <SortableHeader
              label="SRAting"
              sortKey="composite"
              activeKey={sortKey}
              onSort={setSortKey}
              className="py-2 pl-5 w-24 text-right"
            />
            <SortableHeader
              label="Pace"
              sortKey="pace"
              activeKey={sortKey}
              onSort={setSortKey}
              className="py-2 pl-5 w-20 text-right hidden sm:table-cell"
            />
            <SortableHeader
              label="Racecraft"
              sortKey="racecraft"
              activeKey={sortKey}
              onSort={setSortKey}
              className="py-2 pl-5 w-24 text-right hidden sm:table-cell"
            />
            <SortableHeader
              label="Races"
              sortKey="races"
              activeKey={sortKey}
              onSort={setSortKey}
              className="py-2 pl-5 w-16 text-right hidden md:table-cell"
            />
            <SortableHeader
              label="Season"
              sortKey="season"
              activeKey={sortKey}
              onSort={setSortKey}
              className="py-2 pl-5 pr-6 w-16 text-right hidden md:table-cell"
            />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r, i) => {
            const relativeRank = i + 1;
            const isMine = driverId != null && r.driverId === driverId;
            return (
              <tr
                key={r.playerId}
                id={srowId(r.driverId)}
                className="border-b border-line/30 scroll-mt-24"
                style={
                  isMine
                    ? { backgroundColor: 'color-mix(in srgb, var(--sim-accent) 12%, transparent)' }
                    : undefined
                }
              >
                <td
                  className="font-mono text-[15px] py-2 pl-6 pr-3 whitespace-nowrap"
                  style={relativeRank <= 3 ? { color: 'var(--sim-accent)' } : undefined}
                >
                  {relativeRank}
                  {sortKey !== 'composite' && (
                    <span className="text-txt-3 ml-1.5 text-[12px]">({r.rank})</span>
                  )}
                </td>
                <td className="font-display font-bold text-[16px] uppercase text-txt py-2 pr-3">
                  <span className="flex items-center gap-2 min-w-0">
                    {(() => {
                      const tierBadge = getDriverTierBadge({
                        isSralien: r.isSralien,
                        division: r.division,
                        tier: r.tier,
                      });
                      if (tierBadge) {
                        return (
                          <span className="relative w-7 h-7 shrink-0" title={tierBadge.label}>
                            <Image src={tierBadge.src} alt={tierBadge.label} fill className="object-contain" />
                          </span>
                        );
                      }
                      // No image asset for "unranked" — the real division badges
                      // (see /public/badges) are wide rectangles (~2.27:1), not
                      // squares, so match that shape here rather than filling
                      // the whole w-7 h-7 slot (see HotLapBoard.tsx).
                      return (
                        <span className="w-7 h-7 shrink-0 flex items-center justify-center">
                          <span
                            className="flex items-center justify-center w-7 h-[18px] bg-txt-3/40 text-carbon font-display font-black text-[11px] tracking-wide"
                            title="Not Rated"
                          >
                            NR
                          </span>
                        </span>
                      );
                    })()}
                    <span
                      className={['truncate min-w-0', isMine ? 'text-gold' : ''].join(' ')}
                    >
                      {r.displayName}
                    </span>
                  </span>
                </td>
                <td className="font-mono text-[15px] py-2 pl-5 text-right" style={{ color: 'var(--sim-accent)' }}>
                  {fmtPct(r.composite)}
                </td>
                <td className="font-mono text-[15px] text-txt-2 py-2 pl-5 text-right hidden sm:table-cell">
                  {fmtPct(r.pacePct)}
                </td>
                <td className="font-mono text-[15px] text-txt-2 py-2 pl-5 text-right hidden sm:table-cell">
                  {fmtPct(r.osPct)}
                </td>
                <td className="font-mono text-[15px] text-txt-2 py-2 pl-5 pr-6 text-right hidden md:table-cell">
                  {r.numRaces ?? '—'}
                </td>
                <td className="font-mono text-[15px] text-txt-2 py-2 pl-5 pr-6 text-right hidden md:table-cell">
                  {r.lastSeason ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
