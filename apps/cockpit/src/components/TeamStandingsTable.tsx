import { accCarModelIdFromName, buildTeamRounds, type RoundEvent, type TeamRoundCell } from '@sra/domain';
import type { EmperorDriverStanding, EmperorTeamStanding } from '@sra/shared-types';
import { RoundHeaders, PODIUM_CLASS } from './RoundCells';
import { bareDriverName } from '@/lib/driver-display-name';
import { resolveCarLogo } from '@/lib/acc/manufacturer-logo';
import { CarLogo } from './CarLogo';
import { DriverTierBadge } from './DriverTierBadge';
import { stripSteamIdPrefix, type DriverInfo } from '@/lib/driver-lookup';
import type { TeamMember } from '@/lib/team-rosters';

// The team championship table.
//
// Teams are deliberately untiered — a team championship is a single tierless
// standing, so no Gold/Silver control appears on this view. The per-driver
// badges below are each DRIVER's own classification, not a property of the
// team.
//
// Emperor's team rows carry no car and no position (derived from order in
// @sra/emperor-client — see normalizeChampionshipStandings). Per-round
// points aren't on the team row either — they're each driver's per-team
// event points added up (buildTeamRounds), with the team's own drop round.
export function TeamStandingsTable({
  groups,
  rosters,
  driverInfo = {},
  rounds,
  driverStandings,
}: {
  groups: [className: string, standings: EmperorTeamStanding[]][];
  rosters: Map<string, TeamMember[]>;
  driverInfo?: Record<string, DriverInfo>;
  // Round columns + the driver rows they're summed from. Both or neither.
  rounds?: RoundEvent[];
  driverStandings?: Record<string, EmperorDriverStanding[]>;
}) {
  const hasRounds = (rounds?.length ?? 0) > 0 && driverStandings != null;
  const allDrivers = hasRounds ? Object.values(driverStandings!).flat() : [];

  return (
    <div className="flex flex-col gap-10">
      {groups.map(([className, standings]) => {
        const teamRounds = hasRounds ? buildTeamRounds(standings, allDrivers, rounds!) : null;
        return (
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
                    Team
                  </th>
                  <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pr-3 hidden md:table-cell">
                    Drivers
                  </th>
                  <th className="font-mono text-[15px] tracking-[.3em] uppercase text-txt-3 py-2 pl-5 w-20 text-right">
                    Pts
                  </th>
                  {teamRounds && <RoundHeaders rounds={rounds!} />}
                </tr>
              </thead>
              <tbody>
                {standings.map((entry) => {
                  const roster = rosters.get(entry.teamName) ?? [];
                  return (
                    <tr
                      key={`${entry.position}-${entry.teamName}`}
                      className="border-b border-line/30 align-top"
                    >
                      <td
                        className="font-mono text-[15px] py-3 pr-3"
                        style={entry.position <= 3 ? { color: 'var(--sim-accent)' } : undefined}
                      >
                        {entry.position}
                      </td>
                      <td className="py-3 pr-3">
                        <span className="font-display font-bold text-[16px] uppercase text-txt block truncate max-w-[280px]">
                          {entry.teamName}
                        </span>
                        {/* Below the team name on narrow screens, where the
                            dedicated Drivers column is hidden. */}
                        <span className="md:hidden block mt-1">
                          <Roster roster={roster} driverInfo={driverInfo} />
                        </span>
                      </td>
                      <td className="py-3 pr-3 hidden md:table-cell">
                        <Roster roster={roster} driverInfo={driverInfo} />
                      </td>
                      <td
                        className="font-mono text-[15px] py-3 pl-5 text-right"
                        style={{ color: 'var(--sim-accent)' }}
                      >
                        {entry.points}
                      </td>
                      {teamRounds &&
                        (teamRounds.get(entry.teamName) ?? []).map((cell, i) => (
                          <td
                            key={rounds![i].eventId}
                            className="font-mono text-[15px] py-3 pl-5 text-center hidden sm:table-cell"
                          >
                            <TeamRoundCellView cell={cell} />
                          </td>
                        ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        );
      })}
    </div>
  );
}

// Team round cell: the team's combined points that night. Colour is the
// team's RANK among teams that round (there's no "team finishing position"
// in a race), so the superscript reads "1st that night", not a race result.
function TeamRoundCellView({ cell }: { cell: TeamRoundCell }) {
  if (cell.points == null && !cell.dropped) {
    return <span className="text-txt-3/35">—</span>;
  }
  const podium = cell.rank != null && cell.rank <= 3 ? PODIUM_CLASS[cell.rank] : '';
  return (
    <span
      className={[
        'inline-flex items-baseline gap-0.5',
        cell.dropped ? 'text-txt-3/55 line-through decoration-txt-3/70' : podium || 'text-txt-2',
        podium && !cell.dropped ? 'font-bold' : '',
      ].join(' ')}
      title={cell.dropped ? 'Dropped round' : cell.rank != null ? `${cell.rank}${ordinal(cell.rank)} that round` : undefined}
    >
      {cell.points ?? '—'}
      {podium && !cell.dropped && (
        <sup className="text-[9px] tracking-[.05em] opacity-85">{cell.rank}{ordinal(cell.rank!)}</sup>
      )}
    </span>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

function Roster({
  roster,
  driverInfo,
}: {
  roster: TeamMember[];
  driverInfo: Record<string, DriverInfo>;
}) {
  // A team in the standings with nobody listed against it means every one of
  // its drivers is missing a Teams entry — possible, and better shown as a
  // gap than as a confidently empty roster.
  if (roster.length === 0) {
    return <span className="font-mono text-[13px] text-txt-3">—</span>;
  }

  return (
    <span className="flex flex-col gap-1">
      {roster.map((m) => {
        const info = driverInfo[stripSteamIdPrefix(m.steamId)];
        return (
          <span key={m.steamId} className="inline-flex items-center gap-2 min-w-0">
            {info && (
              <DriverTierBadge
                isSralien={info.isSralien}
                division={info.division}
                tier={info.tier}
              />
            )}
            <span className="font-sans text-[15px] text-txt-2 truncate">
              {bareDriverName(m.driverName)}
            </span>
            {/* Each driver's own car — on the Team Series every driver runs
                their own, so it belongs on the roster line, not the team. */}
            <CarLogo
              {...resolveCarLogo(accCarModelIdFromName(m.carModel))}
              alt={m.carModel ?? ''}
              size={18}
            />
          </span>
        );
      })}
    </span>
  );
}
