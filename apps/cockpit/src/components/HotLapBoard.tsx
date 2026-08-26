'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import type { HotLapEntry } from '@sra/shared-types';
import { Icon, type IconName } from '@cardog-icons/react';
import { FallbackLogoImage } from './FallbackLogoImage';
import { countryFlagUrl } from '@/lib/country-flag';
import { LAP_TIER_BADGE, type LapTier, type ReferenceLegendEntry } from '@/lib/acc/reference-times';
import { getDriverTierBadge, type DriverTier } from '@/lib/driver-tier-badge';
import { stripSteamIdPrefix } from '@/lib/steam-id';
import { useCurrentDriverContext } from '@/hooks/useCurrentDriverContext';

const DIVISIONS = [1, 2, 3, 4] as const;

// Superset of HotLapEntry — icon/driver-identity/tier fields are optional so
// AC Evo's raw getHotLapBoard() results (which don't carry them) are still
// assignable directly; callers that have resolved an icon (ACC via
// AccTrackLeaderboard, AC Evo's Mazda detection), enriched with the driver's
// registered number/nationality/division (see lib/driver-lookup.ts), or
// classified against the GT3 reference times (see lib/acc/reference-times.ts)
// populate them before passing entries in. A lap with nothing to show for a
// field simply leaves it null/undefined — no placeholder is shown.
export type HotLapBoardEntry = HotLapEntry & {
  manufacturerIconName?: string | null;
  manufacturerLogoUrl?: string | null;
  driverNumber?: number | null;
  country?: string | null;
  isSralien?: boolean;
  division?: number | null;
  tier?: DriverTier | null;
  lapTier?: LapTier | null;
};

