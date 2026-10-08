// Moved out of leaderboard-tracks.ts so scripts/build-car-logos.ts can read
// the icon names without pulling in Supabase.

// AC Evo has no numeric car-ID scheme like ACC — carModel is just a plain
// display string (e.g. "Ferrari 296 GT3", "KTM X-Bow GT2"), and the string
// always leads with the manufacturer. Match a manufacturer token anywhere in
// the string. `icon` is a @cardog-icons/react name (reusing ACC's confirmed
// choices — see ACC_CAR_MANUFACTURER_ICON_NAMES in
// packages/domain/src/acc/acc-constants.ts); manufacturers @cardog-icons has
// no icon for at all carry a `slug` instead, resolved against our own
// manufacturer-logos Supabase bucket as an .svg (see
// scripts/upload-manufacturer-logos.ts — sourced from the manufacturer's own
// brand-kit vector logo, NOT the game's raster badge.png, which can't be
// losslessly converted to SVG — upload under that slug and it picks up
// automatically, same FallbackLogoImage pattern ACC uses). A manufacturer
// with neither shows just the car name.
// Longer/more-specific patterns are listed first so "Mercedes-AMG" and "Aston
// Martin" match before a bare word could.
export const ACEVO_MANUFACTURERS: ReadonlyArray<
  readonly [RegExp, { icon?: string; slug?: string }]
> = [
  [/mercedes|amg/i, { icon: 'MBIconDark' }],
  [/aston\s*martin/i, { icon: 'AstonMartinIconDark' }],
  [/alfa\s*romeo/i, { icon: 'AlfaRomeoIcon' }],
  [/mazda/i, { icon: 'MazdaIcon' }],
  [/ferrari/i, { icon: 'FerrariIconDark' }],
  [/porsche/i, { icon: 'PorscheIcon' }],
  [/lamborghini/i, { icon: 'LamborghiniIcon' }],
  [/mclaren/i, { icon: 'MclarenIconDark' }],
  [/nissan/i, { icon: 'NissanIconDark' }],
  [/bentley/i, { icon: 'BentleyIconDark' }],
  [/maserati/i, { icon: 'MaseratiIcon' }],
  [/chevrolet|chevy|corvette/i, { icon: 'ChevroletIcon' }],
  [/jaguar/i, { icon: 'JaguarIconDark' }],
  [/lexus/i, { icon: 'LexusIconDark' }],
  [/honda|acura/i, { icon: 'HondaIconDark' }],
  [/toyota|gr\b/i, { icon: 'ToyotaIcon' }],
  [/subaru/i, { icon: 'SubaruIcon' }],
  [/hyundai/i, { icon: 'HyundaiIconDark' }],
  [/\bbmw\b/i, { icon: 'BMWIcon' }],
  [/\baudi\b/i, { icon: 'AudiIconDark' }],
  [/\bford\b/i, { icon: 'FordIcon' }],
  [/lotus/i, { icon: 'LotusIcon' }],
  [/\bmini\b/i, { icon: 'MiniIconDark' }],
  [/volkswagen/i, { icon: 'VolkswagenIconDark' }],
  [/datsun/i, { icon: 'NissanIconDark' }],
  // No @cardog-icons entry — fall back to our own uploaded logo, once one
  // exists at that slug in the manufacturer-logos bucket.
  [/ktm|x-?bow/i, { slug: 'ktm' }],
  [/alpine/i, { slug: 'alpine' }],
  [/ginetta/i, { slug: 'ginetta' }],
  [/abarth/i, { slug: 'abarth' }],
  [/caterham/i, { slug: 'caterham' }],
  [/dallara/i, { slug: 'dallara' }],
  [/lancia/i, { slug: 'lancia' }],
  [/mcmurtry/i, { slug: 'mcmurtry' }],
  [/morgan/i, { slug: 'morgan' }],
  [/peugeot/i, { slug: 'peugeot' }],
  [/renault/i, { slug: 'renault' }],
];
