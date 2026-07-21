import { sortStandingsWithTiebreak } from '@sra/domain';
import type { ExportedClassGroup, ExportedDriverStanding } from '../lib/standings-types';

// Uploaded JSON carries a `position` per driver, but ties (equal
// championshipPoints) aren't resolved upstream — re-derive rank here so no
// two drivers ever share a position. Tie-break: more races participated
// (non-DNS) ranks higher; otherwise whoever's running total reached the tied
// value in the earliest round ranks higher.
function withResolvedPositions(standings: ExportedDriverStanding[]): ExportedDriverStanding[] {
  const ordered = sortStandingsWithTiebreak(
    standings.map((entry) => ({
      entry,
      totalPoints: entry.championshipPoints,
      rounds: entry.races.map((r) => ({ points: r.dns ? null : (r.pointsTotal ?? 0) })),
    })),
  );
  return ordered.map(({ entry }, i) => ({ ...entry, position: i + 1 }));
}

export function ClassGroupTable({ group }: { group: ExportedClassGroup }) {
  const standings = withResolvedPositions(group.standings);
  const raceCount = standings[0]?.races.length ?? 0;

  return (
    <div>
      <p className="font-mono text-[15px] tracking-[.25em] uppercase text-txt-3 mb-2">
        {group.carClass}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3 w-8">P</th>
              <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3">Driver</th>
              <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3 w-10">#</th>
              <th className="font-sans text-[15px] text-txt-3 py-2 pr-3 hidden lg:table-cell">Car</th>
              <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3 w-16 text-right">Pts</th>
              {Array.from({ length: raceCount }, (_, i) => (
                <th key={i} className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 py-2 w-10 text-center hidden sm:table-cell">
                  R{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.map((entry) => (
              <tr key={entry.id} className="border-b border-line/30">
                <td className={`font-mono text-[15px] py-2 pr-3 ${entry.position <= 3 ? 'text-gold' : 'text-txt-2'}`}>
                  {entry.position}
                </td>
                <td className="font-display font-bold text-[16px] uppercase text-txt py-2 pr-3 truncate max-w-[180px]">
                  {entry.id}
                </td>
                <td className="font-mono text-[15px] text-txt-3 py-2 pr-3">
                  {entry.carNum}
                </td>
                <td className="font-sans text-[15px] text-txt-3 py-2 pr-3 truncate max-w-[200px] hidden lg:table-cell">
                  {entry.car}
                </td>
                <td className="font-mono text-[15px] text-gold-soft py-2 pr-3 text-right">
                  {entry.championshipPoints}
                </td>
                {entry.races.map((race, ri) => (
                  <td
                    key={ri}
                    className={[
                      'font-mono text-[15px] py-2 w-10 text-center hidden sm:table-cell',
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
