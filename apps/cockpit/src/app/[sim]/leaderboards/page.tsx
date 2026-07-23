import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { TrackList, type TrackWithTopTimes } from '@/components/TrackList';
import { LeaderboardTabs } from '@/components/LeaderboardTabs';
import { GameLabel } from '@/components/GameLabel';
import { hasSeasonalReleased, hasEnduranceReleased } from '@/lib/seasonal-leaderboard';
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

  // ACC's leaderboards are its own Supabase-backed track list
  // (acc_tracks/acc_hotlap_leaderboard, per-class breakdown, manufacturer
  // logos) — a genuinely different data model from the schedule-driven
  // AC Evo path below, but both render through the same TrackList component
  // once adapted into the shared TrackSummary/TrackTopEntry shapes.
  let tracks: TrackWithTopTimes[];
  if (sim.game === 'ACC') {
    const baseTracks = await getAccTracks();
    tracks = await Promise.all(
      baseTracks.map(async (track) => {
        const [topTimes, stats] = await Promise.all([
          getAccTrackTopTimes(track.trackKey),
          getAccTrackStats(track.trackKey),
        ]);
        return {
          ...toTrackSummary(track),
          topTimes: topTimes.map(toTrackTopEntry),
          ...stats,
        };
      }),
    );
  } else {
    tracks = await getLeaderboardTracksWithTopTimes(sim.game);
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

      {sim.game === 'ACC' && (
        <LeaderboardTabs
          simSlug={sim.slug}
          showSeasonal={await hasSeasonalReleased()}
          showEndurance={await hasEnduranceReleased()}
        />
      )}

      <TrackList tracks={tracks} simSlug={sim.slug} />
    </section>
  );
}
