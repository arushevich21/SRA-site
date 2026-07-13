import Image from 'next/image';
import { PARTNERS } from '@/content/partners';

// Each "half" of the looping track must be at least as wide as the widest
// realistic viewport, or the track runs out of logos before the loop point
// and bare background shows through. 6 copies of the 11-partner set is
// ~9,500px per half — comfortably covers ultra-wide/multi-4K monitors.
const REPEATS = 6;
const HALF = Array.from({ length: REPEATS }, () => PARTNERS).flat();
const TRACK = [...HALF, ...HALF];

export function SponsorsCarousel() {
  return (
    <div className="border-t border-line bg-carbon-2 py-9 overflow-hidden">
      <div className="marquee-track flex items-center">
        {TRACK.map((p, i) => (
          <a
            key={`${p.href}-${i}`}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center justify-center w-[88px] h-[48px] mr-14 opacity-50 hover:opacity-100 transition-opacity"
          >
            <Image
              src={p.logo}
              alt={p.name}
              width={88}
              height={48}
              className="max-h-[48px] max-w-[88px] object-contain"
              unoptimized
            />
          </a>
        ))}
      </div>
    </div>
  );
}
