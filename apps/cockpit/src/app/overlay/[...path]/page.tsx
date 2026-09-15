import { notFound } from 'next/navigation';
import {
  getDivisionStandings,
  getStreamChampionship,
  resolveStreamRound,
  streamDivisionIds,
  streamRounds,
} from '@/lib/stream/overlay-data';
import { OverlayCanvas, SponsorTicker } from '@/components/stream/OverlayPrimitives';
import { CalendarOverlay } from '@/components/stream/CalendarOverlay';
import { StandingsOverlay } from '@/components/stream/StandingsOverlay';
import { TrackOverlay } from '@/components/stream/TrackOverlay';
import { RaceInformationOverlay } from '@/components/stream/RaceInformationOverlay';
import { IntermissionOverlay } from '@/components/stream/IntermissionOverlay';
import { SponsorsOverlay } from '@/components/stream/SponsorsOverlay';
import { PartnersOverlay } from '@/components/stream/PartnersOverlay';
import { CommentatorsOverlay } from '@/components/stream/CommentatorsOverlay';
import { parseCommentators } from '@/components/stream/commentators';

// OBS browser sources for the race broadcast. URL shapes match the scene
// collection the crew already runs (scripts/stream-e2e), so swapping the host
// is the only OBS change:
//
//   /overlay/standings/division_1/driver?page=2
//   /overlay/standings/division_1/team
//   /overlay/season_calendar/1
//   /overlay/track_maps/current            (or /track_maps/silverstone)
//   /overlay/race_information/1            transparent — label only
//   /overlay/intermission/1?names=A|Lead,B|Analyst
//   /overlay/commentators/1?names=...      transparent lower-third
//   /overlay/sponsors?footer_message=STREAM%20STARTING%20SOON|...&opacity=.5
//   /overlay/sponsors?mode=horizontal_marquee   transparent ticker strip
//   /overlay/partners                      transparent logo slideshow
//
// Global query params: ?championship=<slug> (default: the running ACC
// division series), ?round=N (default: the division's current round).

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
  const commentators = parseCommentators(query.names);

  if (scene === 'standings' && (subtype === 'driver' || subtype === 'team')) {
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
    const standings = await getDivisionStandings(championship, division);
    if (!standings) notFound();
    return (
      <OverlayCanvas>
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
      <OverlayCanvas>
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
      <OverlayCanvas>
        <TrackOverlay championship={championship} division={division} track={track} round={round} />
      </OverlayCanvas>
    );
  }

  if (scene === 'race_information') {
    return (
      <OverlayCanvas transparent>
        <RaceInformationOverlay championship={championship} division={division} round={round} />
      </OverlayCanvas>
    );
  }

  if (scene === 'intermission') {
    const standings = await getDivisionStandings(championship, division);
    return (
      <OverlayCanvas>
        <IntermissionOverlay
          championship={championship}
          division={division}
          round={round}
          commentators={commentators}
          standings={standings}
        />
      </OverlayCanvas>
    );
  }

  if (scene === 'commentators') {
    return (
      <OverlayCanvas transparent>
        <CommentatorsOverlay commentators={commentators} />
      </OverlayCanvas>
    );
  }

  if (scene === 'partners') {
    return (
      <OverlayCanvas transparent>
        <PartnersOverlay />
      </OverlayCanvas>
    );
  }

  if (scene === 'sponsors' && query.mode === 'horizontal_marquee') {
    return (
      <OverlayCanvas transparent className="ov-ticker-only">
        <SponsorTicker />
      </OverlayCanvas>
    );
  }

  if (scene === 'sponsors') {
    const parsed = query.opacity === undefined ? NaN : Number(query.opacity);
    const opacity = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : undefined;
    return (
      <OverlayCanvas opacity={opacity}>
        <SponsorsOverlay championship={championship} message={query.footer_message} />
      </OverlayCanvas>
    );
  }

  notFound();
}
