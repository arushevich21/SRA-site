import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { CHAMPIONSHIPS } from '@/content/championships';
import { ChampionshipStandingsBody } from '@/components/ChampionshipStandingsBody';

export const dynamic = 'force-dynamic';

export default async function ChampionshipStandingsPage({
  params,
}: {
  params: Promise<{ sim: string; slug: string }>;
}) {
  const { sim: simSlug, slug } = await params;
  const sim = getSimBySlug(simSlug);
  if (!sim) notFound();

  const content = CHAMPIONSHIPS.find((c) => c.game === sim.game && c.slug === slug);
  if (!content) notFound();

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — Standings
      </span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,64px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-12">
        {content.title}
      </h1>

      <ChampionshipStandingsBody champ={content} />
    </section>
  );
}
