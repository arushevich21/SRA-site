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
import { CommentatorsOverlay } from '@/components/stream/CommentatorsOverlay';
import { CAM_WINDOWS, ShowOverlay } from '@/components/stream/ShowOverlay';
import { parseCommentators } from '@/components/stream/commentators';
import { eventInstant, hasEventTime } from '@/lib/event-time';

// OBS browser sources for the race broadcast. URL shapes match the scene
// collection the crew already runs (scripts/stream-e2e), so swapping the host
// is the only OBS change:
//
//   /overlay/standings/division_1/driver?page=2
//   /overlay/standings/division_1/team
//   /overlay/season_calendar/1
//   /overlay/track_maps/current            (or /track_maps/silverstone)
//   /overlay/race_information/1            transparent — label only
//   /overlay/intermission/1                the division's booth voice channel, live
//   /overlay/commentators/1                transparent lower-third, same source
//     (…?names=A|Lead,B|Analyst on either overrides the channel with a typed list)
//   /overlay/sponsors?footer_message=STREAM%20STARTING%20SOON|...&opacity=.5
//   /overlay/sponsors?video=1&footer_message=...   same, over the ACC hero video
//   /overlay/sponsors?mode=horizontal_marquee   transparent ticker strip
//   /overlay/partners                      transparent logo slideshow
//   /overlay/show?title=...&names=A,B,C    talk-show bed: three camera windows
//     cut through the page (cameras go underneath in OBS), names left to right
//
// Every source renders at 2560×1440 natively — set that as the browser
// source width/height in OBS. A 1080p stream is OBS downscaling that render;
// pointing a 1920×1080 source at these URLs gives up resolution for nothing.
//
// Global query params: ?championship=<slug> (default: the running ACC
// division series), ?round=N (default: the division's current round),
// ?refresh=<seconds> (default 900: how often the source re-fetches itself;
// every source also refreshes an hour before its division's green flag).

type OverlayProps = {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

// A browser source shows whatever is true at the moment OBS refreshes it.
export const dynamic = 'force-dynamic';

export default async function StreamOverlayPage({ params, searchParams }: OverlayProps) {
  const { path } = await params;
  const query = await searchParams;
  const [scene, value, subtype] = path;

  const championship = await getStreamChampionship(query.championship);
  if (!championship) notFound();

  const divisionIds = streamDivisionIds(championship);
  const requested = Number.parseInt(value?.replace(/^division_/, '') ?? '', 10);
  // A division segment that isn't one this series runs falls back to the
  // first, never 404s — a scene collection outlives a season's grid.
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
    return (
      <OverlayCanvas refresh={refresh}>
        <TrackOverlay championship={championship} division={division} track={track} round={round} />
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
        <CommentatorsOverlay commentators={booth} />
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
    return (
      <OverlayCanvas refresh={refresh} transparent className="ov-ticker-only">
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
        <SponsorsOverlay championship={championship} message={query.footer_message} />
      </OverlayCanvas>
    );
  }

  if (scene === 'show') {
    return (
      <OverlayCanvas refresh={refresh} cutouts={CAM_WINDOWS}>
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
