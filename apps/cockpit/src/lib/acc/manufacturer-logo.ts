import { ACC_CAR_MANUFACTURER_CDN_SLUGS } from '@sra/domain';

// Public URL for a manufacturer's uploaded logo in the manufacturer-logos
// Supabase Storage bucket — our own hosting, since the old site's CDN (where
// this used to point) is gone. Lives here rather than in packages/domain
// because it needs NEXT_PUBLIC_SUPABASE_URL (the Supabase project ID isn't
// hardcoded anywhere in source), and packages/domain stays pure (no env, no
// network) — ACC_CAR_MANUFACTURER_CDN_SLUGS (the actual manufacturer->slug
// data) stays there since that part is pure. Mirrors acEvoManufacturerLogoUrl
// in lib/leaderboard-tracks.ts. Returns null whenever the car model has no
// mapped slug (most cars use a @cardog-icons/react icon instead — see
// ACC_CAR_MANUFACTURER_ICON_NAMES); callers should render defensively via
// FallbackLogoImage, since a mapped slug doesn't guarantee the file has
// actually been uploaded yet.
export function accCarManufacturerLogoUrl(carModel: number): string | null {
  const slug = ACC_CAR_MANUFACTURER_CDN_SLUGS[carModel];
  if (!slug) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/manufacturer-logos/${slug}.svg`;
}
