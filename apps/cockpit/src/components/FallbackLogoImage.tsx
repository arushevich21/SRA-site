'use client';

import { useState } from 'react';
import Image from 'next/image';

// TrackList/TrackHeader are server components, but hiding on a failed image
// load needs client-side state — isolated here so only this tiny piece needs
// 'use client'. Used specifically for accCarManufacturerLogoUrl's CDN guesses
// (Alpine/Ginetta/KTM — the manufacturers @cardog-icons/react doesn't cover
// at all), which are unconfirmed slugs, unlike the curated DB-driven splash
// art/track map URLs elsewhere.
export function FallbackLogoImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <Image src={src} alt={alt} fill className="object-contain" onError={() => setFailed(true)} />
  );
}
