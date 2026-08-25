'use client';

import { useState } from 'react';
import Image from 'next/image';

// TrackList/TrackHeader are server components, but hiding on a failed image
// load needs client-side state — isolated here so only this tiny piece needs
// 'use client'. Used specifically for accCarManufacturerLogoUrl's CDN guesses
// (Alpine/Ginetta/KTM — the manufacturers @cardog-icons/react doesn't cover
// at all), which are unconfirmed slugs, unlike the curated DB-driven splash
// art/track map URLs elsewhere.
export function FallbackLogoImage({
  src,
  alt,
  sizes = '20px',
}: {
  src: string;
  alt: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      // SVG source — vector, so Next's raster resizing buys nothing here,
      // and unconfigured SVG optimization (no dangerouslyAllowSVG) would
      // otherwise burn an Image Optimization transformation for no benefit.
      unoptimized
      className="object-contain"
      onError={() => setFailed(true)}
    />
  );
}
