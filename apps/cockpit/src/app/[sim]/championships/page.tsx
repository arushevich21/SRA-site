import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { getChampionships } from '@/lib/championships-store';
import { RealChampionshipBlock } from '@/app/championships/RealChampionshipBlock';
import { SectionLabel } from '@/app/championships/shared';
import { GameLabel } from '@/components/GameLabel';
import { getAccRaceEvents, matchAccRoundsToResultEventsFrom } from '@/lib/acc/race-results-store';
import type { ChampionshipContent } from '@/content/championships';

export default async function SimChampionshipsPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();

  const champs = (await getChampionships()).filter((c) => c.game === sim.game);

  // One acc_race_sessions fetch shared across every championship on this
  // page, not one per championship — see matchAccRoundsToResultEventsFrom.
  const accEvents = sim.game !== 'AC Evo' ? await getAccRaceEvents() : [];
  const roundsWithResultsByChamp = new Map<string, Set<number>>(
    champs
      .filter((c) => c.game !== 'AC Evo')
      .map((c) => [
        c.slug,
        new Set(
          matchAccRoundsToResultEventsFrom(accEvents, c.schedule, c.emperorChampionshipId ?? null).keys(),
        ),
      ]),
  );
  const roundsWithResultsFor = (content: ChampionshipContent) => roundsWithResultsByChamp.get(content.slug);

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — <GameLabel game={sim.game} /> Championships
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Championships
      </h1>

      {champs.length > 0 ? (
        <>
          {champs.filter((c) => c.schedule.length > 0 && !c.teaserOnly).length > 0 && (
            <div className="mb-12">
              <SectionLabel>Active Championships</SectionLabel>
              <div className="flex flex-col gap-6">
                {champs.filter((c) => c.schedule.length > 0 && !c.teaserOnly).map((content) => (
                  <RealChampionshipBlock
                    key={content.slug}
                    content={content}
                    href={`/${slug}/championships/${content.slug}`}
                    roundsWithResults={roundsWithResultsFor(content)}
                  />
                ))}
              </div>
            </div>
          )}

          {champs.filter((c) => c.schedule.length === 0 || c.teaserOnly).length > 0 && (
            <div>
              <SectionLabel muted>Upcoming Championships</SectionLabel>
              <div className="flex flex-col gap-6">
                {champs.filter((c) => c.schedule.length === 0 || c.teaserOnly).map((content) => (
                  <RealChampionshipBlock
                    key={content.slug}
                    content={content}
                    href={`/${slug}/championships/${content.slug}`}
                    roundsWithResults={roundsWithResultsFor(content)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
          <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
            No championships yet — coming soon
          </p>
        </div>
      )}
    </section>
  );
}
