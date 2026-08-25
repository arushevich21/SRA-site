import { notFound, redirect } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { LeaderboardTabs } from '@/components/LeaderboardTabs';
import { GameLabel } from '@/components/GameLabel';
import { getHotlapSeasons, hasEnduranceReleased } from '@/lib/seasonal-leaderboard';
import { hasHotStintQualifyingContent, hasJagoffContent } from '@/lib/acc/hot-stint-store';

// Season now lives in the URL path (see seasonal/[season]/page.tsx) so that
// page can be ISR'd — searchParams forces dynamic rendering regardless of any
// revalidate directive, so the season can't be read here on a cached route.
// This page stays dynamic, but only to do one cheap thing: pick a season (the
// old ?season= query param, if present and valid, else the newest) and
// redirect to its path. Keeps old bookmarked/shared `?season=` links working.
export const dynamic = 'force-dynamic';

export default async function SeasonalLeaderboardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sim: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { sim: slug } = await params;
  const { season: seasonParam } = await searchParams;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();
  if (sim.game !== 'ACC') notFound();

  const seasons = await getHotlapSeasons();
  const selectedSeason =
    seasonParam && seasons.includes(seasonParam) ? seasonParam : (seasons[0] ?? null);

  if (selectedSeason) {
    redirect(`/${sim.slug}/leaderboards/seasonal/${selectedSeason}`);
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

      <LeaderboardTabs
        simSlug={sim.slug}
        showSeasonal={false}
        showEndurance={await hasEnduranceReleased()}
        showHotStintQualifying={await hasHotStintQualifyingContent()}
        showJagoff={await hasJagoffContent()}
      />

      <div className="border border-line/50 bg-carbon-2 px-8 py-16 text-center">
        <p className="font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-4">
          Nothing Released Yet
        </p>
        <p className="font-sans text-[15px] text-txt-2 leading-relaxed max-w-[560px] mx-auto">
          Seasonal hot-lap boards are published per race by the admins. Check
          back on race week.
        </p>
      </div>
    </section>
  );
}