// Times under a minute show as plain seconds (e.g. 34.512); anything a minute
// or longer switches to m:ss.mmm (e.g. 83_456ms → 1:23.456) — long-track
// sectors (Nordschleife etc.) otherwise render as unreadable raw seconds.
function formatSector(ms: number): string {
  if (ms < 60_000) return (ms / 1000).toFixed(3);
  const totalS = Math.floor(ms / 1000);
  const minutes = Math.floor(totalS / 60);
  const seconds = totalS % 60;
  const millis = ms % 1000;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

// ACC leaderboard rows carry steamId with a leading "S" (see
// acc_hotlap_leaderboard's schema); the signed-in user's steamId (from
// drivers.steam_id, via getCurrentDriverContext) is bare. Comparing them
// directly without stripping the prefix always fails for ACC, so "My Laps"
// silently matched nothing and the signed-in row never highlighted — normalize
// both sides before comparing.
function isSameDriver(steamId: string, currentSteamId: string): boolean {
  return stripSteamIdPrefix(steamId) === stripSteamIdPrefix(currentSteamId);
}

// Unique Drivers and My Laps are independent toggles (not a single exclusive
// mode) — e.g. both active together means "just my single fastest lap here".
// Neither active is the base view (every row, unfiltered), so there's no
// separate "All Laps" option needed. divisionFilter is a third, independent
// axis (My Division / D1-D4) — combines with both via AND, same as the rest.
function applyFilters(
  entries: HotLapBoardEntry[],
  uniqueOnly: boolean,
  mineOnly: boolean,
  currentSteamId: string | null | undefined,
  divisionFilter: number | null,
): HotLapBoardEntry[] {
  let result = mineOnly
    ? currentSteamId
      ? entries.filter((e) => isSameDriver(e.steamId, currentSteamId))
      : []
    : entries;

  if (divisionFilter != null) {
    result = result.filter((e) => e.division === divisionFilter);
  }

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
  classFilter,
  timeLabel = 'Lap Time',
  referenceLegend,
}: {
  entries: HotLapBoardEntry[];
  classFilter?: ClassFilter;
  // Header for the time column. Defaults to "Lap Time"; the Hot Stint board
  // passes "Stint Avg" since the value is a 5-lap average, not one lap.
  timeLabel?: string;
  // The GT3 Alien/D1-D4 cutoff-time key for this track (see
  // lib/acc/reference-times.ts), shown once above the board next to Unique
  // Drivers / My Laps — a legend for the per-row tier badges in the Car
  // column (entry.lapTier), which only appear on dry GT3 laps. null/undefined
  // when there's no reference data for this track (AC Evo boards, or an ACC
  // track/layout the GT3 sheet doesn't cover).
  referenceLegend?: ReferenceLegendEntry[] | null;
}) {
  // Fetched client-side (not passed down from a server-side cookie read) so
  // this board can render on a static/ISR page — see useCurrentDriverContext.
  const { steamId: currentSteamId, division: currentDivision } = useCurrentDriverContext();
  const [uniqueOnly, setUniqueOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [divisionFilter, setDivisionFilter] = useState<number | null>(null);

  const displayedEntries = useMemo(
    () => applyFilters(entries, uniqueOnly, mineOnly, currentSteamId, divisionFilter),
    [entries, uniqueOnly, mineOnly, currentSteamId, divisionFilter],
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
        <FilterButton
          active={currentDivision != null && divisionFilter === currentDivision}
          disabled={currentDivision == null}
          onClick={() => setDivisionFilter((d) => (d === currentDivision ? null : (currentDivision ?? null)))}
        >
          My Division
        </FilterButton>
        {DIVISIONS.map((d) => (
          <button
            key={d}
            type="button"
            title={`Division ${d}`}
            onClick={() => setDivisionFilter((cur) => (cur === d ? null : d))}
            className={[
              'flex items-center justify-center w-11 h-[30px] shrink-0 px-1.5 border transition-colors cursor-pointer',
              divisionFilter === d
                ? 'border-[var(--sim-accent)] bg-[color-mix(in_srgb,var(--sim-accent)_14%,transparent)]'
                : 'border-line/50 bg-carbon hover:border-line hover:bg-carbon-2',
            ].join(' ')}
          >
            <span className="relative w-full h-full">
              <Image
                src={`/badges/Division ${d}.png`}
                alt={`Division ${d}`}
                fill
                sizes="44px"
                unoptimized
                className="object-contain"
              />
            </span>
          </button>
        ))}

        {referenceLegend && (
          <div className="flex items-center gap-3 ml-auto flex-wrap">
            {referenceLegend.map(({ tier, time }) => (
              <span key={tier} className="flex items-center gap-1.5" title={LAP_TIER_BADGE[tier].label}>
                <span className="relative w-4 h-4 shrink-0">
                  <Image
                    src={LAP_TIER_BADGE[tier].src}
                    alt={LAP_TIER_BADGE[tier].label}
                    fill
                    sizes="16px"
                    unoptimized
                    className="object-contain"
                  />
                </span>
                <span className="font-mono text-[12px] text-txt-3 tabular-nums">{time}</span>
              </span>
            ))}
          </div>
        )}
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
                  {timeLabel}
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
                const isMine = currentSteamId != null && isSameDriver(entry.steamId, currentSteamId);
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
                      <span className="flex items-center gap-2 min-w-0">
                        {/* Fixed-width number/flag slots, always rendered (even
                            when empty), so every row's name starts at the same
                            x-position regardless of which rows have a number
                            or flag. */}
                        <span className="font-mono text-[13px] text-txt-3 shrink-0 w-8 text-right">
                          {entry.driverNumber != null ? `#${entry.driverNumber}` : ''}
                        </span>
                        <span className="relative w-4 h-[11px] shrink-0 overflow-hidden">
                          {entry.country && (
                            <Image
                              src={countryFlagUrl(entry.country)}
                              alt={entry.country}
                              fill
                              sizes="16px"
                              unoptimized
                              className="object-cover"
                            />
                          )}
                        </span>
                        <span className="truncate min-w-0">{entry.driverName}</span>
                      </span>
                      {/* Below lg the Car column is dropped for width, which
                          left no way to see what anyone drove — the single
                          most-asked-for field on a phone. Repeat it compactly
                          under the driver name instead, and hide it again once
                          the real column returns. */}
                      {/* pl-16 = the 4rem the driver name is indented by: the
                          w-8 number slot + gap-2 + w-4 flag slot + gap-2. */}
                      <span className="lg:hidden flex items-center gap-1.5 mt-0.5 pl-16 text-txt-3">
                        <span className="relative w-4 h-4 shrink-0 flex items-center justify-center">
                          {entry.manufacturerIconName ? (
                            <Icon name={entry.manufacturerIconName as IconName} size={14} />
                          ) : (
                            entry.manufacturerLogoUrl && (
                              <FallbackLogoImage
                                src={entry.manufacturerLogoUrl}
                                alt={entry.carModel ?? ''}
                                sizes="16px"
                              />
                            )
                          )}
                        </span>
                        <span className="font-sans text-[13px] truncate min-w-0">
                          {entry.carModel ?? '—'}
                        </span>
                      </span>
                    </td>
                    <td className="font-sans text-[15px] text-txt-3 py-2 pr-3 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        {/* Reference-time pace badge (dry GT3 laps only —
                            see lib/acc/reference-times.ts) and the driver's
                            real division/SRAlien badge (see
                            lib/driver-tier-badge.ts) — both independent, both
                            shown together, left of the manufacturer badge. */}
                        {entry.lapTier && (
                          <span className="relative w-7 h-7 shrink-0" title={LAP_TIER_BADGE[entry.lapTier].label}>
                            <Image
                              src={LAP_TIER_BADGE[entry.lapTier].src}
                              alt={LAP_TIER_BADGE[entry.lapTier].label}
                              fill
                              sizes="28px"
                              unoptimized
                              className="object-contain"
                            />
                          </span>
                        )}
                        {(() => {
                          const tierBadge = getDriverTierBadge({
                            isSralien: entry.isSralien ?? false,
                            division: entry.division ?? null,
                            tier: entry.tier ?? null,
                          });
                          if (tierBadge) {
                            return (
                              <span className="relative w-7 h-7 shrink-0" title={tierBadge.label}>
                                <Image
                                  src={tierBadge.src}
                                  alt={tierBadge.label}
                                  fill
                                  sizes="28px"
                                  unoptimized
                                  className="object-contain"
                                />
                              </span>
                            );
                          }
                          // No image asset for "unranked" — the real division
                          // badges (see /public/badges) are wide rectangles
                          // (~2.27:1), not squares, so match that shape here
                          // rather than filling the whole w-7 h-7 slot.
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
