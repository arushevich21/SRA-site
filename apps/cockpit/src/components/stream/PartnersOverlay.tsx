import { PARTNERS } from '@/content/partners';
import Image from 'next/image';

/** Standalone partner slideshow matching the old OBS /overlay/partners source. */
export function PartnersOverlay() {
  return <div className="stream-partners-slideshow" role="region" aria-label="Rotating sponsor">
    {PARTNERS.map((partner) => <Image key={partner.name} src={partner.logo} alt={partner.name} width={400} height={200} sizes="16vw" unoptimized />)}
  </div>;
}
