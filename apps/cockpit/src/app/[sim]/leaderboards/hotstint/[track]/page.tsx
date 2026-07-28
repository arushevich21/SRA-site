import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { getCurrentDriverContext } from '@/lib/current-driver';
import { TrackHeader } from '@/components/TrackHeader';
import {
  getAccTrack,
  toTrackSummary as toAccTrackSummary,
  toTrackTopEntry as toAccTrackTopEntry,
} from '@/lib/acc/tracks';
import { getAccTrackHotStint, getAccTrackTopStints } from '@/lib/acc/hotstint';
import { AccTrackLeaderboard } from '@/components/AccTrackLeaderboard';

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

  const [leaderboardByCarGroup, topEntries, currentDriver] = await Promise.all([
    getAccTrackHotStint(trackSlugParam),
    getAccTrackTopStints(trackSlugParam, 1),
    getCurrentDriverContext(),
  ]);

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
