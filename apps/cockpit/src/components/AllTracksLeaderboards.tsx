import Link from 'next/link';
import { getHotLapBoard } from '@/lib/acevo-hotlaps';
import { getLeaderboardTracks } from '@/lib/leaderboard-tracks';
import type { SimConfig } from '@/content/sims';

// Concept layout: browse leaderboards by track (hero card + top-3 preview)
// rather than by championship round. Hero art is a placeholder gradient —
// swap in real track photography per track when it's available.
export async function AllTracksLeaderboards({ sim }: { sim: SimConfig }) {
  const tracks = getLeaderboardTracks(sim.game);

  if (tracks.length === 0) {
    return (
      <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
        <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">Coming soon</p>
      </div>
    );
  }

  const withPreviews = await Promise.all(
    tracks.map(async (track) => ({
      track,
      top3: (await getHotLapBoard(track.rawTrackName)).slice(0, 3),
    })),
  );

  return (
    <div className="flex flex-col gap-5">
      {withPreviews.map(({ track, top3 }) => (
        <Link
          key={track.slug}
          href={`/${sim.slug}/leaderboards/${track.slug}`}
          className="group flex items-center gap-8 border border-line bg-panel hover:border-gold/40 transition-colors overflow-hidden"
        >
          <div
            className="relative h-[110px] w-[220px] shrink-0 flex items-end p-4 overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${sim.accentColor}33, var(--color-carbon-2) 70%)`,
            }}
          >
            <span
              className="font-display font-black text-[22px] uppercase leading-none"
              style={{ color: sim.accentColor }}
            >
              {track.displayName}
            </span>
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-1 py-4 pr-6">
            {top3.length === 0 ? (
              <span className="font-mono text-[12px] tracking-[.15em] uppercase text-txt-3">
                No laps recorded yet
              </span>
            ) : (
              top3.map((entry) => (
                <div key={entry.steamId} className="flex items-center gap-4 text-[14px]">
                  <span
                    className="font-mono w-5 shrink-0"
                    style={{ color: sim.accentColor }}
                  >
                    #{entry.rank}
                  </span>
                  <span className="font-display font-bold uppercase text-txt truncate flex-1 min-w-0">
                    {entry.driverName}
                  </span>
                  <span className="font-sans text-txt-3 hidden md:block truncate max-w-[180px]">
                    {entry.carModel ?? '—'}
                  </span>
                  <span className="font-mono shrink-0" style={{ color: sim.accentColor }}>
                    {entry.bestLap}
                  </span>
                </div>
              ))
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
