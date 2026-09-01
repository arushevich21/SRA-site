import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { getChampionships } from '@/lib/championships-store';
import { ChampionshipCalendarBody } from '@/components/ChampionshipCalendarBody';
import { matchAccRoundsToResultEvents } from '@/lib/acc/race-results-store';

export default async function ChampionshipCalendarPage({
  params,
}: {
  params: Promise<{ sim: string; slug: string }>;
}) {
  const { sim: simSlug, slug } = await params;
  const sim = getSimBySlug(simSlug);
  if (!sim) notFound();

  const content = (await getChampionships()).find((c) => c.game === sim.game && c.slug === slug);
  if (!content) notFound();

  // See [slug]/page.tsx's own roundsWithResults comment — same ACC-only
  // matching, needed here too so calendar event cards can link straight to
  // a round's results.
  const roundsWithResults =
    content.game !== 'AC Evo'
      ? new Set(
          (await matchAccRoundsToResultEvents(content.schedule, content.emperorChampionshipId ?? null)).keys(),
        )
      : undefined;

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — Calendar
      </span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,64px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-12">
        {content.title}
      </h1>

      <ChampionshipCalendarBody
        champ={content}
        simSlug={simSlug}
        accentColor={sim.accentColor}
        roundsWithResults={roundsWithResults}
      />
    </section>
  );
}
