'use client';

import { useMemo, useState } from 'react';
import type { HotLapEntry } from '@sra/shared-types';
import { Icon, type IconName } from '@cardog-icons/react';
import { FallbackLogoImage } from './FallbackLogoImage';

// Superset of HotLapEntry — icon fields are optional so AC Evo's raw
// getHotLapBoard() results (which don't carry them) are still assignable
// directly; callers that have resolved an icon (ACC via AccTrackLeaderboard,
// AC Evo's Mazda detection) populate them before passing entries in.
export type HotLapBoardEntry = HotLapEntry & {
  manufacturerIconName?: string | null;
  manufacturerLogoUrl?: string | null;
};

function formatSector(ms: number): string {
  return (ms / 1000).toFixed(3);
}

// Unique Drivers and My Laps are independent toggles (not a single exclusive
// mode) — e.g. both active together means "just my single fastest lap here".
// Neither active is the base view (every row, unfiltered), so there's no
// separate "All Laps" option needed.
function applyFilters(
  entries: HotLapBoardEntry[],
  uniqueOnly: boolean,
  mineOnly: boolean,
  currentSteamId: string | null | undefined,
): HotLapBoardEntry[] {
  let result = mineOnly
    ? currentSteamId
      ? entries.filter((e) => e.steamId === currentSteamId)
      : []
    : entries;

  if (uniqueOnly) {
    const bestBySteamId = new Map<string, HotLapBoardEntry>();
    for (const entry of result) {
      const prev = bestBySteamId.get(entry.steamId);
      if (!prev || entry.bestLapMs < prev.bestLapMs) bestBySteamId.set(entry.steamId, entry);
    }
    result = [...bestBySteamId.values()];
  }

  return [...result].sort((a, b) => a.bestLapMs - b.bestLapMs);
}

function FilterButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'font-mono text-[13px] tracking-[.15em] uppercase px-3 py-1.5 border transition-colors',
        active
          ? 'border-[var(--sim-accent)] text-[var(--sim-accent)]'
          : 'border-line/50 text-txt-3 hover:text-txt hover:border-line',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export type ClassFilter = {
  options: string[];
  selected: string;
  onChange: (value: string) => void;
};

export function HotLapBoard({
  entries,
  currentSteamId,
  classFilter,
}: {
  entries: HotLapBoardEntry[];
  currentSteamId?: string | null;
  classFilter?: ClassFilter;
}) {
  const [uniqueOnly, setUniqueOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);

  const displayedEntries = useMemo(
    () => applyFilters(entries, uniqueOnly, mineOnly, currentSteamId),
    [entries, uniqueOnly, mineOnly, currentSteamId],
  );

  const sectorCount = Math.max(0, ...displayedEntries.map((e) => e.sectorsMs?.length ?? 0));
  const fastestSector = Array.from({ length: sectorCount }, (_, i) =>
    displayedEntries.reduce<number | null>((min, e) => {
      const t = e.sectorsMs?.[i];
      if (t == null) return min;
      return min == null || t < min ? t : min;
    }, null),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        {classFilter && (
          <select
            value={classFilter.selected}
            onChange={(e) => classFilter.onChange(e.target.value)}
            className="font-mono text-[13px] tracking-[.15em] uppercase px-3 py-1.5 border border-line/50 bg-carbon text-txt-3 hover:text-txt hover:border-line transition-colors cursor-pointer"
          >
            {classFilter.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}
        <FilterButton active={uniqueOnly} onClick={() => setUniqueOnly((v) => !v)}>
          Unique Drivers
        </FilterButton>
        <FilterButton
          active={mineOnly}
          disabled={!currentSteamId}
          onClick={() => setMineOnly((v) => !v)}
        >
          My Laps
        </FilterButton>
      </div>

      {displayedEntries.length === 0 ? (
        <div className="border border-line/50 bg-carbon-2 px-6 py-8 text-center">
          <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
            {mineOnly ? "You haven't set a lap here yet" : 'No laps recorded yet for this track'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3 w-16">
                  #
                </th>
                <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3">
                  Driver
                </th>
                <th className="font-sans text-[15px] text-txt-3 py-2 pr-3 hidden lg:table-cell">
                  Car
                </th>
                {Array.from({ length: sectorCount }, (_, i) => (
                  <th
                    key={i}
                    className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 py-2 pl-5 pr-3 w-24 text-right hidden sm:table-cell"
                  >
                    S{i + 1}
                  </th>
                ))}
                <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pl-5 w-28 text-right">
                  Lap Time
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedEntries.map((entry, i) => {
                // Relative = position within the current filtered view
                // (recomputed 1..N here). Absolute = entry.rank, assigned
                // upstream before any of this component's own filtering —
                // the driver's real position in the full, unfiltered field.
                const relativeRank = i + 1;
                const isMine = currentSteamId != null && entry.steamId === currentSteamId;
                return (
                  // A driver can have multiple rows here (one per car
                  // they've set a lap in) — steamId alone is no longer
                  // unique per row.
                  <tr
                    key={`${entry.steamId}-${entry.carModel ?? ''}`}
                    className="border-b border-line/30"
                    style={
                      isMine
                        ? { backgroundColor: 'color-mix(in srgb, var(--sim-accent) 12%, transparent)' }
                        : undefined
                    }
                  >
                    <td className="font-mono text-[15px] py-2 pr-3 whitespace-nowrap">
                      <span style={relativeRank <= 3 ? { color: 'var(--sim-accent)' } : undefined}>
                        {relativeRank}
                      </span>
                      {(uniqueOnly || mineOnly) && (
                        <span className="text-txt-3 ml-2">({entry.rank})</span>
                      )}
                    </td>
                    <td className="font-display font-bold text-[16px] uppercase text-txt py-2 pr-3 truncate max-w-[220px]">
                      {entry.driverName}
                    </td>
                    <td className="font-sans text-[15px] text-txt-3 py-2 pr-3 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                          {entry.manufacturerIconName ? (
                            <Icon name={entry.manufacturerIconName as IconName} size={18} />
                          ) : (
                            entry.manufacturerLogoUrl && (
                              <FallbackLogoImage src={entry.manufacturerLogoUrl} alt={entry.carModel ?? ''} />
                            )
                          )}
                        </span>
                        <span className="truncate max-w-[500px]">{entry.carModel ?? '—'}</span>
                      </div>
                    </td>
                    {Array.from({ length: sectorCount }, (_, si) => {
                      const t = entry.sectorsMs?.[si];
                      const isFastest = t != null && fastestSector[si] != null && t === fastestSector[si];
                      return (
                        <td
                          key={si}
                          className={[
                            'font-mono text-[15px] py-2 pl-5 pr-3 text-right hidden sm:table-cell',
                            isFastest ? 'text-purple' : undefined,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {t != null ? formatSector(t) : '—'}
                        </td>
                      );
                    })}
                    <td
                      className="font-mono text-[15px] py-2 pl-5 text-right"
                      style={{ color: 'var(--sim-accent)' }}
                    >
                      {entry.bestLap}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
