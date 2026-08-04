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
import { outrightFastest } from '@/lib/track-summary';

// See [sim]/leaderboards/[track]/page.tsx — reverted to force-dynamic for the
// same reason (ISR page-size limit forced capping entries, stopgap only).
export const dynamic = 'force-dynamic';

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

  const track = await getAccTrack(trackSlugParam);
  if (!track) notFound();

  const leaderboardByCarGroup = await getAccTrackHotStint(trackSlugParam);
  const fastest = outrightFastest(leaderboardByCarGroup);

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
      />

      <AccTrackLeaderboard
        leaderboardByCarGroup={leaderboardByCarGroup}
        timeLabel="Stint Avg"
        trackKey={trackSlugParam}
        variant="stint"
      />
    </section>
  );
}
