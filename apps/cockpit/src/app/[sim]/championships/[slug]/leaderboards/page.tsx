import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { getChampionships } from '@/lib/championships-store';
import { ChampionshipLeaderboardsBody } from '@/components/ChampionshipLeaderboardsBody';

// AC Evo hot laps refresh via cron (see api/cron/refresh-leaderboard), which
// revalidates the matching [sim]/leaderboards/[track] paths on-demand — this
// ceiling is a safety net, not the primary freshness mechanism.
export const revalidate = 3600;

export default async function ChampionshipLeaderboardsPage({
  params,
}: {
  params: Promise<{ sim: string; slug: string }>;
}) {
  const { sim: simSlug, slug } = await params;
  const sim = getSimBySlug(simSlug);
  if (!sim) notFound();

  const content = (await getChampionships()).find((c) => c.game === sim.game && c.slug === slug);
  if (!content) notFound();

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — Leaderboards
      </span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,64px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-12">
        {content.title}
      </h1>

      <ChampionshipLeaderboardsBody champ={content} accentColor={sim.accentColor} />
    </section>
  );
}
