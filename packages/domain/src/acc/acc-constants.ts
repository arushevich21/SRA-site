// Lookup tables for ACC's numeric enums. Source: Assetto Corsa Competizione
// Server Admin Handbook, section IX.3 (Car model list) and IX.5 (Cup Category
// list). The raw result JSON only carries these as integers — resolve to the
// human-readable name here rather than pushing raw IDs out to consumers.

export const ACC_CAR_MODEL_NAMES: Readonly<Record<number, string>> = {
  0: 'Porsche 991 GT3 R',
  1: 'Mercedes-AMG GT3',
  2: 'Ferrari 488 GT3',
  3: 'Audi R8 LMS',
  4: 'Lamborghini Huracan GT3',
  5: 'McLaren 650S GT3',
  6: 'Nissan GT-R Nismo GT3 2018',
  7: 'BMW M6 GT3',
  8: 'Bentley Continental GT3 2018',
  9: 'Porsche 991II GT3 Cup',
  10: 'Nissan GT-R Nismo GT3 2017',
  11: 'Bentley Continental GT3 2016',
  12: 'Aston Martin V12 Vantage GT3',
  13: 'Lamborghini Gallardo R-EX',
  14: 'Jaguar G3',
  15: 'Lexus RC F GT3',
  16: 'Lamborghini Huracan Evo (2019)',
  17: 'Honda NSX GT3',
  18: 'Lamborghini Huracan SuperTrofeo',
  19: 'Audi R8 LMS Evo (2019)',
  20: 'AMR V8 Vantage (2019)',
  21: 'Honda NSX Evo (2019)',
  22: 'McLaren 720S GT3 (2019)',
  23: 'Porsche 911II GT3 R (2019)',
  24: 'Ferrari 488 GT3 Evo 2020',
  25: 'Mercedes-AMG GT3 2020',
  26: 'Ferrari 488 Challenge Evo',
  27: 'BMW M2 CS Racing',
  28: 'Porsche 911 GT3 Cup (Type 992)',
  29: 'Lamborghini Huracán Super Trofeo EVO2',
  30: 'BMW M4 GT3',
  31: 'Audi R8 LMS GT3 evo II',
  32: 'Ferrari 296 GT3',
  33: 'Lamborghini Huracan Evo2',
  34: 'Porsche 992 GT3 R',
  35: 'McLaren 720S GT3 Evo 2023',
  36: 'Ford Mustang GT3',
  50: 'Alpine A110 GT4',
  51: 'AMR V8 Vantage GT4',
  52: 'Audi R8 LMS GT4',
  53: 'BMW M4 GT4',
  55: 'Chevrolet Camaro GT4',
  56: 'Ginetta G55 GT4',
  57: 'KTM X-Bow GT4',
  58: 'Maserati MC GT4',
  59: 'McLaren 570S GT4',
  60: 'Mercedes-AMG GT4',
  61: 'Porsche 718 Cayman GT4',
  80: 'Audi R8 LMS GT2',
  82: 'KTM XBOW GT2',
  83: 'Maserati MC20 GT2',
  84: 'Mercedes AMG GT2',
  85: 'Porsche 911 GT2 RS CS Evo',
  86: 'Porsche 935',
};

