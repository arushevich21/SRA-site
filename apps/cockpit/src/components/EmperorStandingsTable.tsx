import type { EmperorChampionshipStandings } from '@sra/shared-types';

type RoundPoints = { round: number; track: string; points: Record<string, number> };

export function EmperorStandingsTable({
  data,
  rounds,
}: {
  data: EmperorChampionshipStandings;
  rounds?: RoundPoints[];
}) {
  const classGroups = Object.entries(data.driverStandings);

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
