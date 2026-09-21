import { notFound } from 'next/navigation';
import {
  getBoothRoster,
  getNamedBoothRoster,
  getDivisionStandings,
  getStreamChampionship,
  resolveStreamRound,
  streamDivisionIds,
  streamRounds,
} from '@/lib/stream/overlay-data';
import { OverlayCanvas, SponsorTicker } from '@/components/stream/OverlayPrimitives';
import {
  BOOTH_REFRESH_SECONDS,
  DEFAULT_REFRESH_SECONDS,
  MIN_REFRESH_SECONDS,
  PRE_RACE_LEAD_MS,
  type OverlayRefreshPlan,
} from '@/lib/stream/refresh';
import { CalendarOverlay } from '@/components/stream/CalendarOverlay';
import { StandingsOverlay } from '@/components/stream/StandingsOverlay';
import { TrackOverlay } from '@/components/stream/TrackOverlay';
import { RaceInformationOverlay } from '@/components/stream/RaceInformationOverlay';
import { IntermissionOverlay } from '@/components/stream/IntermissionOverlay';
import { SponsorsOverlay } from '@/components/stream/SponsorsOverlay';
import { PartnersOverlay } from '@/components/stream/PartnersOverlay';
import { CommentatorsOverlay, parseLowerThirdCadence } from '@/components/stream/CommentatorsOverlay';
import { SHOW_WINDOWS, ShowOverlay } from '@/components/stream/ShowOverlay';
import { LIVERY_WINDOWS, LiveryOverlay } from '@/components/stream/LiveryOverlay';
import { RevealOverlay, parseWeather } from '@/components/stream/RevealOverlay';
import { TrackListOverlay, parseRoundRange, parseTrackList } from '@/components/stream/TrackListOverlay';
import { parseCommentators } from '@/components/stream/commentators';
import { eventInstant, hasEventTime } from '@/lib/event-time';
import { hasTrackVideo } from '@/lib/stream/media';
import { trackMapKey } from '@/components/stream/track-maps';

// OBS browser sources for the race broadcast. URL shapes match the scene
// collection the crew already runs (scripts/stream-e2e), so swapping the host
// is the only OBS change:
//
//   /overlay/standings/division_1/driver?page=2
//   /overlay/standings/division_1/team
//   /overlay/season_calendar/1
//   /overlay/track_maps/current?division=2 (or /track_maps/silverstone) — opens on
//     the circuit's hero clip and glides it into frame when one exists
//     (&video=0 for the still, &intro=0 to skip the move; refresh on scene
//     switch in OBS so the intro plays from the top)
//   /overlay/race_information/1            transparent — label only
//   /overlay/intermission/1                the division's booth voice channel, live
//   /overlay/commentators/1                transparent lower-third, same source;
//     on air 10 s every 5 min, fading in and out (?every=300&hold=10 to tune,
//     ?every=0 to keep it up permanently)
//     (…?names=A|Lead,B|Analyst on either overrides the channel with a typed list)
//   /overlay/sponsors?footer_message=STREAM%20STARTING%20SOON|...&opacity=.5
//   /overlay/sponsors?video=1&footer_message=...   same, over the ACC hero video
//     (&headline=top puts the message under the lockup instead of over the partners)
//   /overlay/sponsors?mode=horizontal_marquee[&size=2&speed=1]   transparent
//     ticker strip, top-left of the source, size× the in-scene ticker's height
//     (never taller than the source); speed scales the scroll
//   /overlay/partners                      transparent logo slideshow
//   /overlay/show?title=...&names=A,B,C    talk-show bed: three camera windows
//     cut through the page (cameras go underneath in OBS), names left to right
//   /overlay/music?v=VIDEO_ID   a YouTube video looping in an iframe, for a
//     background-music browser source (YouTube refuses embeds with no referrer)
//   /overlay/frame    transparent: the gold camera frame around the edge of the
//     source — size the source to the PiP it sits over (e.g. 1280×720)
//   /overlay/logo     transparent: the SRA lockup filling the source (watermark)
//   /overlay/backdrop[?video=1]   the branded bed on its own, nothing on it:
//     a background for guest clips (?video=1 for the ACC hero clip instead)
//   /overlay/livery?team=Team Name[&names=A,B,C]   livery reveal bed: three
//     camera windows down the left, team plate over a clear stage for the shots
//   /overlay/reveal/5?track=Valencia&weather=wet   schedule reveal: the circuit's
//     hero clip full-bleed, then into a frame beside the round's facts (&intro=0 skips)
//   /overlay/tracklist/1?rounds=1-4&tracks=Silverstone|sunny,Paul Ricard|sunny,…
//     four rounds a scene: photo, map, weather, date and time; tracks from the URL
//
// Every source renders at 2560×1440 natively — set that as the browser
// source width/height in OBS. A 1080p stream is OBS downscaling that render;
// pointing a 1920×1080 source at these URLs gives up resolution for nothing.
//
// Global query params: ?championship=<slug> (default: the running ACC
// division series), ?division=N (default: the path's division_N segment, else
// the first division — track_maps has no such segment, so set it there),
// ?round=N (default: the division's current round),
// ?refresh=<seconds> (default 900: how often the source re-fetches itself;
// every source also refreshes an hour before its division's green flag).

