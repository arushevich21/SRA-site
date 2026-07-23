import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { getStandingsKey } from '@/content/championships';
import { getChampionships } from '@/lib/championships-store';
import { ChampionshipStandingsBody } from '@/components/ChampionshipStandingsBody';
import { GameLabel } from '@/components/GameLabel';

export const dynamic = 'force-dynamic';

export default async function SimStandingsPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();

  // Teased championships (e.g. Endurance) stay "coming soon" here even if a
  // standings key exists — only surface real data for non-teased series.
  const champ = (await getChampionships()).find(
    (c) =>
      c.game === sim.game &&
      (c.emperorChampionshipId || (!c.teaserOnly && getStandingsKey(c))),
  );

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — <GameLabel game={sim.game} /> Standings
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Standings
      </h1>

      {champ ? (
        <ChampionshipStandingsBody champ={champ} />
      ) : (
        <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
          <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
            Coming soon
          </p>
        </div>
      )}
    </section>
  );
}
