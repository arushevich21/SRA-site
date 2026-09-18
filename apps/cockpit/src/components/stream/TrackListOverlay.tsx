import type { ChampionshipContent } from '@/content/championships';
import { eventDateTimeParts } from '@/lib/event-time';
import type { StreamRound } from '@/lib/stream/overlay-data';
import { seasonLabel } from '@/lib/stream/labels';
import { OverlayFoot, OverlayFrame, OverlayLockup, TrackFlag } from './OverlayPrimitives';
import { WEATHER, parseWeather, type Weather } from './RevealOverlay';
import { isTbaTrack, trackMapUrl, trackPhotoUrl } from './track-maps';

// The season at a glance for the schedule reveal: the calendar's eight cards,
// each the circuit photo with its map, the weather top right, the date and
// time along the bottom, and no "this week". Rounds not yet revealed show as
// TBA, so the show runs one scene with half the season announced and a second
// with all of it. Dates and times come from the schedule in the DB; the
// tracks and weather come from the URL so nothing is public before the show:
//
//   /overlay/tracklist/1?rounds=1-4&tracks=Silverstone|sunny,Paul Ricard|sunny,...
//
// ?tracks= lists every round in order, "Track|weather" per round. ?rounds=
// is the revealed range; everything outside it is TBA whatever the DB says.

export const GT3_SERIES_LOGO = '/badges/gt3_team_series_logo.png';

export type RoundOverride = { track: string; weather: Weather | null };

export function parseTrackList(raw: string | undefined): RoundOverride[] {
  if (!raw) return [];
  return raw.split(',').map((entry) => {
    const [track, weather] = entry.split('|').map((s) => s.trim());
    return { track: track ?? '', weather: parseWeather(weather) };
  });
}

export function parseRoundRange(raw: string | undefined, total: number): [number, number] {
  const m = raw?.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  if (!m) return [1, total];
  return [Number(m[1]), Number(m[2])];
}

export function TrackListOverlay({
  championship,
  rounds,
  overrides,
  range,
}: {
  championship: ChampionshipContent;
  rounds: StreamRound[];
  overrides: RoundOverride[];
  range: [number, number];
}) {

  return (
    <OverlayFrame ticker>
      <OverlayLockup
        championship={championship}
        title={`${seasonLabel(championship)} Track List`}
        subtitle={`${rounds.length}-Round Season · ${championship.raceDays ?? championship.raceFormat}`}
        badge={GT3_SERIES_LOGO}
      />

      <div className="ov-calendar">
        {rounds.slice(0, 8).map((r) => {
          const revealed = r.round.round >= range[0] && r.round.round <= range[1];
          const override = revealed ? overrides[r.round.round - 1] : undefined;
          const track = revealed ? override?.track || r.round.track : 'TBA';
          const weather = override?.weather ?? null;
          const tba = isTbaTrack(track);
          const map = tba ? null : trackMapUrl(track);
          const photo = tba ? null : trackPhotoUrl(track);
          const when = eventDateTimeParts(r.startsAt, 'America/New_York');
          return (
            <article className={`ov-round ${photo ? 'has-splash' : ''}`} key={r.round.round}>
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element -- static splash art
                <img className="ov-splash" src={photo} alt="" />
              )}
              <div className="ov-round-head">
                <b>R{r.round.round}</b>
                <strong className={tba ? 'is-tba' : ''}>
                  {!tba && <TrackFlag track={track} />}
                  {tba ? 'Track TBA' : track}
                </strong>
                {weather && (
                  <span className="ov-round-weather">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static badge */}
                    <img src={WEATHER[weather].badge} alt="" />
                    {WEATHER[weather].label}
                  </span>
                )}
              </div>
              <div className="ov-round-map">
                {map ? (
                  // eslint-disable-next-line @next/next/no-img-element -- static map art
                  <img src={map} alt={`${track} circuit map`} />
                ) : (
                  <span>{tba ? 'TBA' : 'NO MAP'}</span>
                )}
              </div>
              <div className="ov-round-date">
                <strong>{when.date}</strong>
                <span>{when.time ?? r.round.raceLength}</span>
              </div>
            </article>
          );
        })}
      </div>

      <OverlayFoot
        left={<>All times Eastern{championship.raceDays ? ` · ${championship.raceDays}` : ''}</>}
        right="simracingalliance.com/acc/calendar"
      />
    </OverlayFrame>
  );
}
