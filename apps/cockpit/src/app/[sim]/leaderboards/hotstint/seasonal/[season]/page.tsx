import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { LeaderboardTabs } from '@/components/LeaderboardTabs';
import { TrackList } from '@/components/TrackList';
import { SeasonSelect } from '@/components/SeasonSelect';
import { GameLabel } from '@/components/GameLabel';
import { hasEnduranceReleased } from '@/lib/seasonal-leaderboard';
import { getHotStintSeasons, getSeasonStintTrackList } from '@/lib/acc/hotstint';
import { hasHotStintQualifyingContent, hasJagoffContent } from '@/lib/acc/hot-stint-store';

// See ../page.tsx — season moved from ?season= to the path so this page can
// be ISR'd. No generateStaticParams (same as [track]/page.tsx elsewhere in
// this tree) — rendered on demand, then cached for 300s.
export const revalidate = 300;

// Hot Stint (Seasonal) — season dropdown over a Hot-Stint-style track list.
// Each card opens that season's per-track stint board. ACC-only.
export default async function SeasonalHotStintPage({
  params,
}: {
  params: Promise<{ sim: string; season: string }>;
}) {
  const { sim: slug, season: seasonParam } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();
  if (sim.game !== 'ACC') notFound();

  const seasons = await getHotStintSeasons();
  if (!seasons.includes(seasonParam)) notFound();
  const selectedSeason = seasonParam;
  const tracks = await getSeasonStintTrackList(selectedSeason);

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
          basePath={`/${sim.slug}/leaderboards/hotstint/seasonal`}
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
          basePath={`/${sim.slug}/leaderboards/hotstint/seasonal/${selectedSeason}`}
        />
      )}
    </section>
  );
}
