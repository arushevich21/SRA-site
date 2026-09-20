export type PartnerTier = 'featured' | 'community' | 'additional';
// `logo` is the full-size original (partners page, stream overlay). `marquee`
// is the small WebP the footer SponsorsCarousel serves instead, with the
// file's real pixel size so next/image can reserve the box up front. The
// files are exported at 2x the carousel's 88x48 box for HiDPI — regenerate
// with `pnpm exec tsx scripts/build-sponsor-marquee-logos.ts`, which prints
// these entries.
export type MarqueeLogo = { src: string; width: number; height: number };
export type Partner = { name: string; logo: string; href: string; tier: PartnerTier; marquee: MarqueeLogo };

export const PARTNERS: Partner[] = [
  { name: 'Armamentario', logo: '/sponsors/partners/armamentario/ARMA-white.png', href: 'https://www.armamentario.com', tier: 'community', marquee: { src: '/sponsors/marquee/armamentario.webp', width: 176, height: 77 } },
  { name: 'AT3D', logo: '/sponsors/sliders/at3d-sim-shop.png', href: 'https://at3d.net', tier: 'additional', marquee: { src: '/sponsors/marquee/at3d.webp', width: 176, height: 70 } },
  { name: 'Castle Cauldron', logo: '/sponsors/sliders/castlecauldron.png', href: 'https://facebook.com/castlecauldron', tier: 'additional', marquee: { src: '/sponsors/marquee/castle-cauldron.webp', width: 61, height: 96 } },
  { name: 'Documize', logo: '/sponsors/sliders/documize-com.png', href: 'https://documize.com', tier: 'additional', marquee: { src: '/sponsors/marquee/documize.webp', width: 176, height: 40 } },
  { name: 'Echoes of Nox', logo: '/sponsors/sliders/echoes_of_nox.png', href: 'https://store.steampowered.com/app/4368440/Echoes_of_Nox/', tier: 'additional', marquee: { src: '/sponsors/marquee/echoes-of-nox.webp', width: 176, height: 81 } },
  { name: 'GO Setups', logo: '/sponsors/sliders/go-setups.png', href: 'https://gosetups.gg/product/acc-setups/?ref=5879', tier: 'community', marquee: { src: '/sponsors/marquee/go-setups.webp', width: 157, height: 96 } },
  { name: 'KP Concepts', logo: '/sponsors/sliders/kp_concepts.png', href: 'https://www.kpconcepts.com', tier: 'featured', marquee: { src: '/sponsors/marquee/kp-concepts.webp', width: 176, height: 45 } },
  { name: 'Retro Saga', logo: '/sponsors/sliders/retro-saga-ca.png', href: 'https://retrosaga.ca', tier: 'additional', marquee: { src: '/sponsors/marquee/retro-saga.webp', width: 176, height: 78 } },
  { name: 'Trackside', logo: '/sponsors/sliders/TS_Logo_White_SVG.png', href: 'https://trackside.vip', tier: 'featured', marquee: { src: '/sponsors/marquee/trackside.webp', width: 176, height: 31 } },
  { name: 'Trak Racer', logo: '/sponsors/partners/trak-racer/logo-new.png', href: 'https://trakracer.com', tier: 'community', marquee: { src: '/sponsors/marquee/trak-racer.webp', width: 176, height: 41 } },
  { name: 'Triple Stint', logo: '/sponsors/partners/triple-stint/White%20Text/Logo.png', href: 'https://triplestintracing.com/', tier: 'featured', marquee: { src: '/sponsors/marquee/triple-stint.webp', width: 176, height: 33 } },
];

// The stream's partner strip shows one tier at a time, in this order.
export const PARTNER_TIERS: { key: PartnerTier; label: string }[] = [
  { key: 'featured', label: 'Featured partners' },
  { key: 'community', label: 'Community partners' },
  { key: 'additional', label: 'Additional partners' },
];
