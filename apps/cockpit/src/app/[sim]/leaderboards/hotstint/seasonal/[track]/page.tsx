import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { getCurrentDriverContext } from '@/lib/current-driver';
import { TrackHeader } from '@/components/TrackHeader';
import { AccTrackLeaderboard } from '@/components/AccTrackLeaderboard';
import {
  getAccTrack,
  toTrackSummary as toAccTrackSummary,
  toTrackTopEntry as toAccTrackTopEntry,
} from '@/lib/acc/tracks';
import {
  getAccTrackHotStint,
  getAccTrackTopStints,
  getHotStintSeasons,
  type AccStintBoard,
} from '@/lib/acc/hotstint';
import { hasWetSessionRows } from '@/lib/seasonal-leaderboard';

export const dynamic = 'force-dynamic';

// Per-track Hot Stint (Seasonal) board — one season's 5-lap-average board for a
// track, class-grouped. Season comes from ?season=; defaults to the newest.
export default async function SeasonalHotStintTrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ sim: string; track: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { sim: simSlug, track: trackSlugParam } = await params;
  const { season: seasonParam } = await searchParams;
  const sim = getSimBySlug(simSlug);
  if (!sim) notFound();
  if (sim.game !== 'ACC') notFound();

  const [track, seasons] = await Promise.all([getAccTrack(trackSlugParam), getHotStintSeasons()]);
  if (!track) notFound();

  const season =
    seasonParam && seasons.includes(seasonParam) ? seasonParam : (seasons[0] ?? null);
  if (!season) notFound();

  const board: AccStintBoard = { scope: 'seasonal', season, qualifying: false };

  const [leaderboardByCarGroup, topEntries, currentDriver, isWet] = await Promise.all([
    getAccTrackHotStint(trackSlugParam, board),
    getAccTrackTopStints(trackSlugParam, 1, board),
    getCurrentDriverContext(),
    hasWetSessionRows('acc_hotstint_leaderboard', trackSlugParam, season, { qualifying: false }),
  ]);
  const trackSummary = toAccTrackSummary(track);

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <Link
        href={`/${sim.slug}/leaderboards/hotstint/seasonal?season=${season}`}
        className="inline-block font-mono text-[13px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-8"
      >
        ← {season} Tracks
      </Link>

      <TrackHeader
        track={isWet ? { ...trackSummary, displayName: `${trackSummary.displayName} (Wet)` } : trackSummary}
        fastestLap={topEntries[0] ? toAccTrackTopEntry(topEntries[0]) : null}
      />

      <AccTrackLeaderboard
        leaderboardByCarGroup={leaderboardByCarGroup}
        currentSteamId={currentDriver.steamId}
        currentDivision={currentDriver.division}
        timeLabel="Stint Avg"
        trackKey={trackSlugParam}
        variant="stint"
      />
    </section>
  );
}
