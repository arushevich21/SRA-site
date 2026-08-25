import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { TrackHeader } from '@/components/TrackHeader';
import { AccTrackLeaderboard } from '@/components/AccTrackLeaderboard';
import {
  getAccTrack,
  getAccTrackLeaderboard,
  toTrackSummary as toAccTrackSummary,
  toTrackTopEntry as toAccTrackTopEntry,
  type AccBoard,
} from '@/lib/acc/tracks';
import { getHotlapSeasons, hasWetSessionRows } from '@/lib/seasonal-leaderboard';

// See ../page.tsx — season moved from ?season= to the path so this page can
// be ISR'd. No generateStaticParams (same as the persistent [track]/page.tsx)
// — rendered on demand, then cached for 300s.
export const revalidate = 300;

// Per-track Hot Lap (Seasonal) board — one season's single-lap board for a
// track, class-grouped. Season comes from the URL path.
export default async function SeasonalTrackPage({
  params,
}: {
  params: Promise<{ sim: string; season: string; track: string }>;
}) {
  const { sim: simSlug, season: seasonParam, track: trackSlugParam } = await params;
  const sim = getSimBySlug(simSlug);
  if (!sim) notFound();
  if (sim.game !== 'ACC') notFound();

  // The leaderboard/wet-session queries only need trackSlugParam/seasonParam
  // (already known from the URL, before track/seasons resolve) — not their
  // validated results — so all four fire in one round trip rather than
  // validating first and querying second. The rare invalid-season/track 404
  // path just discards an extra cached query; every valid request (the
  // overwhelming majority) saves a full round trip.
  const board: AccBoard = { scope: 'seasonal', season: seasonParam };
  const [track, seasons, leaderboardByCarGroup, isWet] = await Promise.all([
    getAccTrack(trackSlugParam),
    getHotlapSeasons(),
    // Page 1, all classes — sorted best_lap_ms ascending, so entries[0] is
    // already the outright fastest across every class combined. No separate
    // getAccTrackTopTimes call needed, same fix already applied to the regular
    // (persistent) track page — this page previously still ran that as a
    // redundant second query on every load.
    getAccTrackLeaderboard(trackSlugParam, board),
    hasWetSessionRows('acc_hotlap_leaderboard', trackSlugParam, seasonParam),
  ]);
  if (!track) notFound();
  if (!seasons.includes(seasonParam)) notFound();
  const season = seasonParam;
  const fastest = leaderboardByCarGroup.entries[0];
  const trackSummary = toAccTrackSummary(track);

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <Link
        href={`/${sim.slug}/leaderboards/seasonal/${season}`}
        className="inline-block font-mono text-[13px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-8"
      >
        ← {season} Tracks
      </Link>

      <TrackHeader
        track={isWet ? { ...trackSummary, displayName: `${trackSummary.displayName} (Wet)` } : trackSummary}
        fastestLap={fastest ? toAccTrackTopEntry(fastest) : null}
      />

      <AccTrackLeaderboard
        initialEntries={leaderboardByCarGroup.entries}
        initialTotalCount={leaderboardByCarGroup.totalCount}
        trackKey={trackSlugParam}
        variant="lap"
        scope="seasonal"
        season={season}
      />
    </section>
  );
}
