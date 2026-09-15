import type { ChampionshipContent } from '@/content/championships';
import { eventDateTimeParts } from '@/lib/event-time';
import type { DivisionStandings, StreamRound } from '@/lib/stream/overlay-data';
import { bareDriverName } from '@/lib/driver-display-name';
import { stripSteamIdPrefix } from '@/lib/driver-lookup';
import type { Commentator } from './commentators';
import { OverlayFoot, OverlayFrame, OverlayLockup, TrackFlag } from './OverlayPrimitives';
import { isTbaTrack, trackFacts, trackMapUrl } from './track-maps';

// Between sessions: tonight's round on the left, the booth on the right.
export function IntermissionOverlay({
  championship,
  division,
  round,
  commentators,
  standings,
}: {
  championship: ChampionshipContent;
  division: number | null;
  round: StreamRound | null;
  commentators: Commentator[];
  standings: DivisionStandings | null;
}) {
  const track = round?.round.track ?? '';
  const map = round && !isTbaTrack(track) ? trackMapUrl(track) : null;
  const facts = round ? trackFacts(track) : null;
  const when = round ? eventDateTimeParts(round.startsAt, 'America/New_York') : null;

  return (
    <OverlayFrame ticker>
      <OverlayLockup
        championship={championship}
        title="We'll be right back"
        subtitle={facts?.location}
        division={division}
        round={round}
      />

      <div className="ov-intermission">
        <section className="ov-next">
          <h2 className="ov-track-name">
            <small>{round ? `Tonight · Round ${round.round.round}` : 'Tonight'}</small>
            {round && !isTbaTrack(track) && <TrackFlag track={track} large />}
            {round ? (isTbaTrack(track) ? 'Track TBA' : track) : 'Race night'}
          </h2>
          <div className="ov-next-map">
            {map && (
              // eslint-disable-next-line @next/next/no-img-element -- static map art
              <img src={map} alt={`${track} circuit map`} />
            )}
          </div>
          <div className="ov-next-when">
            <span>
              <b>{when?.date ?? 'TBA'}</b>
              {when?.time && ` · ${when.time}`}
            </span>
            <span>{round?.round.raceLength ?? championship.raceFormat}</span>
          </div>
        </section>

        <section className="ov-booth">
          {commentators.length === 0 ? (
            <div className="ov-empty">Booth</div>
          ) : (
            commentators.map((c) => (
              <div className="ov-booth-card" key={c.name}>
                <span className="ov-live-dot" aria-hidden="true" />
                <div>
                  <b>{c.name}</b>
                  <span>{c.role ?? 'Commentator'}</span>
                </div>
              </div>
            ))
          )}
          {standings && <StandingsSnapshot standings={standings} totalRounds={championship.schedule.length} />}
        </section>
      </div>

      <OverlayFoot left={<>{championship.raceFormat}</>} right="discord.gg/SimRacingAlliance" />
    </OverlayFrame>
  );
}

// What the booth is talking over: the top five once racing has started, the
// size of the grid before it has.
function StandingsSnapshot({
  standings,
  totalRounds,
}: {
  standings: DivisionStandings;
  totalRounds: number;
}) {
  if (standings.source !== 'live') {
    return (
      <div className="ov-snapshot">
        <h2>{standings.divisionName} grid</h2>
        <p className="ov-snapshot-big">
          <b>{standings.drivers.length}</b> drivers <i>·</i> <b>{standings.teams.length}</b> teams
        </p>
      </div>
    );
  }
  return (
    <div className="ov-snapshot">
      <h2>
        Championship top 5 <span>after {standings.roundsScored} of {totalRounds}</span>
      </h2>
      <ol>
        {standings.drivers.slice(0, 5).map((d) => (
          <li key={d.steamId}>
            <span className="ov-snapshot-pos">{d.position}</span>
            <span className="ov-snapshot-name">
              {bareDriverName(standings.driverInfo[stripSteamIdPrefix(d.steamId)]?.displayName ?? d.driverName)}
            </span>
            <span className="ov-snapshot-team">{d.teamNames[0] ?? ''}</span>
            <b>{d.points}</b>
          </li>
        ))}
      </ol>
    </div>
  );
}
