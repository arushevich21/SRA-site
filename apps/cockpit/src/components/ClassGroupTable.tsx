import type { ExportedClassGroup } from '../lib/standings-types';

export function ClassGroupTable({ group }: { group: ExportedClassGroup }) {
  const raceCount = group.standings[0]?.races.length ?? 0;

  return (
    <div>
      <p className="font-mono text-[11px] tracking-[.25em] uppercase text-txt-3 mb-2">
        {group.carClass}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3 w-8">P</th>
              <th className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3">Driver</th>
              <th className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3 w-10">#</th>
              <th className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3 hidden lg:table-cell">Car</th>
              <th className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3 w-16 text-right">Pts</th>
              {Array.from({ length: raceCount }, (_, i) => (
                <th key={i} className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 py-2 w-10 text-center hidden sm:table-cell">
                  R{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.standings.map((entry) => (
              <tr key={entry.id} className="border-b border-line/30">
                <td className={`font-mono text-[12px] py-2 pr-3 ${entry.position <= 3 ? 'text-gold' : 'text-txt-2'}`}>
                  {entry.position}
                </td>
                <td className="font-display font-bold text-[13px] uppercase text-txt py-2 pr-3 truncate max-w-[180px]">
                  {entry.id}
                </td>
                <td className="font-mono text-[12px] text-txt-3 py-2 pr-3">
                  {entry.carNum}
                </td>
                <td className="font-sans text-[12px] text-txt-3 py-2 pr-3 truncate max-w-[200px] hidden lg:table-cell">
                  {entry.car}
                </td>
                <td className="font-mono text-[12px] text-gold-soft py-2 pr-3 text-right">
                  {entry.championshipPoints}
                </td>
                {entry.races.map((race, ri) => (
                  <td
                    key={ri}
                    className={[
                      'font-mono text-[11px] py-2 w-10 text-center hidden sm:table-cell',
                      race.dnf ? 'text-gold-deep' : race.dns ? 'text-txt-3/40' : race.pointsTotal == null ? 'text-txt-3/30' : 'text-txt-2',
                    ].join(' ')}
                  >
                    {race.pointsTotal == null ? '—' : race.dnf ? `${race.pointsTotal}*` : race.pointsTotal}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
