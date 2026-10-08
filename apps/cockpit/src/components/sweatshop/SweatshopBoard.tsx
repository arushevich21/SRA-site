'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { countryFlagUrl } from '@/lib/country-flag';
import { stripSteamIdPrefix } from '@/lib/steam-id';
import { useCurrentDriverContext } from '@/hooks/useCurrentDriverContext';
import type { DriverTierBadge } from '@/lib/driver-tier-badge';
import { NUMBER_QUIPS } from '@/content/sweatshop-quips';

// Client-safe mirror of lib/acc/sweatshop.ts's SweatshopDriver (that module
// is server-only, so its type is restated here rather than imported).
export type SweatshopBoardRow = {
  steamId: string;
  name: string;
  driverNumber: number | null;
  country: string | null;
  badge: DriverTierBadge | null;
  division: number | null;
  divisionOrder: number;
  laps: number;
  validLaps: number;
  rank: number;
};

type SortKey = 'laps' | 'name' | 'division';

const COMPARE: Record<SortKey, (a: SweatshopBoardRow, b: SweatshopBoardRow) => number> = {
  laps: (a, b) => a.laps - b.laps,
  name: (a, b) => a.name.localeCompare(b.name),
  division: (a, b) => a.divisionOrder - b.divisionOrder || b.laps - a.laps,
};

// 'all', a division number, or 'none' for ungraded drivers.
type DivisionFilter = 'all' | number | 'none';

// Rank by laps within the filtered set — competition ranking, so tied lap
// counts share a rank and the next skips, matching the server's overall rank.
function rankByLaps(rows: SweatshopBoardRow[]): SweatshopBoardRow[] {
  const byLaps = [...rows].sort((a, b) => b.laps - a.laps);
  return byLaps.map((r, i) => {
    let rank = i + 1;
    while (rank > 1 && byLaps[rank - 2].laps === r.laps) rank--;
    return { ...r, rank };
  });
}

