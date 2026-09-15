import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { getChampionships } from '@/lib/championships-store';
import { ChampionshipStandingsBody } from '@/components/ChampionshipStandingsBody';

// See [sim]/standings/page.tsx — same mixed Emperor/admin-upload data source.
//
// A multi-division championship reads searchParams (division/view/tier), which
// opts this route into dynamic rendering regardless of the value below; the
// 300s ceiling still applies to every single-championship standings page.
export const revalidate = 300;

export default async function ChampionshipStandingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sim: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sim: simSlug, slug } = await params;
  const query = await searchParams;
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
        — Standings
      </span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,64px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-12">
        {content.title}
      </h1>

      <ChampionshipStandingsBody
        champ={content}
        basePath={`/${simSlug}/championships/${slug}/standings`}
        searchParams={query}
      />
    </section>
  );
}
