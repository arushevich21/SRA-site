import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { LeaderboardTabs } from '@/components/LeaderboardTabs';
import { TrackList } from '@/components/TrackList';
import { SeasonSelect } from '@/components/SeasonSelect';
import { GameLabel } from '@/components/GameLabel';
import {
  getHotlapSeasons,
  getSeasonHotlapTrackList,
  hasEnduranceReleased,
} from '@/lib/seasonal-leaderboard';
import { hasHotStintQualifyingContent, hasJagoffContent } from '@/lib/acc/hot-stint-store';

// See seasonal/page.tsx for why season moved from ?season= into the path —
// this is the actual content page, ISR'd since it no longer reads
// searchParams. No generateStaticParams (same as [track]/page.tsx elsewhere
// in this tree) — rendered on demand, then cached for 300s.
export const revalidate = 300;

// Hot Lap (Seasonal) — a season dropdown over a Hot-Lap-style track list. Each
// card opens that season's per-track board. Seasonal is ACC-only.
export default async function SeasonalLeaderboardsPage({
  params,
}: {
  params: Promise<{ sim: string; season: string }>;
}) {
  const { sim: slug, season: seasonParam } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();
  if (sim.game !== 'ACC') notFound();

  const seasons = await getHotlapSeasons();
  if (!seasons.includes(seasonParam)) notFound();
  const selectedSeason = seasonParam;
  const tracks = await getSeasonHotlapTrackList(selectedSeason);

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
        showSeasonal={seasons.length > 0}
        showEndurance={await hasEnduranceReleased()}
        showHotStintQualifying={await hasHotStintQualifyingContent()}
        showJagoff={await hasJagoffContent()}
      />

      <div className="mb-8">
        <SeasonSelect
          seasons={seasons}
          selected={selectedSeason}
          basePath={`/${sim.slug}/leaderboards/seasonal`}
        />
      </div>

      {tracks.length === 0 ? (
        <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
          <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
            No rounds released for {selectedSeason} yet
          </p>
        </div>
      ) : (
        <TrackList
          tracks={tracks}
          simSlug={sim.slug}
          basePath={`/${sim.slug}/leaderboards/seasonal/${selectedSeason}`}
        />
      )}
    </section>
  );
}
