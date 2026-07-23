import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { AllTracksLeaderboards } from '@/components/AllTracksLeaderboards';
import { GameLabel } from '@/components/GameLabel';
import { getAccTracks, getAccTrackTopTimes, getAccTrackStats, toTrackSummary, toTrackTopEntry } from '@/lib/acc/tracks';
import { getLeaderboardTracksWithTopTimes } from '@/lib/leaderboard-tracks';

export const dynamic = 'force-dynamic';

export default async function SimLeaderboardsPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();

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

      <AllTracksLeaderboards sim={sim} />
    </section>
  );
}
