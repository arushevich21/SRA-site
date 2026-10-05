import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { getAccLeaderboardShell } from '@/lib/acc/leaderboard-shell';
import { getSweatshopSeason, getSweatshopTrackCards } from '@/lib/acc/sweatshop';
import { SweatshopBoard } from '@/components/sweatshop/SweatshopBoard';
import {
  SweatshopHero,
  SweatshopShell,
  sweatshopBasePath,
} from '@/components/sweatshop/SweatshopChrome';

// Sweatshop, season total: every lap each driver turned on the hot-lap
// servers this season, across every track and car. Rendered per request (a
// dynamic [season] segment with no generateStaticParams); the lap rows behind
// it are cached for 5 minutes in lib/acc/sweatshop.ts, so a render is cheap.
export const revalidate = 300;

export default async function SweatshopSeasonPage({
  params,
}: {
  params: Promise<{ sim: string; season: string }>;
}) {
  const { sim: slug, season } = await params;
  const sim = getSimBySlug(slug);
  if (!sim || sim.game !== 'ACC') notFound();

  const shell = await getAccLeaderboardShell();
  if (!shell.seasons.includes(season)) notFound();

  const [{ drivers, leader }, cards] = await Promise.all([getSweatshopSeason(season), getSweatshopTrackCards(season)]);
  const firstTrack = cards.find((c) => c.current && c.laps > 0) ?? cards.find((c) => c.released && c.laps > 0);
  const base = sweatshopBasePath(sim.slug);

  return (
    <SweatshopShell
      sim={sim}
      shell={shell}
      season={season}
      view="season"
      byTrackHref={firstTrack ? `${base}/${season}/${firstTrack.trackKey}` : null}
    >
      <p className="font-sans text-[15px] text-txt-2 leading-relaxed max-w-[640px] mb-6">
        <span className="text-txt">Who&apos;s putting in the hours.</span> Every lap on the hot-lap servers
        this season, valid or not, across all tracks and cars.
      </p>
      {leader && <SweatshopHero leader={leader} season={season} />}
      <SweatshopBoard rows={drivers} />
    </SweatshopShell>
  );
}
