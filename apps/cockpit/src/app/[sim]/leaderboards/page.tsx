import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { TrackList, type TrackWithTopTimes } from '@/components/TrackList';
import { LeaderboardTabs } from '@/components/LeaderboardTabs';
import { GameLabel } from '@/components/GameLabel';
import { hasSeasonalContent, hasEnduranceReleased } from '@/lib/seasonal-leaderboard';
import { hasHotStintQualifyingContent } from '@/lib/acc/hot-stint-store';
import { getAccTracks, getAccTrackTopTimes, getAccTrackStats, toTrackSummary, toTrackTopEntry } from '@/lib/acc/tracks';
import { getLeaderboardTracksWithTopTimes } from '@/lib/leaderboard-tracks';

// Hotlaps refresh via a cron job every ~10 min (see api/cron/refresh-*-leaderboard) —
// ISR ceiling here as a safety net; the cron busts this on-demand via revalidatePath.
// Must be a literal — see [sim]/standings/page.tsx for why this can't read
// CACHE_REVALIDATE from the environment.
export const revalidate = 300;

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
          showSeasonal={await hasSeasonalContent()}
          showEndurance={await hasEnduranceReleased()}
          showHotStintQualifying={await hasHotStintQualifyingContent()}
        />
      )}

      <TrackList tracks={tracks} simSlug={sim.slug} />
    </section>
  );
}
