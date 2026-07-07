import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { CHAMPIONSHIPS } from '@/content/championships';
import { getHotLapBoard } from '@/lib/acevo-hotlaps';
import { HotLapBoard } from '@/components/HotLapBoard';
import { Collapsible } from '@/components/Collapsible';

export const dynamic = 'force-dynamic';

export default async function SimLeaderboardsPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();

  const champ = CHAMPIONSHIPS.find((c) => c.game === sim.game && c.emperorChampionshipId);

  const boards = champ
    ? new Map(
        await Promise.all(
          champ.schedule
            .filter((round) => round.emperorRawTrackName)
            .map(
              async (round) =>
                [round.round, await getHotLapBoard(round.emperorRawTrackName!)] as const,
            ),
        ),
      )
    : new Map();

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — {sim.game} Leaderboards
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Leaderboards
      </h1>

      {champ ? (
        <div className="flex flex-col gap-6">
          {champ.schedule.map((round, idx) =>
            round.emperorRawTrackName ? (
              <Collapsible
                key={round.round}
                defaultOpen={idx === 0}
                title={
                  <span className="flex items-center gap-5 flex-1">
                    <span
                      className="font-mono text-[15px] tracking-[.2em] uppercase shrink-0"
                      style={{ color: 'var(--sim-accent)' }}
                    >
                      R{round.round}
                    </span>
                    <span className="font-display font-bold text-[20px] uppercase leading-none text-txt">
                      {round.track}
                    </span>
                  </span>
                }
              >
                <HotLapBoard entries={boards.get(round.round) ?? []} />
              </Collapsible>
            ) : (
              <div
                key={round.round}
                className="flex items-center gap-5 border border-line/50 bg-carbon-2 px-6 py-5 opacity-60"
              >
                <span className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 w-12 shrink-0">
                  R{round.round}
                </span>
                <span className="font-display font-bold text-[20px] uppercase leading-none text-txt-2 flex-1">
                  {round.track}
                </span>
                <span className="font-mono text-[15px] tracking-[.15em] uppercase text-txt-3 shrink-0">
                  Leaderboard pending track confirmation
                </span>
              </div>
            ),
          )}
        </div>
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
