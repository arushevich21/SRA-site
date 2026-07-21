import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { AllTracksLeaderboards } from '@/components/AllTracksLeaderboards';
import { AccTrackList } from '@/components/AccTrackList';
import { GameLabel } from '@/components/GameLabel';
import { getAccTracks, getAccTrackTopTimes, getAccTrackStats } from '@/lib/acc/tracks';

export const dynamic = 'force-dynamic';

export default async function SimLeaderboardsPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();

  // ACC's leaderboards are its own Supabase-backed track list
  // (acc_tracks/acc_hotlap_leaderboard, per-class breakdown, manufacturer
  // logos) — a genuinely different data model from the schedule-driven
  // AllTracksLeaderboards used for every other sim below.
  if (sim.game === 'ACC') {
    const baseTracks = await getAccTracks();
    const tracks = await Promise.all(
      baseTracks.map(async (track) => {
        const [topTimes, stats] = await Promise.all([
          getAccTrackTopTimes(track.trackKey),
          getAccTrackStats(track.trackKey),
        ]);
        return { ...track, topTimes, ...stats };
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
        <AccTrackList tracks={tracks} simSlug={sim.slug} />
      </section>
    );
  }

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
