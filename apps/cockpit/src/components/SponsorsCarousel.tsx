import Image from 'next/image';
import { PARTNERS } from '@/content/partners';

// Each logo sits in an 88x48 box. The WebPs in /sponsors/marquee are exported
// at exactly 2x that box (see scripts/build-sponsor-marquee-logos.ts), so the
// rendered size is simply the file's size halved — crisp on HiDPI, no
// resampling on 1x.
const LOGO_SCALE = 2;

// The looping track is the partner set rendered exactly twice; the CSS
// animation (globals.css, .marquee-track) slides it by -50% so the second
// copy lands where the first started. Each copy is at least one viewport
// wide (min-w-[100vw]) with its logos spread evenly, so the loop never runs
// out of logos on a wide screen even though the set is only ~1,600px of
// content — that used to be solved by rendering the set 12 times.
//
// justify-around + px-7 keeps the seam invisible: around gives each copy a
// half-gap at both edges, and the 28px padding on each side adds up to the
// same 56px `gap` used between logos, so the join between copies is spaced
// exactly like every other neighbour pair.
function LogoRow({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <ul
      aria-hidden={ariaHidden || undefined}
      className="marquee-half flex shrink-0 items-center justify-around gap-14 px-7 min-w-[100vw] list-none m-0"
    >
      {PARTNERS.map((p) => (
        <li key={p.href} className="shrink-0">
          <a
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            // The duplicate copy is purely visual — keep it out of the tab order.
            tabIndex={ariaHidden ? -1 : undefined}
            className="flex items-center justify-center w-[88px] h-[48px] opacity-50 hover:opacity-100 transition-opacity"
          >
            <Image
              src={p.marquee.src}
              alt={p.name}
              width={Math.round(p.marquee.width / LOGO_SCALE)}
              height={Math.round(p.marquee.height / LOGO_SCALE)}
              loading="lazy"
              className="object-contain"
              // Already the final format and size for this slot — sending it
              // through the optimizer would only spend Image Optimization
              // quota re-encoding a ~5 KB WebP (see next.config images note).
              unoptimized
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function SponsorsCarousel() {
  return (
    <div className="marquee-viewport border-t border-line bg-carbon-2 py-9 overflow-hidden">
      <div className="marquee-track flex w-max">
        <LogoRow />
        <LogoRow ariaHidden />
      </div>
    </div>
  );
}
