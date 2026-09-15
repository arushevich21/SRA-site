import { accCarModelIdFromName } from '@sra/domain';
import type { EmperorDriverStanding, EmperorTeamStanding } from '@sra/shared-types';
import type { ChampionshipContent } from '@/content/championships';
import { resolveCarLogo } from '@/lib/acc/manufacturer-logo';
import { bareDriverName } from '@/lib/driver-display-name';
import { stripSteamIdPrefix, type DriverInfo } from '@/lib/driver-lookup';
import { getDriverTierBadge } from '@/lib/driver-tier-badge';
import type { DivisionStandings, StreamRound } from '@/lib/stream/overlay-data';
import type { TeamMember } from '@/lib/team-rosters';
import { CarLogo } from '@/components/CarLogo';
import { OverlayFoot, OverlayFrame, OverlayLockup } from './OverlayPrimitives';

// 12 rows a column, two columns a page — the most that stays legible at
// stream bitrates with names, teams and points at a readable size.
export const ROWS_PER_COLUMN = 12;
export const ROWS_PER_PAGE = ROWS_PER_COLUMN * 2;

export function StandingsOverlay({
  championship,
  standings,
  round,
  type,
  page,
}: {
  championship: ChampionshipContent;
  standings: DivisionStandings;
  round: StreamRound | null;
  type: 'driver' | 'team';
  page: number;
}) {
  const totalRounds = championship.schedule.length;
  const progress =
    standings.source === 'live'
      ? `After ${standings.roundsScored} of ${totalRounds} rounds`
      : standings.source === 'entry-list'
        ? `Confirmed entry list · Season starts ${round ? `Round ${round.round.round}` : 'soon'}`
        : 'Standings unavailable';

  const total = type === 'driver' ? standings.drivers.length : standings.teams.length;
  const pageCount = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const start = (page - 1) * ROWS_PER_PAGE;

  return (
    <OverlayFrame ticker>
      <OverlayLockup
        championship={championship}
        title={`${type === 'driver' ? 'Drivers' : 'Teams'} Championship`}
        subtitle={progress}
        division={standings.divisionId}
        round={round}
      />

      {total === 0 ? (
        <div className="ov-empty">No entries for {standings.divisionName} yet</div>
      ) : type === 'driver' ? (
        <DriverColumns
          rows={standings.drivers.slice(start, start + ROWS_PER_PAGE)}
          driverInfo={standings.driverInfo}
          leaderPoints={standings.drivers[0]?.points ?? 0}
          live={standings.source === 'live'}
        />
      ) : (
        <TeamColumns
          rows={standings.teams.slice(start, start + ROWS_PER_PAGE)}
          rosters={standings.rosters}
          leaderPoints={standings.teams[0]?.points ?? 0}
          live={standings.source === 'live'}
        />
      )}

      <OverlayFoot
        left={
          <>
            <b>{standings.divisionName}</b> · {total} {type === 'driver' ? 'drivers' : 'teams'}
            {pageCount > 1 && ` · Page ${page} of ${pageCount}`}
          </>
        }
        right="simracingalliance.com/acc/standings"
      />
    </OverlayFrame>
  );
}

// A full page is 12 + 12; a shorter one is balanced across both columns so
// a 12-car division doesn't leave half the screen empty.
function splitColumns<T>(rows: T[]): T[][] {
  const first = Math.min(ROWS_PER_COLUMN, Math.ceil(rows.length / 2));
  const columns = [rows.slice(0, first), rows.slice(first, ROWS_PER_PAGE)];
  return columns.filter((c) => c.length > 0);
}

function DriverColumns({
  rows,
  driverInfo,
  leaderPoints,
  live,
}: {
  rows: EmperorDriverStanding[];
  driverInfo: Record<string, DriverInfo>;
  leaderPoints: number;
  live: boolean;
}) {
  return (
    <div className="ov-standings">
      {splitColumns(rows).map((column, i) => (
        <div className="ov-standings-col" key={i}>
          {column.map((row) => {
            const info = driverInfo[stripSteamIdPrefix(row.steamId)];
            const logo = resolveCarLogo(accCarModelIdFromName(row.carModel));
            const badge = info ? getDriverTierBadge(info) : null;
            return (
              <article className={`ov-row ${podiumClass(row.position, live)}`} key={row.steamId}>
                <span className="ov-pos">{row.position}</span>
                <span className="ov-num">{info?.driverNumber ?? ''}</span>
                <span className="ov-badge">
                  {badge && (
                    // eslint-disable-next-line @next/next/no-img-element -- static badge art
                    <img src={badge.src} alt={badge.label} title={badge.label} />
                  )}
                </span>
                <div className="ov-driver">
                  <b>{bareDriverName(info?.displayName ?? row.driverName)}</b>
                  <span>{row.teamNames[0] ?? row.carModel ?? ''}</span>
                </div>
                <span className="ov-car">
                  <CarLogo {...logo} alt={row.carModel ?? ''} size={24} />
                </span>
                <Points points={row.points} leaderPoints={leaderPoints} position={row.position} live={live} />
              </article>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function TeamColumns({
  rows,
  rosters,
  leaderPoints,
  live,
}: {
  rows: EmperorTeamStanding[];
  rosters: Map<string, TeamMember[]>;
  leaderPoints: number;
  live: boolean;
}) {
  return (
    <div className="ov-standings">
      {splitColumns(rows).map((column, i) => (
        <div className="ov-standings-col" key={i}>
          {column.map((row) => (
            <article className={`ov-row is-team ${podiumClass(row.position, live)}`} key={row.teamName}>
              <span className="ov-pos">{row.position}</span>
              <div className="ov-team">
                <b>{row.teamName}</b>
                <Roster members={rosters.get(row.teamName) ?? []} />
              </div>
              <Points points={row.points} leaderPoints={leaderPoints} position={row.position} live={live} />
            </article>
          ))}
        </div>
      ))}
    </div>
  );
}

function Roster({ members }: { members: TeamMember[] }) {
  return (
    <div className="ov-roster">
      {members.slice(0, 2).map((m) => (
        <span key={m.steamId}>
          <span className="ov-car">
            <CarLogo {...resolveCarLogo(accCarModelIdFromName(m.carModel))} alt={m.carModel ?? ''} size={16} />
          </span>
          {bareDriverName(m.driverName)}
        </span>
      ))}
    </div>
  );
}

function Points({
  points,
  leaderPoints,
  position,
  live,
}: {
  points: number;
  leaderPoints: number;
  position: number;
  live: boolean;
}) {
  const gap = leaderPoints - points;
  return (
    <span className="ov-points">
      <b>{points}</b>
      {live && (
        <small className={position === 1 ? 'is-leader' : ''}>
          {position === 1 ? 'LEADER' : `−${gap}`}
        </small>
      )}
    </span>
  );
}

// Podium colour only means something once a race has been scored — an
// alphabetical entry list has no "P1".
function podiumClass(position: number, live: boolean): string {
  return live && position <= 3 ? `is-podium-${position}` : '';
}
