import { Icon, type IconName } from '@cardog-icons/react';
import { FallbackLogoImage } from './FallbackLogoImage';

// A manufacturer icon/logo box, sized to `size`. Takes the already-resolved
// source (see resolveCarLogo in lib/acc/manufacturer-logo.ts) so it can be
// rendered from either a server or a client component. Renders nothing at all
// when neither an icon nor a logo exists — no generic glyph — so callers can
// drop it in unconditionally.
export function CarLogo({
  manufacturerIconName,
  manufacturerLogoUrl,
  alt,
  size = 16,
}: {
  manufacturerIconName: string | null;
  manufacturerLogoUrl: string | null;
  alt: string;
  size?: number;
}) {
  const box = { width: size, height: size };
  if (manufacturerIconName) {
    return (
      <span className="relative shrink-0 flex items-center justify-center" style={box}>
        <Icon name={manufacturerIconName as IconName} size={size} />
      </span>
    );
  }
  if (manufacturerLogoUrl) {
    return (
      <span className="relative shrink-0" style={box}>
        <FallbackLogoImage src={manufacturerLogoUrl} alt={alt} sizes={`${size}px`} />
      </span>
    );
  }
  return null;
}
