import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { getChampionships } from '@/lib/championships-store';
import { RealChampionshipBlock } from '@/app/championships/RealChampionshipBlock';
import { matchAccRoundsToResultEvents } from '@/lib/acc/race-results-store';

export default async function ChampionshipDetailPage({
  params,
}: {
  params: Promise<{ sim: string; slug: string }>;
}) {
  const { sim: simSlug, slug } = await params;
  const sim = getSimBySlug(simSlug);
  if (!sim) notFound();

  const content = (await getChampionships()).find((c) => c.game === sim.game && c.slug === slug);
  if (!content) notFound();

  // AC Evo rounds already know their own results link via emperorRawTrackName
  // (set per round in content); ACC has no such field, so its rounds are
  // matched to acc_race_sessions events here instead — see
  // matchAccRoundsToResultEvents for why this needs both a championship_id
  // pass and a track+date fallback.
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
        — Details
      </span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,64px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-12">
        {content.title}
      </h1>

      <RealChampionshipBlock content={content} roundsWithResults={roundsWithResults} />
    </section>
  );
}
