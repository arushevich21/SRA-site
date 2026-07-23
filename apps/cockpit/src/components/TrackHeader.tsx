import Image from 'next/image';
import { Icon, type IconName } from '@cardog-icons/react';
import { FallbackLogoImage } from './FallbackLogoImage';
import type { TrackSummary, TrackTopEntry } from '@/lib/track-summary';

// Regional-indicator flag emoji render unreliably on Windows/Chrome (often
// just the letters, or nothing) — an actual image is more portable. flagcdn.com
// is a free public CDN keyed by ISO 3166-1 alpha-2 code.
function countryFlagUrl(countryCode: string): string {
  return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
}

export function TrackHeader({
  track,
  fastestLap,
}: {
  track: TrackSummary;
  fastestLap: TrackTopEntry | null;
}) {
  return (
    <div className="relative w-full h-[220px] sm:h-[320px] border border-line overflow-hidden mb-10">
      {track.splashArtUrl && (
        <Image src={track.splashArtUrl} alt={track.displayName} fill className="object-cover" />
      )}
      <div className="absolute inset-0 bg-carbon/75" />

      <div className="relative flex items-center h-full px-5 py-5 sm:px-9 sm:py-8 gap-10">
        <div className="flex flex-col gap-2 sm:gap-4 min-w-0 shrink sm:shrink-0 max-w-full sm:max-w-[520px]">
          <h1
            className="font-display font-black text-[clamp(28px,8vw,64px)] uppercase leading-none tracking-[-1px] italic truncate"
            style={{ color: 'var(--sim-accent)' }}
          >
            {track.displayName}
          </h1>

          {track.location && (
            <span className="flex font-sans text-[14px] sm:text-[18px] text-white/80 items-center gap-2">
              {track.country && (
                <span className="relative w-5 h-[14px] sm:w-6 sm:h-[18px] shrink-0 overflow-hidden">
                  <Image
                    src={countryFlagUrl(track.country)}
                    alt={track.country}
                    fill
                    className="object-cover"
                  />
                </span>
              )}
              {track.location}
            </span>
          )}

          {fastestLap && (
            <div className="mt-1 sm:mt-3 flex flex-col gap-1 sm:gap-2 min-w-0">
              <span className="font-mono text-[12px] sm:text-[15px] tracking-[.15em] uppercase text-white/60">
                🏁 Fastest lap
              </span>
              <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
                <span className="font-display font-bold text-[24px] sm:text-[32px] uppercase text-white leading-none truncate min-w-0">
                  {fastestLap.driverName}
                </span>
                <span
                  className="font-mono text-[26px] sm:text-[32px] tabular-nums leading-none shrink-0"
                  style={{ color: 'var(--sim-accent)' }}
                >
                  {fastestLap.bestLap}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                {fastestLap.manufacturerIconName ? (
                  <span className="relative w-7 h-7 shrink-0 flex items-center justify-center">
                    <Icon name={fastestLap.manufacturerIconName as IconName} size={28} color="white" />
                  </span>
                ) : (
                  fastestLap.manufacturerLogoUrl && (
                    <span className="relative w-7 h-7 shrink-0">
                      <FallbackLogoImage src={fastestLap.manufacturerLogoUrl} alt="" />
                    </span>
                  )
                )}
                <span className="font-sans text-[16px] text-white/70">
                  {fastestLap.carLabel ?? '—'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="hidden sm:block relative flex-1 h-full min-w-0">
          {track.mapUrl && (
            <Image src={track.mapUrl} alt="" fill className="object-contain opacity-90" />
          )}
        </div>
      </div>
    </div>
  );
}