// Manufacturer icon name per car model, matching @cardog-icons/react's
// exported icon names exactly (e.g. 'PorscheIcon', 'MBIcon' for
// Mercedes-AMG, 'MclarenIcon' — lowercase 'c', matching the package's own
// naming). Confirmed against the package's actual type definitions, not
// guessed. Alpine, Ginetta, and KTM (the GT4-class niche manufacturers) have
// no icon in the package at all — omitted, same as an unmapped car model.
export const ACC_CAR_MANUFACTURER_ICON_NAMES: Readonly<Record<number, string>> = {
  0: 'PorscheIcon',
  1: 'MBIconDark',
  2: 'FerrariIconDark',
  3: 'AudiIconDark',
  4: 'LamborghiniIconDark',
  5: 'MclarenIconDark',
  6: 'NissanIconDark',
  7: 'BMWIcon',
  8: 'BentleyIconDark',
  9: 'PorscheIcon',
  10: 'NissanIconDark',
  11: 'BentleyIconDark',
  12: 'AstonMartinIconDark',
  13: 'LamborghiniIcon',
  14: 'JaguarIconDark',
  15: 'LexusIconDark',
  16: 'LamborghiniIcon',
  17: 'HondaIconDark',
  18: 'LamborghiniIcon',
  19: 'AudiIconDark',
  20: 'AstonMartinIconDark',
  21: 'HondaIconDark',
  22: 'MclarenIconDark',
  23: 'PorscheIcon',
  24: 'FerrariIconDark',
  25: 'MBIconDark',
  26: 'FerrariIconDark',
  27: 'BMWIcon',
  28: 'PorscheIcon',
  29: 'LamborghiniIcon',
  30: 'BMWIcon',
  31: 'AudiIconDark',
  32: 'FerrariIconDark',
  33: 'LamborghiniIcon',
  34: 'PorscheIcon',
  35: 'MclarenIconDark',
  36: 'FordIcon',
  // 50: Alpine — no icon available
  51: 'AstonMartinIcon',
  52: 'AudiIcon',
  53: 'BMWIcon',
  55: 'ChevroletIcon',
  // 56: Ginetta — no icon available
  // 57: KTM — no icon available
  58: 'MaseratiIcon',
  59: 'MclarenIcon',
  60: 'MBIcon',
  61: 'PorscheIcon',
  80: 'AudiIcon',
  // 82: KTM — no icon available
  83: 'MaseratiIcon',
  84: 'MBIcon',
  85: 'PorscheIcon',
  86: 'PorscheIcon',
};

export const ACC_CUP_CATEGORY_NAMES: Readonly<Record<number, string>> = {
  0: 'Overall',
  1: 'ProAm',
  2: 'Am',
  3: 'Silver',
  4: 'National',
};

// Returns null for an ID not in the handbook (e.g. a car added by a game
// update newer than the handbook revision this table was built from) rather
// than throwing — callers still have the raw numeric ID to fall back on.
export function accCarModelName(carModel: number): string | null {
  return ACC_CAR_MODEL_NAMES[carModel] ?? null;
}

export function accCupCategoryName(cupCategory: number): string | null {
  return ACC_CUP_CATEGORY_NAMES[cupCategory] ?? null;
}

// Returns null for an unmapped car model (including the 3 manufacturers with
// no icon in @cardog-icons/react) — callers should omit the icon rather than
// pass a bogus name to <Icon>. The returned string is a real @cardog-icons/react
// IconName, but kept as a plain string here so packages/domain doesn't take a
// React-ecosystem dependency; the app layer casts it when rendering.
export function accCarManufacturerIconName(carModel: number): string | null {
  return ACC_CAR_MANUFACTURER_ICON_NAMES[carModel] ?? null;
}

// CDN fallback for the manufacturers @cardog-icons/react has no icon for at
// all (Alpine, Ginetta, KTM — all GT4-class). Unlike the confirmed asset
// convention for splash art/track maps, these slugs are unconfirmed guesses
// — callers should render defensively (hide on load failure) rather than
// assume the URL resolves.
const MANUFACTURER_LOGO_BASE_URL =
  'https://static.simracingalliance.com/assets/images/logo/manufacturers/light';

export const ACC_CAR_MANUFACTURER_CDN_SLUGS: Readonly<Record<number, string>> = {
  50: 'alpine', // Alpine A110 GT4
  56: 'ginetta', // Ginetta G55 GT4
  57: 'ktm', // KTM X-Bow GT4
  82: 'ktm', // KTM XBOW GT2
};

export function accCarManufacturerLogoUrl(carModel: number): string | null {
  const slug = ACC_CAR_MANUFACTURER_CDN_SLUGS[carModel];
  return slug ? `${MANUFACTURER_LOGO_BASE_URL}/${slug}.png` : null;
}
