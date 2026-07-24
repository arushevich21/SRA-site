import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { LeaderboardTabs } from '@/components/LeaderboardTabs';
import { GameLabel } from '@/components/GameLabel';
import { hasSeasonalReleased } from '@/lib/seasonal-leaderboard';
// showEndurance is forced true here — you're on the endurance page.

export const dynamic = 'force-dynamic';

export default async function EnduranceLeaderboardsPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();
  // The Seasonal/Endurance split only applies to ACC (Team Series vs Endurance).
  if (sim.game !== 'ACC') notFound();

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
        showSeasonal={await hasSeasonalReleased()}
        showEndurance
      />

      <div className="border border-line/50 bg-carbon-2 px-8 py-16 text-center">
        <p className="font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-4">
          Coming Soon
        </p>
        <p className="font-sans text-[15px] text-txt-2 leading-relaxed max-w-[620px] mx-auto">
          Endurance qualifying runs on a dedicated pre-qualification server. Once
          it opens, each driver&apos;s time here will be the{' '}
          <span className="text-txt">average of their best 3 valid laps</span> on
          the event track during the pre-qual window — not a single hot lap.
        </p>
        <a
          href="https://discord.gg/SimRacingAlliance"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-6 font-mono text-[11px] tracking-[.2em] uppercase text-gold hover:text-gold-soft transition-colors"
        >
          Join Discord for pre-qual dates →
        </a>
      </div>
    </section>
  );
}
