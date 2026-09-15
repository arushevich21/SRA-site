import type { ChampionshipContent } from '@/content/championships';
import { eventDateTimeParts } from '@/lib/event-time';
import type { StreamRound } from '@/lib/stream/overlay-data';
import { OverlayFoot, OverlayFrame, OverlayLockup } from './OverlayPrimitives';
import { trackFacts, trackMapUrl } from './track-maps';

export function TrackOverlay({
  championship,
  division,
  track,
  round,
}: {
  championship: ChampionshipContent;
  division: number | null;
  track: string;
  round: StreamRound | null;
}) {
  const map = trackMapUrl(track);
  const facts = trackFacts(track);
  const when = round ? eventDateTimeParts(round.startsAt, 'America/New_York') : null;

  return (
    <OverlayFrame ticker>
      <OverlayLockup
        championship={championship}
        title="Track Map"
        subtitle={facts?.location}
        division={division}
        round={round}
      />

      <div className="ov-track">
        <div className="ov-track-map">
          {map ? (
            // eslint-disable-next-line @next/next/no-img-element -- static map art
            <img src={map} alt={`${track} circuit map`} />
          ) : (
            <span className="ov-empty">No map for {track}</span>
          )}
        </div>
        <div className="ov-track-facts">
          <h2 className="ov-track-name">
            <small>{round ? `Round ${round.round.round}` : 'Circuit'}</small>
            {track}
          </h2>
          <div className="ov-facts">
            <div className="ov-fact">
              <span>Length</span>
              <b>{facts?.length ?? '—'}</b>
            </div>
            <div className="ov-fact">
              <span>Turns</span>
              <b>{facts?.turns ?? '—'}</b>
            </div>
            <div className="ov-fact">
              <span>Race</span>
              <b>{round?.round.raceLength ?? championship.raceFormat}</b>
            </div>
            <div className="ov-fact">
              <span>Green flag</span>
              <b>{when?.time ?? 'TBA'}</b>
            </div>
            {when && (
              <div className="ov-fact is-wide">
                <span>Race night</span>
                <b>{when.date}</b>
              </div>
            )}
          </div>
        </div>
      </div>

      <OverlayFoot left={<>{championship.raceFormat}</>} right="simracingalliance.com" />
    </OverlayFrame>
  );
}
