import { notFound } from 'next/navigation';
import { msToLaptime } from '@sra/domain';
import { getSimBySlug } from '@/content/sims';
import { LeaderboardTabs } from '@/components/LeaderboardTabs';
import { GameLabel } from '@/components/GameLabel';
import { hasSeasonalContent, hasEnduranceReleased } from '@/lib/seasonal-leaderboard';
import {
  getCurrentClassificationScope,
  getPublicHotStintLeaderboard,
} from '@/lib/acc/hot-stint-store';

// Data is written by an external bot on its own schedule, not a cron in this
// app (see lib/acc/hot-stint-store.ts) — revalidate, not force-dynamic, same
// reasoning as every other leaderboard page here: this is read traffic
// against data nobody in this codebase controls the write cadence of, and
// force-dynamic disables caching entirely for no benefit.
export const revalidate = 300;

// Hot Stint Qualifying: the pre-season classification board. Public columns
// are position, driver name, and hotstint_ms ONLY — no lap counts, no
// SteamID/Discord ID, no rating internals (composite/pace_pct/
// srating_ordinal), and no "last improved" timestamp (classification_status
// has no per-driver improvement timestamp to show one — see
// lib/acc/hot-stint-store.ts). All of that is admin-only, permanently: this
// board decides division placement, and revealing how many laps someone
// needed to set their time would cause exactly the placement disputes that
// rule exists to prevent.
export default async function HotStintQualifyingPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();
  if (sim.game !== 'ACC') notFound();

  const scope = await getCurrentClassificationScope();
  const entries = scope ? await getPublicHotStintLeaderboard(scope.series, scope.season) : [];

  const [showSeasonal, showEndurance] = await Promise.all([
    hasSeasonalContent(),
    hasEnduranceReleased(),
  ]);

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
        showSeasonal={showSeasonal}
        showEndurance={showEndurance}
        showHotStintQualifying
      />

      <p className="font-sans text-[15px] text-txt-2 leading-relaxed max-w-[640px] mb-8 -mt-4">
        Hot Stint Qualifying ranks each driver by the{' '}
        <span className="text-txt">average of their best 5 consecutive valid laps</span> set
        during the pre-season classification window — used to assign divisions before the
        season begins.
      </p>

      {entries.length === 0 ? (
        <div className="border border-line/50 bg-carbon-2 px-8 py-16 text-center">
          <p className="font-sans text-[15px] text-txt-2 leading-relaxed max-w-[560px] mx-auto">
            {scope
              ? 'No qualifying times yet — check back once drivers start setting times on the classification server.'
              : 'Hot Stint Qualifying is not currently running.'}
          </p>
        </div>
      ) : (
        <div className="border border-line overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-carbon-2">
                <th className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 px-5 py-3">
                  Pos
                </th>
                <th className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 px-5 py-3">
                  Driver
                </th>
                <th className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3 px-5 py-3">
                  Stint Avg
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.position} className="border-b border-line/50 last:border-b-0">
                  <td className="font-mono text-[13px] text-txt-3 px-5 py-3">{entry.position}</td>
                  <td className="font-sans text-[14px] text-txt px-5 py-3">{entry.driverName}</td>
                  <td className="font-mono text-[13px] text-txt px-5 py-3">
                    {msToLaptime(entry.hotstintMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
