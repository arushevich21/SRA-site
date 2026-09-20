import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { isFrozenSeason } from '@/lib/acc/seasons';
import { StintTrackBody } from '@/app/[sim]/leaderboards/_seasonal/hotstint';

// LIVE route for a Hot Stint (Seasonal) track board (the current season). Rendered per request: the shell
// comes from the 1h shell cache and the board streams in behind <Suspense>
// from an uncached fetch. Finished seasons (isFrozenSeason) never reach this route —
// next.config rewrites their URLs to ../archive/…, which renders the same
// body once and caches it indefinitely. See _seasonal/hotlap.tsx for why the
// two can't share a route in Next 15.
export const dynamic = 'force-dynamic';

export default async function StintTrackBodyLive({ params }: { params: Promise<{ sim: string; season: string; track: string }> }) {
  const { sim: slug, season, track: trackKey } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();
  if (sim.game !== 'ACC') notFound();

  return <StintTrackBody sim={sim} season={season} trackKey={trackKey} frozen={isFrozenSeason(season)} />;
}
