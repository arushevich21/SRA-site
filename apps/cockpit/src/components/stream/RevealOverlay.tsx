import type { ChampionshipContent } from '@/content/championships';
import { seasonLabel } from '@/lib/stream/labels';
import { OverlayFoot, OverlayFrame, OverlayLockup, TrackFlag } from './OverlayPrimitives';
import { trackFacts, trackMapKey, trackMapUrl } from './track-maps';
import { trackVideoUrl } from '@/lib/stream/media';

// One round of the schedule reveal. The scene opens on the circuit's hero clip
// full-bleed and alone; after INTRO_HOLD_S the clip glides into a frame on
// the left while the ticker, lockup and the round's facts come in around it.
// The clip keeps looping in its frame. Everything about the round is on the
// URL, so a deployed page gives nothing away before the show:
//
//   /overlay/reveal/5?track=Valencia&weather=wet
//
// ?weather= is sunny | wet | night | variable (badges in public/badges). The
// clip comes from the stream-media bucket (lib/stream/media.ts), keyed like
// the maps and photos.
// ?intro=0 skips straight to the settled layout.
//
// OBS: tick "Refresh browser when scene becomes active" on these sources so
// the intro plays from the top every time the scene is switched to.

// Five seconds of the clip alone, then an unhurried move — a fast one drops
// frames in OBS's browser while the clip is still decoding underneath.
export const INTRO_HOLD_S = 5;
export const INTRO_MOVE_S = 1.4;

// Where the clip lands, in canvas units. A 16:9 frame in the left of the
// content area; the facts column takes what's right of it.
export const CLIP_FRAME = { x: 3, y: 17.5, w: 55, h: 30.9375 };

export const WEATHER = {
  sunny: { label: 'Sunny', badge: '/badges/Sun.png' },
  wet: { label: 'Wet', badge: '/badges/Rain.png' },
  night: { label: 'Night', badge: '/badges/Moon.png' },
  variable: { label: 'Variable', badge: '/badges/Variable.png' },
} as const;
export type Weather = keyof typeof WEATHER;

export function parseWeather(raw: string | undefined): Weather | null {
  const key = raw?.trim().toLowerCase();
  return key && key in WEATHER ? (key as Weather) : null;
}

export function RevealOverlay({
  championship,
  round,
  track,
  weather,
  intro = true,
}: {
  championship: ChampionshipContent;
  round: number;
  track: string;
  weather: Weather | null;
  intro?: boolean;
}) {
  const key = trackMapKey(track);
  const facts = trackFacts(track);
  const map = trackMapUrl(track);
  const video = trackVideoUrl(key);
  const style = {
    '--ov-intro-hold': `${intro ? INTRO_HOLD_S : 0}s`,
    '--ov-intro-move': `${intro ? INTRO_MOVE_S : 0}s`,
    '--ov-clip-x': `calc(${CLIP_FRAME.x} * var(--u))`,
    '--ov-clip-y': `calc(${CLIP_FRAME.y} * var(--u))`,
    '--ov-clip-scale': `${CLIP_FRAME.w / 100}`,
  } as React.CSSProperties;

  return (
    <div className={`ov-reveal ${intro ? '' : 'is-settled'}`} style={style}>
      {/* The clip: full-bleed at first, then scaled and translated into its frame.
          Both rectangles are 16:9, so it's one transform — no reflow, no jank. */}
      <div className="ov-reveal-stage">
        <video src={video} autoPlay muted loop playsInline aria-hidden="true" />
      </div>
      <div
        className="ov-reveal-frame"
        style={{
          left: `calc(${CLIP_FRAME.x} * var(--u))`,
          top: `calc(${CLIP_FRAME.y} * var(--u))`,
          width: `calc(${CLIP_FRAME.w} * var(--u))`,
          height: `calc(${CLIP_FRAME.h} * var(--u))`,
        }}
      />

      <OverlayFrame ticker>
        <OverlayLockup
          championship={championship}
          title={`${seasonLabel(championship)} Schedule`}
          subtitle={`Round ${round} of ${championship.schedule.length || 8}`}
        />

        {/* .ov-reveal-body keeps the grid row (so the footer stays put); the
            facts column inside it is positioned against the canvas, top-aligned
            with the clip frame and as tall as it. The map fills what the facts
            leave. */}
        <div className="ov-reveal-body">
        <div
          className="ov-reveal-facts"
          style={{
            top: `calc(${CLIP_FRAME.y} * var(--u))`,
            height: `calc(${CLIP_FRAME.h} * var(--u))`,
          }}
        >
          <h2 className="ov-track-name">
            <small>Round {round}</small>
            <TrackFlag track={track} large />
            {track}
          </h2>
          {facts?.location && <p className="ov-reveal-location">{facts.location}</p>}
          <div className="ov-facts">
            <div className="ov-fact">
              <span>Length</span>
              <b>{facts?.length ?? '—'}</b>
            </div>
            <div className="ov-fact">
              <span>Turns</span>
              <b>{facts?.turns ?? '—'}</b>
            </div>
            {weather && (
              <div className="ov-fact ov-fact-weather is-wide">
                <span>Conditions</span>
                <b>
                  {/* eslint-disable-next-line @next/next/no-img-element -- static badge */}
                  <img src={WEATHER[weather].badge} alt="" />
                  {WEATHER[weather].label}
                </b>
              </div>
            )}
          </div>
          {map && (
            <div className="ov-reveal-map">
              {/* eslint-disable-next-line @next/next/no-img-element -- static map art */}
              <img src={map} alt={`${track} circuit map`} />
            </div>
          )}
        </div>
        </div>

        <OverlayFoot left={<>{championship.raceFormat}</>} right="simracingalliance.com/acc/calendar" />
      </OverlayFrame>
    </div>
  );
}
