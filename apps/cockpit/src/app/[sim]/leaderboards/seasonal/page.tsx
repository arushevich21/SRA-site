import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { LeaderboardTabs } from '@/components/LeaderboardTabs';
import { AccTrackLeaderboard } from '@/components/AccTrackLeaderboard';
import { GameLabel } from '@/components/GameLabel';
import { getSeasonalBoards, hasEnduranceReleased } from '@/lib/seasonal-leaderboard';

export const dynamic = 'force-dynamic';

export default async function SeasonalLeaderboardsPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();
  // Seasonal boards are ACC-only (accsm1-7 championships).
  if (sim.game !== 'ACC') notFound();

  const boards = await getSeasonalBoards();

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — <GameLabel game={sim.game} /> Leaderboards
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Leaderboards
      </h1>

      <LeaderboardTabs
        simSlug={sim.slug}
        showSeasonal
        showEndurance={await hasEnduranceReleased()}
      />

      {boards.length === 0 ? (
        <div className="border border-line/50 bg-carbon-2 px-8 py-16 text-center">
          <p className="font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-4">
            Nothing Released Yet
          </p>
          <p className="font-sans text-[15px] text-txt-2 leading-relaxed max-w-[560px] mx-auto">
            Seasonal hot-lap boards are published per race by the admins. Check
            back on race week.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-16">
          {boards.map((champ) => (
            <div key={champ.slug}>
              <h2 className="font-display font-bold text-[22px] uppercase text-gold mb-6">
                {champ.title}
              </h2>
              <div className="flex flex-col gap-12">
                {champ.rounds.map((r) => (
                  <div key={r.round}>
                    <div className="flex items-baseline gap-3 mb-4">
                      <span className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3">
                        Round {r.round}
                      </span>
                      <span className="font-display font-bold text-[18px] uppercase text-txt">
                        {r.trackDisplay}
                      </span>
                    </div>
                    <AccTrackLeaderboard leaderboardByCarGroup={r.leaderboardByCarGroup} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
