import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { findLeaderboardTrack } from '@/lib/leaderboard-tracks';
import { getHotLapBoard } from '@/lib/acevo-hotlaps';
import { HotLapBoard } from '@/components/HotLapBoard';
import { GameLabel } from '@/components/GameLabel';

export const dynamic = 'force-dynamic';

export default async function TrackLeaderboardPage({
  params,
}: {
  params: Promise<{ sim: string; track: string }>;
}) {
  const { sim: simSlug, track: trackSlugParam } = await params;
  const sim = getSimBySlug(simSlug);
  if (!sim) notFound();

  const track = findLeaderboardTrack(sim.game, trackSlugParam);
  if (!track) notFound();

  const entries = await getHotLapBoard(track.rawTrackName);

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <Link
        href={`/${sim.slug}/leaderboards`}
        className="inline-block font-mono text-[13px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-8"
      >
        ← All Tracks
      </Link>

      {/* Hero — placeholder gradient until real track photography is ready */}
      <div
        className="relative h-[280px] flex items-end p-10 mb-10 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${sim.accentColor}40, var(--color-carbon-2) 75%)`,
        }}
      >
        <div>
          <span
            className="block font-mono text-[13px] tracking-[.3em] uppercase mb-2"
            style={{ color: sim.accentColor }}
          >
            — <GameLabel game={sim.game} /> Hot Laps
          </span>
          <h1 className="font-display font-black text-[clamp(36px,5vw,64px)] uppercase leading-[.9] tracking-[-1px] text-txt">
            {track.displayName}
          </h1>
        </div>
      </div>

      <HotLapBoard entries={entries} />
    </section>
  );
}
