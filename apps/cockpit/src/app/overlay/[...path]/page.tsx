import { notFound } from 'next/navigation';
import { getChampionships } from '@/lib/championships-store';
import { readStandings } from '@/lib/standings-store';
import type { ChampionshipContent, ScheduleRound } from '@/content/championships';
import type { StandingsExport } from '@/lib/standings-types';
import { OverlayCanvas, OverlayHeader, OverlayPanel, SponsorTicker } from '@/components/stream/OverlayPrimitives';
import { CalendarOverlay } from '@/components/stream/CalendarOverlay';
import { StandingsOverlay } from '@/components/stream/StandingsOverlay';
import { TrackOverlay } from '@/components/stream/TrackOverlay';
import { RaceInformationOverlay } from '@/components/stream/RaceInformationOverlay';
import { IntermissionOverlay } from '@/components/stream/IntermissionOverlay';
import { SponsorsOverlay } from '@/components/stream/SponsorsOverlay';
import { PartnersOverlay } from '@/components/stream/PartnersOverlay';
import { CommentatorsOverlay } from '@/components/stream/CommentatorsOverlay';

type OverlayProps = {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ page?: string; mode?: string; opacity?: string; footer_message?: string }>;
};

// OBS browser sources should see the current stream state on every refresh.
export const dynamic = 'force-dynamic';

const DEMO_ROUNDS: ScheduleRound[] = [
  { round: 1, track: 'Silverstone', date: '2026-08-18T21:00:00', raceLength: '60 min' },
  { round: 2, track: 'COTA', date: '2026-08-25T21:00:00', raceLength: '60 min' },
  { round: 3, track: 'Valencia', date: '2026-09-01T21:00:00', raceLength: '60 min' },
  { round: 4, track: 'Zandvoort', date: '2026-09-08T21:00:00', raceLength: '60 min' },
  { round: 5, track: 'Mount Panorama', date: '2026-09-15T21:00:00', raceLength: '60 min' },
  { round: 6, track: 'Suzuka', date: '2026-09-22T21:00:00', raceLength: '60 min' },
  { round: 7, track: 'Brands Hatch', date: '2026-09-29T21:00:00', raceLength: '60 min' },
  { round: 8, track: 'Misano', date: '2026-10-06T21:00:00', raceLength: '60 min' },
];

const DEMO_STANDINGS: StandingsExport = [
  {
    carClass: 'GT3',
    standings: Array.from({ length: 26 }, (_, index) => ({
      position: index + 1,
      id: ['Bryan Anderson', 'Pauleh Hartman', 'Amos Movo', 'Thomas Olhausen'][index % 4],
      carNum: index + 1,
      car: ['Lamborghini Huracán GT3 EVO2', 'Ferrari 296 GT3', 'Nissan GT-R Nismo GT3', 'Porsche 992 GT3 R'][index % 4],
      championshipPoints: 410 - index * 9,
      championshipPenalties: 0,
      championshipScore: 410 - index * 9,
      pointsAdjustment: 0,
      actualPoints: 410 - index * 9,
      races: [],
    })),
  },
];

async function getOverlayContext(): Promise<{ championship: ChampionshipContent; rounds: ScheduleRound[] }> {
  const championships = await getChampionships();
  const championship = championships.find((entry) => entry.game === 'ACC' && entry.classTag === 'GT3') ?? championships[0];
  if (championship) return { championship, rounds: championship.schedule.length ? championship.schedule : DEMO_ROUNDS };

  return {
    championship: {
      simgridId: null,
      slug: 'stream-draft',
      game: 'ACC',
      classTag: 'GT3',
      classes: ['GT3'],
      title: 'GT3 Team Series — Season 19',
      raceFormat: '60 min race',
      rulesBullets: [],
      discordLinks: [],
      resultsUrl: null,
      schedule: DEMO_ROUNDS,
    },
    rounds: DEMO_ROUNDS,
  };
}

async function getStandings(key: string | undefined): Promise<StandingsExport> {
  if (key) {
    try {
      const stored = await readStandings(key);
      if (stored?.length) return stored;
    } catch (error) {
      console.error('stream overlay standings read failed; using draft data:', error);
    }
  }
  return DEMO_STANDINGS;
}

export default async function StreamOverlayPage({ params, searchParams }: OverlayProps) {
  const { path } = await params;
  const query = await searchParams;
  const [scene, value, subtype] = path;
  const context = await getOverlayContext();
  const division = value?.match(/^division_(\d+)$/)?.[1] ?? value ?? '1';

  if (scene === 'standings' && (subtype === 'driver' || subtype === 'team')) {
    const searchPage = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
    const standings = await getStandings(context.championship.standingsKey);
    return (
      <OverlayCanvas>
        <SponsorTicker />
        <StandingsOverlay
          championship={context.championship}
          division={division}
          type={subtype}
          page={searchPage}
          standings={standings}
        />
      </OverlayCanvas>
    );
  }

  if (scene === 'season_calendar') {
    return <OverlayCanvas className="stream-marquee-content-canvas"><CalendarOverlay championship={context.championship} division={division} rounds={context.rounds} /></OverlayCanvas>;
  }

  if (scene === 'track_maps') {
    const track = value === 'current' ? context.rounds[0]?.track ?? 'Track TBA' : value?.replaceAll('-', ' ') ?? 'Track TBA';
    return <OverlayCanvas><TrackOverlay track={track} round={context.rounds[0]} /></OverlayCanvas>;
  }

  if (scene === 'race_information') {
    return <OverlayCanvas className="stream-transparent-content-canvas stream-marquee-content-canvas"><RaceInformationOverlay championship={context.championship} division={division} round={context.rounds[0]} /></OverlayCanvas>;
  }

  if (scene === 'partners') return <OverlayCanvas><PartnersOverlay /></OverlayCanvas>;

  if (scene === 'intermission') {
    return <OverlayCanvas className="stream-marquee-content-canvas"><IntermissionOverlay championship={context.championship} division={division} round={context.rounds[0]} /></OverlayCanvas>;
  }

  if (scene === 'sponsors' && query.mode === 'horizontal_marquee') {
    return <OverlayCanvas className="stream-ticker-canvas"><SponsorTicker /></OverlayCanvas>;
  }

  if (scene === 'sponsors') {
    const parsedOpacity = query.opacity === undefined ? undefined : Number(query.opacity);
    const opacity = parsedOpacity !== undefined && Number.isFinite(parsedOpacity)
      ? Math.min(1, Math.max(0, parsedOpacity))
      : undefined;
    return <OverlayCanvas opacity={opacity}><SponsorsOverlay footerMessage={query.footer_message} /></OverlayCanvas>;
  }

  if (scene === 'commentators') {
    return <OverlayCanvas className="stream-transparent-content-canvas"><CommentatorsOverlay /></OverlayCanvas>;
  }

  if (scene === 'commentators' && query.mode === '__legacy_placeholder__') {
    return <OverlayCanvas><OverlayHeader title={`Commentators · Division ${division}`} /><OverlayPanel className="stream-commentator-placeholder"><p>Commentator browser source placeholder</p></OverlayPanel></OverlayCanvas>;
  }

  notFound();
}
