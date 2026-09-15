import { PARTNERS } from '@/content/partners';

const SECONDS_PER_LOGO = 10;

// Transparent corner source: one partner logo at a time, crossfading.
export function PartnersOverlay() {
  const total = PARTNERS.length * SECONDS_PER_LOGO;
  return (
    <div className="ov-slideshow" style={{ '--ov-slide-total': `${total}s` } as React.CSSProperties}>
      {PARTNERS.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- static logo
        <img
          key={p.name}
          src={p.logo}
          alt={p.name}
          style={{ '--ov-slide-delay': `${i * SECONDS_PER_LOGO}s` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
