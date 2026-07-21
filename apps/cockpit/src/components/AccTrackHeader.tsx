import Image from 'next/image';
import { accCarManufacturerLogoUrl, accTrackMapUrl } from '@sra/domain';
import type { AccHotLapEntry } from '@sra/shared-types';
import type { AccTrack } from '@/lib/acc/tracks';

// Regional-indicator flag emoji render unreliably on Windows/Chrome (often
// just the letters, or nothing) — an actual image is more portable. flagcdn.com
// is a free public CDN keyed by ISO 3166-1 alpha-2 code.
function countryFlagUrl(countryCode: string): string {
  return `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`;
}

export function AccTrackHeader({
  track,
  fastestLap,
}: {
  track: AccTrack;
  fastestLap: AccHotLapEntry | null;
}) {
  const logoUrl =
    fastestLap?.carModel != null ? accCarManufacturerLogoUrl(fastestLap.carModel) : null;

  return (
    <div className="relative w-full h-[320px] border border-line overflow-hidden mb-10">
      {track.splashArtUrl && (
        <Image src={track.splashArtUrl} alt={track.displayName} fill className="object-cover" />
      )}
      <div className="absolute inset-0 bg-carbon/75" />

      <div className="relative flex items-center h-full px-9 py-8 gap-10">
        <div className="flex flex-col gap-4 min-w-0 shrink-0 max-w-[520px]">
          <h1
            className="font-display font-black text-[clamp(40px,6vw,64px)] uppercase leading-none tracking-[-1px] italic"
            style={{ color: 'var(--sim-accent)' }}
          >
            {track.displayName}
          </h1>

          {track.location && (
            <span className="font-sans text-[18px] text-white/80 flex items-center gap-2">
              {track.country && (
                <span className="relative w-6 h-[18px] shrink-0 overflow-hidden">
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
            <div className="mt-3 flex flex-col gap-2">
              <span className="font-mono text-[15px] tracking-[.15em] uppercase text-white/60">
                🏁 Fastest lap
              </span>
              <div className="flex items-center gap-4">
                <span className="font-display font-bold text-[32px] uppercase text-white leading-none">
                  {fastestLap.driverName}
                </span>
                <span
                  className="font-mono text-[32px] tabular-nums leading-none"
                  style={{ color: 'var(--sim-accent)' }}
                >
                  {fastestLap.bestLap}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {logoUrl && (
                  <span className="relative w-7 h-7 shrink-0">
                    <Image src={logoUrl} alt="" fill className="object-contain" />
                  </span>
                )}
                <span className="font-sans text-[16px] text-white/70">
                  {fastestLap.carModelName ?? '—'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="relative flex-1 h-full min-w-0">
          <Image
            src={accTrackMapUrl(track.trackKey)}
            alt=""
            fill
            className="object-contain opacity-90"
          />
        </div>
      </div>
    </div>
  );
}
