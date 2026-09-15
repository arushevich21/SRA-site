import {
  accCarModelIdFromName,
  buildDriverRounds,
  sortStandingsWithTiebreak,
  type DriverRoundCell,
  type RoundEvent,
} from '@sra/domain';
import type { EmperorChampionshipStandings, EmperorDriverStanding } from '@sra/shared-types';
import { DriverTierBadge } from './DriverTierBadge';
import { stripSteamIdPrefix, type DriverInfo } from '@/lib/driver-lookup';
import { bareDriverName } from '@/lib/driver-display-name';
import { resolveCarLogo } from '@/lib/acc/manufacturer-logo';
import { CarLogo } from './CarLogo';
import { RoundHeaders, PODIUM_CLASS } from './RoundCells';

// Emperor's own `position` field can repeat across a full points tie (see
// e.g. a 4-way tie all shown as position 8) rather than resolving it — reuse
// the same tiebreak as the locally-uploaded standings tables so no two
// drivers ever share a rank: points desc, then rounds participated desc
// (present in a round = participated; absent = hasn't raced it yet), then
// whoever's running total reached the tied value in the earliest round.
function withResolvedPositions(
  standings: EmperorDriverStanding[],
  cells: Map<string, DriverRoundCell[]>,
): EmperorDriverStanding[] {
  if (cells.size === 0) return standings;
  const ordered = sortStandingsWithTiebreak(
    standings.map((entry) => ({
      entry,
      totalPoints: entry.points,
      rounds: (cells.get(entry.steamId) ?? []).map((c) => ({ points: c.points })),
    })),
  );
  return ordered.map(({ entry }, i) => ({ ...entry, position: i + 1 }));
}

export function EmperorStandingsTable({
  data,
  rounds,
  driverInfo = {},
}: {
  data: EmperorChampionshipStandings;
  // Round columns — one per championship event with an ingested race (see
  // lib/acc/championship-rounds.ts). Omit for a plain points table.
  rounds?: RoundEvent[];
  driverInfo?: Record<string, DriverInfo>;
}) {
  const hasRounds = (rounds?.length ?? 0) > 0;

  const classGroups = Object.entries(data.driverStandings).map(([className, standings]) => {
    const roundsByDriver = new Map(
      hasRounds ? standings.map((d) => [d.steamId, buildDriverRounds(d, rounds!)] as const) : [],
    );
    const cells = new Map([...roundsByDriver].map(([id, r]) => [id, r.cells]));
    return [className, withResolvedPositions(standings, cells), roundsByDriver] as const;
  });

  return (
    <div className="flex flex-col gap-10">
      {classGroups.map(([className, standings, roundsByDriver]) => (
        <div key={className || 'overall'}>
          {className && (
            <p className="font-mono text-[15px] tracking-[.25em] uppercase text-txt-3 mb-2">
              {className}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left tabular-nums">
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
                  {hasRounds && (
                    <>
                      <RoundHeaders rounds={rounds!} />
                      <th
                        title="Fastest laps"
                        className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 py-2 pl-5 w-14 text-right hidden sm:table-cell"
                      >
                        FL
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {standings.map((entry) => {
                  const info = driverInfo[stripSteamIdPrefix(entry.steamId)];
                  const driverRounds = roundsByDriver.get(entry.steamId);
                  return (
                    <tr key={entry.steamId} className="border-b border-line/30">
                      <td
                        className="font-mono text-[15px] py-2 pr-3"
                        style={entry.position <= 3 ? { color: 'var(--sim-accent)' } : undefined}
                      >
                        {entry.position}
                      </td>
                      <td className="font-display font-bold text-[16px] uppercase text-txt py-2 pr-3 truncate max-w-[220px]">
                        <span className="inline-flex items-center gap-2">
                          {info && (
                            <DriverTierBadge isSralien={info.isSralien} division={info.division} tier={info.tier} />
                          )}
                          {/* Emperor's own names carry no ┊number, but the
                              pre-race entry list (getEntryListAsZeroStandings)
                              feeds drivers.display_name through here, which
                              does — strip it either way. */}
                          {bareDriverName(entry.driverName)}
                        </span>
                      </td>
                      <td className="font-sans text-[15px] text-txt-3 py-2 pr-3 max-w-[240px] hidden lg:table-cell">
                        {/* Emperor gives the car as a NAME; accCarModelIdFromName
                            gets the id back so the logo resolves the same way
                            the register page's entry list does. Unknown name =>
                            no logo, name still shown. */}
                        <span className="flex items-center gap-3 min-w-0">
                          <CarLogo
                            {...resolveCarLogo(accCarModelIdFromName(entry.carModel))}
                            alt={entry.carModel ?? ''}
                            size={22}
                          />
                          <span className="truncate">{entry.carModel ?? '—'}</span>
                        </span>
                      </td>
                      <td
                        className="font-mono text-[15px] py-2 pl-5 text-right"
                        style={{ color: 'var(--sim-accent)' }}
                      >
                        {entry.points}
                      </td>
                      {driverRounds && (
                        <>
                          {driverRounds.cells.map((cell, i) => (
                            <td
                              key={rounds![i].eventId}
                              className="font-mono text-[15px] py-2 pl-5 text-center hidden sm:table-cell"
                            >
                              <DriverRoundCellView cell={cell} />
                            </td>
                          ))}
                          <td
                            className={[
                              'font-mono text-[15px] py-2 pl-5 text-right hidden sm:table-cell',
                              driverRounds.fastestLaps > 0 ? 'text-purple' : 'text-txt-3/35',
                            ].join(' ')}
                          >
                            {driverRounds.fastestLaps}
                          </td>
                        </>
                      )}
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

// One round cell, variant "A" from the design preview: the points are the
// number; a podium finish colours it and adds a small P1/P2/P3 superscript;
// a fastest lap is a purple dot; a dropped round is dimmed and struck
// through with the points still legible.
function DriverRoundCellView({ cell }: { cell: DriverRoundCell }) {
  if (cell.points == null && !cell.dropped) {
    return <span className="text-txt-3/35">—</span>;
  }
  const podium = cell.finish != null && cell.finish <= 3 ? PODIUM_CLASS[cell.finish] : '';
  return (
    <span
      className={[
        'inline-flex items-baseline gap-0.5',
        cell.dropped ? 'text-txt-3/55 line-through decoration-txt-3/70' : podium || 'text-txt-2',
        podium && !cell.dropped ? 'font-bold' : '',
      ].join(' ')}
      title={cell.dropped ? 'Dropped round' : cell.finish != null ? `Finished P${cell.finish}` : undefined}
    >
      {cell.points ?? '—'}
      {podium && !cell.dropped && (
        <sup className="text-[9px] tracking-[.05em] opacity-85">P{cell.finish}</sup>
      )}
      {cell.fastestLap && (
        <i
          title="Fastest lap"
          className="inline-block w-1.5 h-1.5 rounded-full bg-purple shadow-[0_0_6px_rgba(177,78,255,.6)] ml-1 self-center"
        />
      )}
    </span>
  );
}
