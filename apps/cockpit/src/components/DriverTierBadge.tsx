'use client';

import Image from 'next/image';
import { getDriverTierBadge, type DriverTier } from '@/lib/driver-tier-badge';

// Shared render of a driver's real division/tier/SRAlien badge next to their
// name — same assets and precedence as HotLapBoard's inline version, factored
// out once this pattern started showing up in registration, standings, and
// results tabs too. Renders nothing (no placeholder) when the driver has no
// badge — unlike HotLapBoard's "NR" tag, which only makes sense on a
// leaderboard where every row is implicitly being compared by rank.
export function DriverTierBadge({
  isSralien,
  division,
  tier,
}: {
  isSralien: boolean;
  division: number | null;
  tier: DriverTier | null;
}) {
  const badge = getDriverTierBadge({ isSralien, division, tier });
  if (!badge) return null;

  return (
    <span className="relative w-7 h-7 shrink-0" title={badge.label}>
      <Image src={badge.src} alt={badge.label} fill sizes="28px" unoptimized className="object-contain" />
    </span>
  );
}
