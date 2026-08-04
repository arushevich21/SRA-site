import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { TrackHeader } from '@/components/TrackHeader';
import { AccTrackLeaderboard } from '@/components/AccTrackLeaderboard';
import {
  getAccTrack,
  getAccTrackLeaderboard,
  getAccTrackTopTimes,
  toTrackSummary as toAccTrackSummary,
  toTrackTopEntry as toAccTrackTopEntry,
  type AccBoard,
} from '@/lib/acc/tracks';
import { getHotlapSeasons, hasWetSessionRows } from '@/lib/seasonal-leaderboard';

export const dynamic = 'force-dynamic';

// Per-track Hot Lap (Seasonal) board — one season's single-lap board for a
// track, class-grouped. Season comes from ?season=; defaults to the newest.
export default async function SeasonalTrackPage({
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

  const [track, seasons] = await Promise.all([getAccTrack(trackSlugParam), getHotlapSeasons()]);
  if (!track) notFound();

  const season =
    seasonParam && seasons.includes(seasonParam) ? seasonParam : (seasons[0] ?? null);
  if (!season) notFound();

  const board: AccBoard = { scope: 'seasonal', season };

  const [leaderboardByCarGroup, topEntries, isWet] = await Promise.all([
    getAccTrackLeaderboard(trackSlugParam, board),
    getAccTrackTopTimes(trackSlugParam, 1, board),
    hasWetSessionRows('acc_hotlap_leaderboard', trackSlugParam, season),
  ]);
  const trackSummary = toAccTrackSummary(track);

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <Link
        href={`/${sim.slug}/leaderboards/seasonal?season=${season}`}
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
        trackKey={trackSlugParam}
        variant="lap"
      />
    </section>
  );
}
