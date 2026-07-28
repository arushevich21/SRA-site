import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { TrackList, type TrackWithTopTimes } from '@/components/TrackList';
import { LeaderboardTabs } from '@/components/LeaderboardTabs';
import { GameLabel } from '@/components/GameLabel';
import { hasSeasonalContent, hasEnduranceReleased } from '@/lib/seasonal-leaderboard';
import { getAccTracks, toTrackSummary, toTrackTopEntry } from '@/lib/acc/tracks';
import { getAccTrackTopStints, getAccStintTrackStats } from '@/lib/acc/hotstint';

export const dynamic = 'force-dynamic';

// Hot Stint track list — same track metadata and card layout as the Hot Lap
// list, but the top-3 and entry counts come from acc_hotstint_leaderboard
// (best 5-lap average) instead of the single-lap board. Stint is ACC-only.
// Seasonal stint boards live on their own tab (/leaderboards/hotstint/seasonal).
export default async function SimHotStintPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();
  if (sim.game !== 'ACC') notFound();

  const baseTracks = await getAccTracks();
  const tracks: TrackWithTopTimes[] = await Promise.all(
    baseTracks.map(async (track) => {
      const [topStints, stats] = await Promise.all([
        getAccTrackTopStints(track.trackKey),
        getAccStintTrackStats(track.trackKey),
      ]);
      return {
        ...toTrackSummary(track),
        topTimes: topStints.map(toTrackTopEntry),
        ...stats,
      };
    }),
  );

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — <GameLabel game={sim.game} /> Leaderboards
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Leaderboards
      </h1>

      <LeaderboardTabs
        simSlug={sim.slug}
        showSeasonal={await hasSeasonalContent()}
        showEndurance={await hasEnduranceReleased()}
      />

      <p className="font-sans text-[15px] text-txt-2 leading-relaxed max-w-[640px] mb-8 -mt-4">
        Hot Stint ranks each driver by the{' '}
        <span className="text-txt">average of their best 5 consecutive valid laps</span> —
        a consistency measure, not a single flying lap.
      </p>

      <TrackList tracks={tracks} simSlug={sim.slug} basePath={`/${sim.slug}/leaderboards/hotstint`} />
    </section>
  );
}
