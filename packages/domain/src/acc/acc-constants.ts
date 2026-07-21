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

// Manufacturer slug per car model, for building manufacturer logo URLs (see
// accCarManufacturerLogoUrl below). Only 'bentley' has been confirmed against
// a real CDN URL — the rest follow the same lowercase-hyphenated convention
// as a best guess and may need correcting per-manufacturer if a logo 404s.
export const ACC_CAR_MANUFACTURER_SLUGS: Readonly<Record<number, string>> = {
  0: 'porsche',
  1: 'mercedes-amg',
  2: 'ferrari',
  3: 'audi',
  4: 'lamborghini',
  5: 'mclaren',
  6: 'nissan',
  7: 'bmw',
  8: 'bentley',
  9: 'porsche',
  10: 'nissan',
  11: 'bentley',
  12: 'aston-martin',
  13: 'lamborghini',
  14: 'jaguar',
  15: 'lexus',
  16: 'lamborghini',
  17: 'honda',
  18: 'lamborghini',
  19: 'audi',
  20: 'aston-martin',
  21: 'honda',
  22: 'mclaren',
  23: 'porsche',
  24: 'ferrari',
  25: 'mercedes-amg',
  26: 'ferrari',
  27: 'bmw',
  28: 'porsche',
  29: 'lamborghini',
  30: 'bmw',
  31: 'audi',
  32: 'ferrari',
  33: 'lamborghini',
  34: 'porsche',
  35: 'mclaren',
  36: 'ford',
  50: 'alpine',
  51: 'aston-martin',
  52: 'audi',
  53: 'bmw',
  55: 'chevrolet',
  56: 'ginetta',
  57: 'ktm',
  58: 'maserati',
  59: 'mclaren',
  60: 'mercedes-amg',
  61: 'porsche',
  80: 'audi',
  82: 'ktm',
  83: 'maserati',
  84: 'mercedes-amg',
  85: 'porsche',
  86: 'porsche',
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

const MANUFACTURER_LOGO_BASE_URL =
  'https://static.simracingalliance.com/assets/images/logo/manufacturers/light';

// Returns null for an unmapped car model — callers should omit the icon
// rather than request a URL that's guaranteed to 404.
export function accCarManufacturerLogoUrl(carModel: number): string | null {
  const slug = ACC_CAR_MANUFACTURER_SLUGS[carModel];
  return slug ? `${MANUFACTURER_LOGO_BASE_URL}/${slug}.png` : null;
}

const TRACK_MAP_BASE_URL = 'https://static.simracingalliance.com/assets/images/tracks';

// Unlike splash art (an explicit acc_tracks.splash_art_url column, curated
// per track), track maps follow a predictable naming convention off the same
// track_key already used everywhere else — no DB column needed. A track
// without a map file yet will just 404 until one's uploaded under this path.
export function accTrackMapUrl(trackKey: string): string {
  return `${TRACK_MAP_BASE_URL}/track_map_logo_${trackKey}.png`;
}
