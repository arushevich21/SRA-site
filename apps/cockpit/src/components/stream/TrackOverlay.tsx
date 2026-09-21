import type { ChampionshipContent } from '@/content/championships';
import { eventDateTimeParts } from '@/lib/event-time';
import type { StreamRound } from '@/lib/stream/overlay-data';
import { trackVideoUrl } from '@/lib/stream/media';
import { OverlayFoot, OverlayFrame, OverlayLockup, TrackFlag } from './OverlayPrimitives';
import { REVEAL_FACTS_STYLE, RevealShell } from './RevealOverlay';
import { trackFacts, trackMapKey, trackMapUrl, trackPhotoUrl } from './track-maps';

// The circuit scene. With a hero clip in the stream-media bucket (the
// season's circuits — see hasTrackVideo) it runs the schedule reveal's
// staging: the clip full-bleed, then gliding into its frame beside the
// round's facts and map (?intro=0 skips straight to the settled layout).
// Circuits with no clip get the still: map and facts over the darkened photo.
export function TrackOverlay({
  championship,
  division,
  track,
  round,
  video = false,
  intro = true,
}: {
  championship: ChampionshipContent;
  division: number | null;
  track: string;
  round: StreamRound | null;
  video?: boolean;
  intro?: boolean;
}) {
  const map = trackMapUrl(track);
  const photo = trackPhotoUrl(track);
  const facts = trackFacts(track);
  const when = round ? eventDateTimeParts(round.startsAt, 'America/New_York') : null;

  const lockup = (
    <OverlayLockup
      championship={championship}
      title="Track Map"
      subtitle={facts?.location}
      division={division}
      round={round}
    />
  );
  const name = (
    <h2 className="ov-track-name">
      <small>{round ? `Round ${round.round.round}` : 'Circuit'}</small>
      <TrackFlag track={track} large />
      {track}
    </h2>
  );
  const factGrid = (
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
  );
  const foot = <OverlayFoot left={<>{championship.raceFormat}</>} right="simracingalliance.com" />;

  if (video) {
    return (
      <RevealShell video={trackVideoUrl(trackMapKey(track))} intro={intro}>
        <OverlayFrame ticker>
          {lockup}
          <div className="ov-reveal-body">
            <div className="ov-reveal-facts" style={REVEAL_FACTS_STYLE}>
              {name}
              {factGrid}
              {map && (
                <div className="ov-reveal-map">
                  {/* eslint-disable-next-line @next/next/no-img-element -- static map art */}
                  <img src={map} alt={`${track} circuit map`} />
                </div>
              )}
            </div>
          </div>
          {foot}
        </OverlayFrame>
      </RevealShell>
    );
  }

  return (
    <OverlayFrame ticker>
      {lockup}

      <div className={`ov-track ${photo ? 'has-splash' : ''}`}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- static splash art
          <img className="ov-splash" src={photo} alt="" />
        )}
        <div className="ov-track-map">
          {map ? (
            // eslint-disable-next-line @next/next/no-img-element -- static map art
            <img src={map} alt={`${track} circuit map`} />
          ) : (
            <span className="ov-empty">No map for {track}</span>
          )}
        </div>
        <div className="ov-track-facts">
          {name}
          {factGrid}
        </div>
      </div>

      {foot}
    </OverlayFrame>
  );
}
