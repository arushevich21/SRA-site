import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Icon, type IconName } from '@cardog-icons/react';
import { FallbackLogoImage } from './FallbackLogoImage';
import type { TrackSummary, TrackTopEntry } from '@/lib/track-summary';

export type TrackWithTopTimes = TrackSummary & {
  topTimes: TrackTopEntry[];
  entriesCount?: number;
  lastUpdated?: string | null;
};

export function TrackList({
  tracks,
  simSlug,
}: {
  tracks: TrackWithTopTimes[];
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
          className="group relative flex flex-col sm:flex-row sm:items-center h-auto sm:h-[130px] px-4 sm:px-6 py-4 sm:py-0 gap-3 sm:gap-6 overflow-hidden hover:bg-carbon-2/60 transition-colors"
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
          <div className="relative w-full sm:w-[220px] shrink-0 flex flex-col gap-1">
            <span
              className="font-display font-bold text-[20px] sm:text-[24px] uppercase underline decoration-2 underline-offset-4 leading-tight"
              style={{ color: 'var(--sim-accent)' }}
            >
              {track.displayName}
            </span>
            {track.entriesCount != null && (
              <span className="hidden sm:inline font-mono text-[12px] tracking-[.1em] uppercase text-white/60">
                {track.entriesCount} {track.entriesCount === 1 ? 'entry' : 'entries'}
              </span>
            )}
            {track.lastUpdated && (
              <span className="hidden sm:inline font-mono text-[12px] tracking-[.1em] uppercase text-white/60">
                Updated {formatDistanceToNow(new Date(track.lastUpdated))} ago
              </span>
            )}
          </div>

          {/* Middle: track map (hidden on mobile to leave room for name + top 3) */}
          <div className="hidden sm:flex relative flex-1 items-center justify-center min-w-0 h-full py-4">
            {track.mapUrl && (
              <div className="relative w-full max-w-[200px] h-full">
                <Image src={track.mapUrl} alt="" fill className="object-contain opacity-90" />
              </div>
            )}
          </div>

          {/* Right: top 3 times */}
          <div className="relative w-full sm:w-[400px] shrink-0 flex flex-col gap-2">
            {track.topTimes.length === 0 ? (
              <p className="font-mono text-[13px] tracking-[.2em] uppercase text-txt-3">
                No laps recorded yet
              </p>
            ) : (
              track.topTimes.map((entry) => (
                <div key={entry.steamId} className="flex items-center gap-2 sm:gap-3">
                  <span
                    className="font-mono text-[13px] w-6 shrink-0"
                    style={entry.rank <= 3 ? { color: 'var(--sim-accent)' } : undefined}
                  >
                    #{entry.rank}
                  </span>
                  <span className="font-display font-semibold text-[14px] uppercase text-white truncate flex-1 min-w-0">
                    {entry.driverName}
                  </span>
                  <span className="hidden sm:flex relative w-5 h-5 shrink-0 items-center justify-center">
                    {entry.manufacturerIconName ? (
                      <Icon name={entry.manufacturerIconName as IconName} size={20} color="white" />
                    ) : (
                      entry.manufacturerLogoUrl && (
                        <FallbackLogoImage src={entry.manufacturerLogoUrl} alt={entry.carLabel ?? ''} />
                      )
                    )}
                  </span>
                  <span className="hidden sm:block font-sans text-[12px] text-white/70 truncate w-[130px] shrink-0">
                    {entry.carLabel ?? '—'}
                  </span>
                  <span
                    className="font-mono text-[13px] tabular-nums shrink-0"
                    style={{ color: 'var(--sim-accent)' }}
                  >
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
