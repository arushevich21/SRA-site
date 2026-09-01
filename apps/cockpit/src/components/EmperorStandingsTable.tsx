import { sortStandingsWithTiebreak } from '@sra/domain';
import { Icon, type IconName } from '@cardog-icons/react';
import type { EmperorChampionshipStandings, EmperorDriverStanding } from '@sra/shared-types';
import { getDriverTierBadge, type DriverTier } from '@/lib/driver-tier-badge';
import { FallbackLogoImage } from './FallbackLogoImage';

type RoundPoints = { round: number; track: string; points: Record<string, number> };

// Optional enrichment ChampionshipStandingsBody attaches server-side for an
// ACC championship (car name -> manufacturer icon via accCarModelIdByName,
// steamId -> division/tier/SRAlien via getDriverInfoBySteamIds) — same
// pattern as HotLapBoardEntry extending HotLapEntry. Left undefined for AC
// Evo, which renders exactly as before (plain car text, no badge column).
export type EnrichedDriverStanding = EmperorDriverStanding & {
  manufacturerIconName?: string | null;
  manufacturerLogoUrl?: string | null;
  isSralien?: boolean;
  division?: number | null;
  tier?: DriverTier | null;
};

export type EnrichedChampionshipStandings = {
  driverStandings: Record<string, EnrichedDriverStanding[]>;
  teamStandings: EmperorChampionshipStandings['teamStandings'];
};

// Emperor's own `position` field can repeat across a full points tie (see
// e.g. a 4-way tie all shown as position 8) rather than resolving it — reuse
// the same tiebreak as the locally-uploaded standings tables so no two
// drivers ever share a rank: points desc, then rounds participated desc
// (present in a round's cache = participated; absent = hasn't raced it yet),
// then whoever's running total reached the tied value in the earliest round.
function withResolvedPositions(
  standings: EnrichedDriverStanding[],
  rounds: RoundPoints[] | undefined,
): EnrichedDriverStanding[] {
  if (!rounds || rounds.length === 0) return standings;
  const ordered = sortStandingsWithTiebreak(
    standings.map((entry) => ({
      entry,
      totalPoints: entry.points,
      rounds: rounds.map((r) => ({
        points: entry.steamId in r.points ? r.points[entry.steamId] : null,
      })),
    })),
  );
  return ordered.map(({ entry }, i) => ({ ...entry, position: i + 1 }));
}

export function EmperorStandingsTable({
  data,
  rounds,
}: {
  data: EnrichedChampionshipStandings;
  rounds?: RoundPoints[];
}) {
  const classGroups = Object.entries(data.driverStandings).map(
    ([className, standings]) => [className, withResolvedPositions(standings, rounds)] as const,
  );

  return (
    <div className="flex flex-col gap-10">
      {classGroups.map(([className, standings]) => (
        <div key={className || 'overall'}>
          {className && (
            <p className="font-mono text-[15px] tracking-[.25em] uppercase text-txt-3 mb-2">
              {className}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3 w-8">
                    P
                  </th>
                  <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3">
                    Driver
                  </th>
                  <th className="font-sans text-[15px] text-txt-3 py-2 pr-3 hidden lg:table-cell">
                    Car
                  </th>
                  <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pl-5 w-20 text-right">
                    Pts
                  </th>
                  {rounds?.map((r) => (
                    <th
                      key={r.round}
                      title={r.track}
                      className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 py-2 pl-5 w-16 text-right hidden sm:table-cell"
                    >
                      R{r.round}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {standings.map((entry) => {
                  // The badge column only appears at all once enrichment has
                  // run (isSralien !== undefined) — an AC Evo entry, where it
                  // never runs, renders exactly as before rather than a
                  // column of "NR" chips nobody asked for.
                  const enriched = entry.isSralien !== undefined;
                  const tierBadge = enriched
                    ? getDriverTierBadge({
                        isSralien: entry.isSralien ?? false,
                        division: entry.division ?? null,
                        tier: entry.tier ?? null,
                      })
                    : null;

                  return (
                    <tr key={entry.steamId} className="border-b border-line/30">
                      <td
                        className="font-mono text-[15px] py-2 pr-3"
                        style={entry.position <= 3 ? { color: 'var(--sim-accent)' } : undefined}
                      >
                        {entry.position}
                      </td>
                      <td className="font-display font-bold text-[16px] uppercase text-txt py-2 pr-3 truncate max-w-[220px]">
                        <span className="flex items-center gap-2 min-w-0">
                          {enriched && (
                            <span className="relative w-7 h-7 shrink-0 flex items-center justify-center">
                              {tierBadge ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={tierBadge.src} alt={tierBadge.label} className="w-full h-full object-contain" />
                              ) : (
                                <span
                                  className="flex items-center justify-center w-7 h-[18px] bg-txt-3/40 text-carbon font-display font-black text-[11px] tracking-wide"
                                  title="Not Rated"
                                >
                                  NR
                                </span>
                              )}
                            </span>
                          )}
                          <span className="truncate min-w-0">{entry.driverName}</span>
                        </span>
                      </td>
                      <td className="font-sans text-[15px] text-txt-3 py-2 pr-3 truncate max-w-[200px] hidden lg:table-cell">
                        <span className="flex items-center gap-2">
                          {entry.manufacturerIconName ? (
                            <span className="relative w-5 h-5 shrink-0 flex items-center justify-center">
                              <Icon name={entry.manufacturerIconName as IconName} size={18} />
                            </span>
                          ) : (
                            entry.manufacturerLogoUrl && (
                              <span className="relative w-5 h-5 shrink-0">
                                <FallbackLogoImage src={entry.manufacturerLogoUrl} alt={entry.carModel ?? ''} />
                              </span>
                            )
                          )}
                          <span className="truncate">{entry.carModel ?? '—'}</span>
                        </span>
                      </td>
                      <td
                        className="font-mono text-[15px] py-2 pl-5 text-right"
                        style={{ color: 'var(--sim-accent)' }}
                      >
                        {entry.points}
                      </td>
                      {rounds?.map((r) => (
                        <td
                          key={r.round}
                          className="font-mono text-[15px] text-txt-2 py-2 pl-5 text-right hidden sm:table-cell"
                        >
                          {r.points[entry.steamId] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
