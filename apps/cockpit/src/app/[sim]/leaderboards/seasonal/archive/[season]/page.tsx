import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { isFrozenSeason } from '@/lib/acc/seasons';
import { HotlapSeasonBody } from '@/app/[sim]/leaderboards/_seasonal/hotlap';

// ARCHIVE route for Hot Lap (Seasonal): finished seasons only (isFrozenSeason).
// Public URLs stay /…/seasonal/S16/… — a next.config rewrite lands them here.
// SSG-eligible via generateStaticParams, which returns [] on purpose: nothing
// is prebuilt, each path renders on its first request and is then served from
// the route cache indefinitely (s-maxage=1y). The body touches only infinite
// or plain caches so nothing caps that. See _seasonal/hotlap.tsx.
export function generateStaticParams() {
  return [];
}

export default async function HotlapSeasonBodyArchive({ params }: { params: Promise<{ sim: string; season: string }> }) {
  const { sim: slug, season } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();
  if (sim.game !== 'ACC') notFound();
  // Guard against a direct hit on the archive URL for a live season — that
  // would freeze it. Belt and braces: the rewrite only sends frozen seasons.
  if (!isFrozenSeason(season)) notFound();

  return <HotlapSeasonBody sim={sim} season={season} frozen />;
}
