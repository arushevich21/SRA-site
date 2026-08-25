import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { TrackHeader } from '@/components/TrackHeader';
import {
  getAccTrack,
  toTrackSummary as toAccTrackSummary,
  toTrackTopEntry as toAccTrackTopEntry,
} from '@/lib/acc/tracks';
import { getAccTrackHotStint } from '@/lib/acc/hotstint';
import { AccTrackLeaderboard } from '@/components/AccTrackLeaderboard';

// See [sim]/leaderboards/[track]/page.tsx — same history (was force-dynamic
// for the ISR page-size limit, board is query-level paginated now). Restored
// to ISR (2026-08-25) to cut Vercel usage.
export const revalidate = 300;

// Per-track Hot Stint board (best 5-lap average, class-grouped). Mirrors the
// Hot Lap track detail page but sources acc_hotstint_leaderboard and labels the
// time column "Stint Avg". ACC-only.
export default async function TrackHotStintPage({
  params,
}: {
  params: Promise<{ sim: string; track: string }>;
}) {
  const { sim: simSlug, track: trackSlugParam } = await params;
  const sim = getSimBySlug(simSlug);
  if (!sim) notFound();
  if (sim.game !== 'ACC') notFound();

  // Independent queries (both keyed only on trackSlugParam) — parallelized
  // rather than run one after the other.
  const [track, board] = await Promise.all([
    getAccTrack(trackSlugParam),
    // Page 1, all classes — already sorted best_stint_ms ascending, so
    // entries[0] is the outright fastest across every class.
    getAccTrackHotStint(trackSlugParam),
  ]);
  if (!track) notFound();
  const fastest = board.entries[0];

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <Link
        href={`/${sim.slug}/leaderboards/hotstint`}
        className="inline-block font-mono text-[13px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-8"
      >
        ← All Tracks
      </Link>

      <TrackHeader
        track={toAccTrackSummary(track)}
        fastestLap={fastest ? toAccTrackTopEntry(fastest) : null}
        label="Fastest stint"
      />

      <AccTrackLeaderboard
        initialEntries={board.entries}
        initialTotalCount={board.totalCount}
        timeLabel="Stint Avg"
        trackKey={trackSlugParam}
        variant="stint"
        scope="persistent"
        season=""
        qualifying={false}
      />
    </section>
  );
}
