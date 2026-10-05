import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { getAccLeaderboardShell } from '@/lib/acc/leaderboard-shell';
import { getSweatshopTrack } from '@/lib/acc/sweatshop';
import { SweatshopBoard } from '@/components/sweatshop/SweatshopBoard';
import {
  SweatshopShell,
  SweatshopTrackBanner,
  SweatshopTrackCards,
  sweatshopBasePath,
} from '@/components/sweatshop/SweatshopChrome';

// Sweatshop, by track: one week's (track's) lap counts, with the season's
// calendar as a picker across the top. Unreleased rounds of the live season
// 404 here, same as the seasonal hot-lap board.
export const revalidate = 300;

export default async function SweatshopTrackPage({
  params,
}: {
  params: Promise<{ sim: string; season: string; track: string }>;
}) {
  const { sim: slug, season, track } = await params;
  const sim = getSimBySlug(slug);
  if (!sim || sim.game !== 'ACC') notFound();

  const shell = await getAccLeaderboardShell();
  if (!shell.seasons.includes(season)) notFound();

  const data = await getSweatshopTrack(season, track);
  if (!data) notFound();
  const { card, cards, drivers, leader } = data;
  const base = `${sweatshopBasePath(sim.slug)}/${season}`;

  return (
    <SweatshopShell sim={sim} shell={shell} season={season} view="track" byTrackHref={`${base}/${track}`}>
      <SweatshopTrackCards cards={cards} activeKey={track} hrefFor={(k) => `${base}/${k}`} />
      {leader && <SweatshopTrackBanner leader={leader} trackName={card.displayName} season={season} />}
      <SweatshopBoard rows={drivers} />
    </SweatshopShell>
  );
}
