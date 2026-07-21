import { sortStandingsWithTiebreak } from '@sra/domain';
import type { EmperorChampionshipStandings, EmperorDriverStanding } from '@sra/shared-types';

type RoundPoints = { round: number; track: string; points: Record<string, number> };

// Emperor's own `position` field can repeat across a full points tie (see
// e.g. a 4-way tie all shown as position 8) rather than resolving it — reuse
// the same tiebreak as the locally-uploaded standings tables so no two
// drivers ever share a rank: points desc, then rounds participated desc
// (present in a round's cache = participated; absent = hasn't raced it yet),
// then whoever's running total reached the tied value in the earliest round.
function withResolvedPositions(
  standings: EmperorDriverStanding[],
  rounds: RoundPoints[] | undefined,
): EmperorDriverStanding[] {
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
  data: EmperorChampionshipStandings;
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
                {standings.map((entry) => (
                  <tr key={entry.steamId} className="border-b border-line/30">
                    <td
                      className="font-mono text-[15px] py-2 pr-3"
                      style={entry.position <= 3 ? { color: 'var(--sim-accent)' } : undefined}
                    >
                      {entry.position}
                    </td>
                    <td className="font-display font-bold text-[16px] uppercase text-txt py-2 pr-3 truncate max-w-[220px]">
                      {entry.driverName}
                    </td>
                    <td className="font-sans text-[15px] text-txt-3 py-2 pr-3 truncate max-w-[200px] hidden lg:table-cell">
                      {entry.carModel ?? '—'}
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
