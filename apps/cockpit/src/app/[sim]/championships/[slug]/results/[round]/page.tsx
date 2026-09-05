import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { getChampionships } from '@/lib/championships-store';
import { AcEvoResultsTabs } from '@/components/AcEvoResultsTabs';
import { ResultsTabs } from '@/components/ResultsTabs';
import { getAccRaceEventSessions, matchAccRoundsToResultEvents } from '@/lib/acc/race-results-store';

type PageProps = {
  params: Promise<{ sim: string; slug: string; round: string }>;
};

export default async function ChampionshipRoundResultsPage({ params }: PageProps) {
  const { sim: simSlug, slug, round: roundParam } = await params;
  const sim = getSimBySlug(simSlug);
  if (!sim) notFound();

  const content = (await getChampionships()).find((c) => c.game === sim.game && c.slug === slug);
  if (!content) notFound();

  const roundNumber = Number(roundParam);
  const round = content.schedule.find((r) => r.round === roundNumber);
  if (!round) notFound();

  // AC Evo looks up Emperor's results API directly by the round's own
  // emperorRawTrackName field (content-authored). ACC has no such field —
  // its round is matched to an acc_race_sessions event instead (see
  // matchAccRoundsToResultEvents for why that needs both a championship_id
  // pass and a track+date fallback, and RealChampionshipBlock's
  // roundsWithResults for the same match used to decide whether this round's
  // card was even shown as a link).
  const accEventKey =
    content.game !== 'AC Evo'
      ? (await matchAccRoundsToResultEvents(content.schedule, content.emperorChampionshipId ?? null)).get(
          round.round,
        )
      : undefined;
  const accSessions = accEventKey ? await getAccRaceEventSessions(accEventKey) : null;

  if (!round.emperorRawTrackName && !accSessions) notFound();

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <Link
        href={`/${sim.slug}/championships/${slug}`}
        className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-5"
      >
        ← {content.title}
      </Link>
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — Round {round.round} Results
      </span>
      <h1 className="font-display font-black text-[clamp(36px,5vw,64px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-3">
        {round.track}
      </h1>
      {round.date && (
        <p className="font-mono text-[12px] text-txt-3 mb-10">
          {new Date(round.date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      )}

      {accSessions ? <ResultsTabs sessions={accSessions} /> : <AcEvoResultsTabs trackKey={round.emperorRawTrackName!} />}
    </section>
  );
}