type OverlayProps = {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

// A browser source shows whatever is true at the moment OBS refreshes it.
export const dynamic = 'force-dynamic';

function clampParam(raw: string | undefined, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  return raw !== undefined && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export default async function StreamOverlayPage({ params, searchParams }: OverlayProps) {
  const { path } = await params;
  const query = await searchParams;
  const [scene, value, subtype] = path;

  const championship = await getStreamChampionship(query.championship);
  if (!championship) notFound();

  const divisionIds = streamDivisionIds(championship);
  // ?division=N for scenes whose path segment names something else (the
  // track map's circuit), else the division_N / N segment.
  const requested = Number.parseInt(query.division ?? value?.replace(/^division_/, '') ?? '', 10);
  // A division that isn't one this series runs falls back to the first,
  // never 404s — a scene collection outlives a season's grid.
  const division = divisionIds.includes(requested) ? requested : (divisionIds[0] ?? null);

  const roundOverride = query.round ? Number.parseInt(query.round, 10) : undefined;
  const round = resolveStreamRound(championship, division, Date.now(), roundOverride);
  // The booth is the division's voice channel unless the URL names one.
  const booth = query.names
    ? await getNamedBoothRoster(parseCommentators(query.names))
    : await getBoothRoster(division);

  // A browser source never re-fetches on its own; this is when the page does.
  // Booth scenes only read Supabase, so they can afford to follow the voice
  // channel closely; everything else is paced for the ACCSM rate limit.
  const isBoothScene = scene === 'commentators' || scene === 'intermission';
  const everyRequested = Number.parseInt(query.refresh ?? '', 10);
  const refresh: OverlayRefreshPlan = {
    // startsAt is an authored Eastern wall-clock time; a date-only round has
    // no green flag to lead, so it gets the heartbeat alone.
    at:
      round?.startsAt && hasEventTime(round.startsAt)
        ? new Date(eventInstant(round.startsAt) - PRE_RACE_LEAD_MS).toISOString()
        : null,
    every: Number.isFinite(everyRequested)
      ? Math.max(MIN_REFRESH_SECONDS, everyRequested)
      : isBoothScene
        ? BOOTH_REFRESH_SECONDS
        : DEFAULT_REFRESH_SECONDS,
  };

  if (scene === 'standings' && (subtype === 'driver' || subtype === 'team')) {
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
    const standings = await getDivisionStandings(championship, division);
    if (!standings) notFound();
    return (
      <OverlayCanvas refresh={refresh}>
        <StandingsOverlay
          championship={championship}
          standings={standings}
          round={round}
          type={subtype}
          page={page}
        />
      </OverlayCanvas>
    );
  }

  if (scene === 'season_calendar') {
    return (
      <OverlayCanvas refresh={refresh}>
        <CalendarOverlay
          championship={championship}
          division={division}
          rounds={streamRounds(championship, division, Date.now())}
        />
      </OverlayCanvas>
    );
  }

  if (scene === 'track_maps') {
    const track =
      !value || value === 'current'
        ? (round?.round.track ?? 'Track TBA')
        : value.replaceAll(/[-_]/g, ' ');
    // The season's circuits have a hero clip: the scene opens on it and glides
    // it into frame, the way the schedule reveal did. ?video=0 forces the
    // still; ?intro=0 skips the move.
    const video = query.video !== '0' && (await hasTrackVideo(trackMapKey(track)));
    return (
      <OverlayCanvas refresh={refresh}>
        <TrackOverlay
          championship={championship}
          track={track}
          round={round}
          video={video}
          intro={query.intro !== '0'}
        />
      </OverlayCanvas>
    );
  }

  if (scene === 'race_information') {
    return (
      <OverlayCanvas refresh={refresh} transparent>
        <RaceInformationOverlay championship={championship} division={division} round={round} />
      </OverlayCanvas>
    );
  }

  if (scene === 'intermission') {
    return (
      <OverlayCanvas refresh={refresh}>
        <IntermissionOverlay championship={championship} division={division} round={round} booth={booth} />
      </OverlayCanvas>
    );
  }

  if (scene === 'commentators') {
    return (
      <OverlayCanvas refresh={refresh} transparent>
        <CommentatorsOverlay commentators={booth} cadence={parseLowerThirdCadence(query)} />
      </OverlayCanvas>
    );
  }

  if (scene === 'partners') {
    return (
      <OverlayCanvas refresh={refresh} transparent>
        <PartnersOverlay />
      </OverlayCanvas>
    );
  }

  if (scene === 'sponsors' && query.mode === 'horizontal_marquee') {
    // ?size= is the strip's height as a multiple of the in-scene ticker
    // (2 = twice as tall); ?speed= scales the scroll (2 = twice as fast).
    const size = clampParam(query.size, 1, 6, 2);
    const speed = clampParam(query.speed, 0.25, 4, 1);
    return (
      <OverlayCanvas
        refresh={refresh}
        transparent
        className="ov-ticker-only"
        style={{ '--ov-marquee-size': size, '--ov-ticker-loop': `${Math.round(150 / speed)}s` } as React.CSSProperties}
      >
        <SponsorTicker />
      </OverlayCanvas>
    );
  }

  if (scene === 'sponsors') {
    const parsed = query.opacity === undefined ? NaN : Number(query.opacity);
    const opacity = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : undefined;
    const video = query.video && query.video !== '0' ? '/videos/acc_hero.mov' : undefined;
    return (
      <OverlayCanvas refresh={refresh} opacity={opacity} video={video}>
        <SponsorsOverlay
          championship={championship}
          message={query.footer_message}
          headline={query.headline === 'top' || query.headline === 'middle' ? query.headline : 'bottom'}
        />
      </OverlayCanvas>
    );
  }

  if (scene === 'tracklist') {
    const rounds = streamRounds(championship, division, Date.now());
    return (
      <OverlayCanvas refresh={refresh}>
        <TrackListOverlay
          championship={championship}
          rounds={rounds}
          overrides={parseTrackList(query.tracks)}
          range={parseRoundRange(query.rounds, rounds.length)}
        />
      </OverlayCanvas>
    );
  }

  if (scene === 'reveal') {
    const track = query.track?.trim();
    if (!track) notFound();
    return (
      <OverlayCanvas refresh={refresh}>
        <RevealOverlay
          championship={championship}
          round={Number.isFinite(requested) ? requested : 1}
          track={track}
          weather={parseWeather(query.weather)}
          intro={query.intro !== '0'}
        />
      </OverlayCanvas>
    );
  }

  if (scene === 'music') {
    const v = query.v?.trim();
    if (!v || !/^[A-Za-z0-9_-]{6,20}$/.test(v)) notFound();
    const src = `https://www.youtube-nocookie.com/embed/${v}?autoplay=1&loop=1&playlist=${v}&controls=0&rel=0`;
    return (
      <OverlayCanvas transparent className="ov-music">
        <iframe src={src} title="Background music" allow="autoplay; encrypted-media" />
      </OverlayCanvas>
    );
  }

  // Two transparent utility sources that size to whatever box OBS gives them:
  // the show scene's gold frame around the edge (over a PiP), and the SRA
  // lockup on its own (a watermark). Neither needs data.
  if (scene === 'frame') {
    return (
      <OverlayCanvas transparent className="ov-fill">
        <div className="ov-edge-frame" aria-hidden="true" />
      </OverlayCanvas>
    );
  }

  if (scene === 'logo') {
    return (
      <OverlayCanvas transparent className="ov-fill">
        {/* eslint-disable-next-line @next/next/no-img-element -- static logo */}
        <img className="ov-logo-fill" src="/badges/sra-lockup.webp" alt="Sim Racing Alliance" />
      </OverlayCanvas>
    );
  }

  if (scene === 'backdrop') {
    const video = query.video && query.video !== '0' ? '/videos/acc_hero.mov' : undefined;
    return <OverlayCanvas refresh={refresh} video={video} />;
  }

  if (scene === 'livery') {
    return (
      <OverlayCanvas refresh={refresh} cutouts={LIVERY_WINDOWS}>
        <LiveryOverlay
          championship={championship}
          // The title row stays empty so the team-name source can sit in it.
          title={query.title?.trim() || ' '}
          subtitle={query.subtitle?.trim() || undefined}
          hosts={parseCommentators(query.names)}
        />
      </OverlayCanvas>
    );
  }

  if (scene === 'show') {
    return (
      <OverlayCanvas refresh={refresh} cutouts={SHOW_WINDOWS}>
        <ShowOverlay
          championship={championship}
          title={query.title?.trim() || 'Live Show'}
          subtitle={query.subtitle?.trim() || undefined}
          hosts={parseCommentators(query.names)}
        />
      </OverlayCanvas>
    );
  }

  notFound();
}
