import type { EmperorTeamStanding } from '@sra/shared-types';
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
// Thinner than EmperorStandingsTable by necessity: Emperor's team rows carry
// no car and no per-round breakdown, and no position either (it's derived from
// order in @sra/emperor-client — see normalizeChampionshipStandings).
export function TeamStandingsTable({
  groups,
  rosters,
  driverInfo = {},
}: {
  groups: [className: string, standings: EmperorTeamStanding[]][];
  rosters: Map<string, TeamMember[]>;
  driverInfo?: Record<string, DriverInfo>;
}) {
  return (
    <div className="flex flex-col gap-10">
      {groups.map(([className, standings]) => (
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
            <span className="font-sans text-[15px] text-txt-2 truncate">{m.driverName}</span>
          </span>
        );
      })}
    </span>
  );
}