// Driver | Division | Laps, sortable on every column, filterable to one
// division. Rank and the 💦 always reflect lap count, whatever the current
// sort — re-sorting by name doesn't crown whoever sorts first. Under a
// division filter they're re-ranked within that division, so the 💦 goes to
// the division's sweatiest driver.
export function SweatshopBoard({ rows }: { rows: SweatshopBoardRow[] }) {
  const { steamId: currentSteamId } = useCurrentDriverContext();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'laps', dir: -1 });
  const [division, setDivision] = useState<DivisionFilter>('all');

  // Filter pills: every division someone on the board drives in, plus
  // "Unassigned" only when there are ungraded drivers to show.
  const divisions = useMemo(
    () => [...new Set(rows.flatMap((r) => (r.division != null ? [r.division] : [])))].sort((a, b) => a - b),
    [rows],
  );
  const hasUngraded = rows.some((r) => r.division == null);

  const visible = useMemo(
    () =>
      division === 'all'
        ? rows
        : rankByLaps(rows.filter((r) => (division === 'none' ? r.division == null : r.division === division))),
    [rows, division],
  );
  const sorted = useMemo(
    () => [...visible].sort((a, b) => COMPARE[sort.key](a, b) * sort.dir),
    [visible, sort],
  );
  const maxLaps = visible.reduce((m, r) => Math.max(m, r.laps), 0) || 1;
  const me = currentSteamId ? stripSteamIdPrefix(currentSteamId) : null;

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'laps' ? -1 : 1 }));

  const header = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => {
    const active = sort.key === key;
    return (
      <th
        className={`font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 font-normal py-2 pr-3 whitespace-nowrap ${align === 'right' ? 'text-right' : ''}`}
        aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          onClick={() => onSort(key)}
          className={`inline-flex items-center gap-1.5 uppercase tracking-[inherit] cursor-pointer transition-colors ${active ? 'text-gold' : 'hover:text-txt'}`}
        >
          {label}
          <span className="text-[10px]" aria-hidden>
            {active ? (sort.dir === 1 ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    );
  };

  if (rows.length === 0) {
    return (
      <div className="border border-line/50 bg-carbon-2 px-6 py-8 text-center">
        <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">No laps recorded yet</p>
      </div>
    );
  }

  const filters: { value: DivisionFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    ...divisions.map((d) => ({ value: d, label: `D${d}` })),
    ...(hasUngraded ? [{ value: 'none' as const, label: 'Unassigned' }] : []),
  ];

  return (
    <div>
      {divisions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <span className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3">Division</span>
          <div className="flex gap-1 flex-wrap">
            {filters.map((f) => (
              <button
                key={String(f.value)}
                type="button"
                onClick={() => setDivision(f.value)}
                aria-pressed={division === f.value}
                className={[
                  'font-mono text-[11px] tracking-[.2em] uppercase px-3 py-1.5 border transition-colors cursor-pointer',
                  division === f.value
                    ? 'text-gold border-gold bg-gold/5'
                    : 'text-txt-3 border-line hover:text-txt-2',
                ].join(' ')}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 font-normal py-2 pr-3 w-16">#</th>
              {header('name', 'Driver')}
              {header('division', 'Division')}
              <th className="hidden md:table-cell w-[32%]" aria-hidden />
              {header('laps', 'Laps', 'right')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isMine = me != null && r.steamId === me;
              const validPct = r.laps > 0 ? Math.round((r.validLaps / r.laps) * 100) : 0;
              return (
                <tr
                  key={r.steamId}
                  className="border-b border-line/30"
                  style={isMine ? { backgroundColor: 'color-mix(in srgb, var(--sim-accent) 12%, transparent)' } : undefined}
                >
                  <td className="font-mono text-[15px] py-2 pr-3 whitespace-nowrap">
                    <span style={r.rank <= 3 ? { color: 'var(--sim-accent)' } : undefined}>{r.rank}</span>
                  </td>
                  <td className="font-display font-bold text-[16px] uppercase text-txt py-2 pr-3 max-w-[260px]">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[13px] text-txt-3 shrink-0 w-8 text-right">
                        {r.driverNumber != null ? `#${r.driverNumber}` : ''}
                      </span>
                      <span className="relative w-4 h-[11px] shrink-0 overflow-hidden">
                        {r.country && (
                          <Image src={countryFlagUrl(r.country)} alt={r.country} fill sizes="16px" unoptimized className="object-cover" />
                        )}
                      </span>
                      <span className="truncate min-w-0">{r.name}</span>
                      {r.rank === 1 && (
                        <span className="shrink-0 text-[15px] drop-shadow-[0_0_6px_rgba(94,200,242,.45)]" title="Sweatiest" role="img" aria-label="Sweatiest">
                          💦
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {r.badge ? (
                      <span className="inline-flex items-center gap-2" title={r.badge.label}>
                        <span className="relative w-11 h-[22px] shrink-0">
                          <Image src={r.badge.src} alt={r.badge.label} fill sizes="44px" unoptimized className="object-contain" />
                        </span>
                        <span className="hidden sm:inline font-mono text-[12px] tracking-[.12em] uppercase text-txt-3">
                          {r.badge.label}
                        </span>
                      </span>
                    ) : (
                      <span className="font-mono text-[13px] text-txt-3">—</span>
                    )}
                  </td>
                  <td className="hidden md:table-cell py-2 pr-6" aria-hidden>
                    <div className="h-1.5 bg-line/60 relative">
                      <div
                        className="absolute inset-y-0 left-0"
                        style={{
                          width: `${(r.laps / maxLaps) * 100}%`,
                          background:
                            r.rank === 1
                              ? 'linear-gradient(90deg, var(--color-gold-deep), var(--color-gold-soft))'
                              : 'linear-gradient(90deg, color-mix(in srgb, #5ec8f2 55%, transparent), #5ec8f2)',
                        }}
                      />
                    </div>
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <span className="block font-mono text-[16px] font-medium tabular-nums text-txt">{r.laps.toLocaleString('en-US')}</span>
                    <span className="block font-mono text-[11px] tabular-nums text-txt-3">
                      {r.validLaps.toLocaleString('en-US')} valid · {validPct}%{NUMBER_QUIPS[validPct] && ` (${NUMBER_QUIPS[validPct].tag})`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
