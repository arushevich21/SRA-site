// Pure badge-resolution logic, deliberately split out of driver-lookup.ts
// (which is marked 'server-only' because it hits the DB). A client component
// (HotLapBoard.tsx) needs to call this directly — importing any *value* from
// a server-only-marked module drags that whole module, DB client included,
// into the client bundle and Next.js refuses to build. Type-only imports are
// fine (erased at compile time), so DriverTier is re-exported from here too.
export type { DriverTier } from './driver-lookup';
import type { DriverTier } from './driver-lookup';

export type DriverTierBadge = { src: string; label: string };

// A driver's real assigned classification badge — SRAlien takes priority over
// a division/tier assignment (SRAlien is the tier above D1; a driver can hold
// both, e.g. D1 Gold *and* SRAlien from a top-10 SRAting, but only Alien
// shows). Distinct from the GT3 reference-time pace tags
// (lib/acc/reference-times.ts): this is the driver's actual standing in the
// league, not a per-lap pace comparison, so it doesn't depend on the lap
// itself (class, wet/dry) at all.
export function getDriverTierBadge(info: {
  isSralien: boolean;
  division: number | null;
  tier: DriverTier | null;
}): DriverTierBadge | null {
  if (info.isSralien) return { src: '/badges/Alien.png', label: 'SRAlien' };
  if (info.division != null && info.tier != null) {
    const tierLabel = info.tier === 'gold' ? 'Gold' : 'Silver';
    return {
      src: `/badges/Division ${info.division} ${tierLabel}.png`,
      label: `D${info.division} ${tierLabel}`,
    };
  }
  return null;
}
