export type PartnerTier = 'featured' | 'community' | 'additional';
export type Partner = { name: string; logo: string; href: string; tier: PartnerTier };

export const PARTNERS: Partner[] = [
  { name: 'Armamentario', logo: '/sponsors/partners/armamentario/ARMA-white.png', href: 'https://www.armamentario.com', tier: 'community' },
  { name: 'AT3D', logo: '/sponsors/sliders/at3d-sim-shop.png', href: 'https://at3d.net', tier: 'additional' },
  { name: 'Castle Cauldron', logo: '/sponsors/sliders/castlecauldron.png', href: 'https://facebook.com/castlecauldron', tier: 'additional' },
  { name: 'Documize', logo: '/sponsors/sliders/documize-com.png', href: 'https://documize.com', tier: 'additional' },
  { name: 'Echoes of Nox', logo: '/sponsors/sliders/echoes_of_nox.png', href: 'https://store.steampowered.com/app/4368440/Echoes_of_Nox/', tier: 'additional' },
  { name: 'GO Setups', logo: '/sponsors/sliders/go-setups.png', href: 'https://gosetups.gg/product/acc-setups/?ref=5879', tier: 'community' },
  { name: 'KP Concepts', logo: '/sponsors/sliders/kp_concepts.png', href: 'https://www.kpconcepts.com', tier: 'featured' },
  { name: 'Retro Saga', logo: '/sponsors/sliders/retro-saga-ca.png', href: 'https://retrosaga.ca', tier: 'additional' },
  { name: 'Trackside', logo: '/sponsors/sliders/TS_Logo_White_SVG.png', href: 'https://trackside.vip', tier: 'featured' },
  { name: 'Trak Racer', logo: '/sponsors/partners/trak-racer/logo-new.png', href: 'https://trakracer.com', tier: 'community' },
  { name: 'Triple Stint', logo: '/sponsors/partners/triple-stint/White%20Text/Logo.png', href: 'https://triplestintracing.com/', tier: 'featured' },
];

// The stream's partner strip shows one tier at a time, in this order.
export const PARTNER_TIERS: { key: PartnerTier; label: string }[] = [
  { key: 'featured', label: 'Featured partners' },
  { key: 'community', label: 'Community partners' },
  { key: 'additional', label: 'Additional partners' },
];
