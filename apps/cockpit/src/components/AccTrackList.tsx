import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { accCarManufacturerLogoUrl, accTrackMapUrl } from '@sra/domain';
import type { AccHotLapEntry } from '@sra/shared-types';
import type { AccTrack, AccTrackStats } from '@/lib/acc/tracks';

export type AccTrackWithTopTimes = AccTrack &
  AccTrackStats & { topTimes: AccHotLapEntry[] };

export function AccTrackList({
  tracks,
  simSlug,
}: {
  tracks: AccTrackWithTopTimes[];
  simSlug: string;
}) {
  if (tracks.length === 0) {
    return (
      <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
        <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
          No tracks yet
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col border border-line divide-y divide-line">
      {tracks.map((track) => (
        <Link
          key={track.trackKey}
          href={`/${simSlug}/leaderboards/${track.trackKey}`}
          className="group relative flex items-center h-[130px] px-6 gap-6 overflow-hidden hover:bg-carbon-2/60 transition-colors"
        >
          {/* Full-bleed darkened splash art */}
          {track.splashArtUrl && (
            <Image
              src={track.splashArtUrl}
              alt={track.displayName}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-carbon/75" />

          {/* Left: track name + meta */}
          <div className="relative w-[220px] shrink-0 flex flex-col gap-1">
            <span
              className="font-display font-bold text-[24px] uppercase underline decoration-2 underline-offset-4 leading-tight"
              style={{ color: 'var(--sim-accent)' }}
            >
              {track.displayName}
            </span>
            <span className="font-mono text-[12px] tracking-[.1em] uppercase text-white/60">
              {track.entriesCount} {track.entriesCount === 1 ? 'entry' : 'entries'}
            </span>
            {track.lastUpdated && (
              <span className="font-mono text-[12px] tracking-[.1em] uppercase text-white/60">
                Updated {formatDistanceToNow(new Date(track.lastUpdated))} ago
              </span>
            )}
          </div>

          {/* Middle: track map */}
          <div className="relative flex-1 flex items-center justify-center min-w-0 h-full py-4">
            <div className="relative w-full max-w-[200px] h-full">
              <Image
                src={accTrackMapUrl(track.trackKey)}
                alt=""
                fill
                className="object-contain opacity-90"
              />
            </div>
          </div>

          {/* Right: top 3 times */}
          <div className="relative w-[400px] shrink-0 flex flex-col gap-2">
            {track.topTimes.length === 0 ? (
              <p className="font-mono text-[13px] tracking-[.2em] uppercase text-txt-3">
                No laps recorded yet
              </p>
            ) : (
              track.topTimes.map((entry) => {
                const logoUrl =
                  entry.carModel != null ? accCarManufacturerLogoUrl(entry.carModel) : null;
                return (
                  <div key={entry.steamId} className="flex items-center gap-3">
                    <span
                      className="font-mono text-[13px] w-6 shrink-0"
                      style={entry.rank <= 3 ? { color: 'var(--sim-accent)' } : undefined}
                    >
                      #{entry.rank}
                    </span>
                    <span className="font-display font-semibold text-[14px] uppercase text-white truncate flex-1 min-w-0">
                      {entry.driverName}
                    </span>
                    <span className="relative w-5 h-5 shrink-0">
                      {logoUrl && (
                        <Image
                          src={logoUrl}
                          alt={entry.carModelName ?? ''}
                          fill
                          className="object-contain"
                        />
                      )}
                    </span>
                    <span className="font-sans text-[12px] text-white/70 truncate w-[130px] shrink-0">
                      {entry.carModelName ?? '—'}
                    </span>
                    <span
                      className="font-mono text-[13px] tabular-nums shrink-0"
                      style={{ color: 'var(--sim-accent)' }}
                    >
                      {entry.bestLap}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
