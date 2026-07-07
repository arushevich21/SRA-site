import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { CHAMPIONSHIPS, type ChampionshipContent } from '@/content/championships';
import { getAcEvoStandings } from '@/lib/acevo-standings';
import { getRoundPoints } from '@/lib/acevo-hotlaps';
import { EmperorStandingsTable } from '@/components/EmperorStandingsTable';

export const dynamic = 'force-dynamic';

export default async function SimStandingsPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();

  const champ = CHAMPIONSHIPS.find((c) => c.game === sim.game && c.emperorChampionshipId);

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — {sim.game} Standings
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Standings
      </h1>

      {champ?.emperorChampionshipId ? (
        <AcEvoStandingsSection champ={champ} />
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

async function AcEvoStandingsSection({ champ }: { champ: ChampionshipContent }) {
  const result = await getAcEvoStandings(champ.emperorChampionshipId!);

  if (!result.ok) {
    return (
      <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
        <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mb-3">
          Standings temporarily unavailable
        </p>
        <p className="font-sans text-[15px] text-txt-3">
          Emperor&apos;s live data couldn&apos;t be reached. Try again shortly.
        </p>
      </div>
    );
  }

  const isEmpty = Object.values(result.data.driverStandings).every((s) => s.length === 0);
  if (isEmpty) {
    return (
      <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
        <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
          No standings posted yet
        </p>
      </div>
    );
  }

  const roundsWithTrack = champ.schedule.filter((r) => r.emperorRawTrackName);
  const rounds = await Promise.all(
    roundsWithTrack.map(async (r) => ({
      round: r.round,
      track: r.track,
      points: await getRoundPoints(r.emperorRawTrackName!),
    })),
  );

  return <EmperorStandingsTable data={result.data} rounds={rounds} />;
}
