import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { TrackHeader } from '@/components/TrackHeader';
import { AccTrackLeaderboard } from '@/components/AccTrackLeaderboard';
import {
  getAccTrack,
  toTrackSummary as toAccTrackSummary,
  toTrackTopEntry as toAccTrackTopEntry,
} from '@/lib/acc/tracks';
import {
  getAccTrackHotStint,
  getHotStintSeasons,
  type AccStintBoard,
} from '@/lib/acc/hotstint';
import { hasWetSessionRows } from '@/lib/seasonal-leaderboard';

// See ../page.tsx — season moved from ?season= to the path so this page can
// be ISR'd. No generateStaticParams (same as the persistent [track]/page.tsx)
// — rendered on demand, then cached for 300s.
export const revalidate = 300;

// Per-track Hot Stint (Seasonal) board — one season's 5-lap-average board for a
// track, class-grouped. Season comes from the URL path.
export default async function SeasonalHotStintTrackPage({
  params,
}: {
  params: Promise<{ sim: string; season: string; track: string }>;
}) {
  const { sim: simSlug, season: seasonParam, track: trackSlugParam } = await params;
  const sim = getSimBySlug(simSlug);
  if (!sim) notFound();
  if (sim.game !== 'ACC') notFound();

  // Same batching as the hot-lap seasonal track page: the leaderboard/wet-
  // session queries only need trackSlugParam/seasonParam, not validated
  // track/seasons results, so all four fire in one round trip.
  const board: AccStintBoard = { scope: 'seasonal', season: seasonParam, qualifying: false };
  const [track, seasons, leaderboardByCarGroup, isWet] = await Promise.all([
    getAccTrack(trackSlugParam),
    getHotStintSeasons(),
    // entries[0] is already the outright fastest stint across every class
    // (page 1, no class filter, sorted ascending) — no separate
    // getAccTrackTopStints call needed, mirroring the hot-lap seasonal fix.
    getAccTrackHotStint(trackSlugParam, board),
    hasWetSessionRows('acc_hotstint_leaderboard', trackSlugParam, seasonParam, { qualifying: false }),
  ]);
  if (!track) notFound();
  if (!seasons.includes(seasonParam)) notFound();
  const season = seasonParam;
  const fastest = leaderboardByCarGroup.entries[0];
  const trackSummary = toAccTrackSummary(track);

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <Link
        href={`/${sim.slug}/leaderboards/hotstint/seasonal/${season}`}
        className="inline-block font-mono text-[13px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-8"
      >
        ← {season} Tracks
      </Link>

      <TrackHeader
        track={isWet ? { ...trackSummary, displayName: `${trackSummary.displayName} (Wet)` } : trackSummary}
        fastestLap={fastest ? toAccTrackTopEntry(fastest) : null}
        label="Fastest stint"
      />

      <AccTrackLeaderboard
        initialEntries={leaderboardByCarGroup.entries}
        initialTotalCount={leaderboardByCarGroup.totalCount}
        timeLabel="Stint Avg"
        trackKey={trackSlugParam}
        variant="stint"
        scope="seasonal"
        season={season}
        qualifying={false}
      />
    </section>
  );
}
