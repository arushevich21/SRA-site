import Image from 'next/image';

// The plain, TIERLESS division badge — public/badges/Division 1..4.png.
//
// Distinct from DriverTierBadge, which renders a DRIVER's own standing
// ("Division 2 Gold.png") and picks SRAlien over it. This one labels a
// division itself: a standings tab, an entry-list column, a filter control.
// A division has no tier, so the gold/silver variants are never right here.
//
// No 'use client': it holds no state, so it renders from a server component
// (the standings tabs) and is pulled into the bundle by the client ones
// (TeamList's filters) without needing its own directive.

// Intrinsic size of the artwork, used to keep the aspect ratio honest at any
// height rather than hard-coding a box that squashes it.
const BADGE_W = 275;
const BADGE_H = 200;

export function DivisionBadge({
  division,
  height = 28,
  label,
  className = '',
}: {
  division: number | null;
  /** Rendered height in px; width follows the artwork's aspect ratio. */
  height?: number;
  /** Overrides the accessible name — pass divisions.name when it isn't "Division N". */
  label?: string;
  className?: string;
}) {
  if (division == null) return null;

  // Kept as real alt text, not decorative: replacing the words with artwork
  // must not cost screen readers, browser find-in-page, or the search filters
  // that match on division name.
  const name = label ?? `Division ${division}`;

  return (
    <Image
      src={`/badges/Division ${division}.png`}
      alt={name}
      title={name}
      width={Math.round(height * (BADGE_W / BADGE_H))}
      height={height}
      unoptimized
      className={`object-contain ${className}`.trim()}
    />
  );
}
