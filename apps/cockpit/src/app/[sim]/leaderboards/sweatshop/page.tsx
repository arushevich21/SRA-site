import { notFound, redirect } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { getAccLeaderboardShell } from '@/lib/acc/leaderboard-shell';
import { sweatshopBasePath } from '@/components/sweatshop/SweatshopChrome';

// The Sweatshop tab links here; season lives in the path (see
// sweatshop/[season]/page.tsx), so this only forwards to the newest season.
export const revalidate = 300;

export default async function SweatshopIndexPage({ params }: { params: Promise<{ sim: string }> }) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim || sim.game !== 'ACC') notFound();

  const { seasons } = await getAccLeaderboardShell();
  if (seasons.length === 0) notFound();
  redirect(`${sweatshopBasePath(sim.slug)}/${seasons[0]}`);
}
