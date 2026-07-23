// Per-game pick lists that drive the Manage Events form dropdowns. Selecting a
// game narrows tracks / cars / class + format tags to that sim. This is a
// static catalog on purpose: the DB `track_layouts` table only holds tracks
// that have actually been raced (far short of a full roster), so it can't back
// a picker. Every dropdown that uses this also keeps a free-text "Custom…"
// escape hatch, so an entry missing here never blocks an admin.
//
// AC Evo track entries carry emperorTrack ("Name,Layout") + emperorRawTrackName
// ("Name") because those drive its hot-lap cache lookups (buildTrackKey /
// parseEmperorTrackLayout in acevo-hotlaps.ts). ACC leaderboards key off
// track_layouts directly, so ACC entries need only a display name — the ACSM
// round fields stay blank + editable for ACC. LMU/iRacing results come from
// SimGrid, so no Emperor identifiers apply.

export type CatalogTrack = {
  displayName: string; // written into round.track and shown in the list
  emperorTrack?: string; // AC Evo only — "TrackName,Layout"
  emperorRawTrackName?: string; // AC Evo only — raw track name
  accTrackKey?: string; // ACC only — acc_hotlap_leaderboard.track_key (bop-style key)
};

// Resolve a round's display track name back to its ACC hot-lap track_key.
export function accTrackKeyForDisplay(displayName: string): string | null {
  const t = SIM_CATALOG.ACC.tracks.find((ct) => ct.displayName === displayName);
  return t?.accTrackKey ?? null;
}

export type GameCatalog = {
  tracks: CatalogTrack[];
  cars: string[];
  classTags: string[];
  formatTags: string[];
  classes: string[];
  raceLengths: string[];
};

// Shared across games — race formats and durations aren't sim-specific.
const FORMAT_TAGS = ['Sprint', 'Endurance', 'Multiclass', 'Cup', 'Feature', 'Exhibition'];
const RACE_LENGTHS = [
  '20 min', '30 min', '45 min', '60 min', '75 min', '90 min',
  '2h', '4h', '6h', '8h', '9h', '12h', '24h',
];

// ── ACC ───────────────────────────────────────────────────────────────────────
// accTrackKey values are the bop-style ACC track keys (= acc_hotlap_leaderboard
// track_key / track_layouts layout_key), so the Seasonal board can pull a
// round's hot-lap data straight from its picked track.
const ACC_TRACKS: CatalogTrack[] = [
  { displayName: 'Barcelona', accTrackKey: 'barcelona' },
  { displayName: 'Brands Hatch', accTrackKey: 'brands_hatch' },
  { displayName: 'Circuit of the Americas', accTrackKey: 'cota' },
  { displayName: 'Donington Park', accTrackKey: 'donington' },
  { displayName: 'Hungaroring', accTrackKey: 'hungaroring' },
  { displayName: 'Imola', accTrackKey: 'imola' },
  { displayName: 'Indianapolis', accTrackKey: 'indianapolis' },
  { displayName: 'Kyalami', accTrackKey: 'kyalami' },
  { displayName: 'Laguna Seca', accTrackKey: 'laguna_seca' },
  { displayName: 'Misano', accTrackKey: 'misano' },
  { displayName: 'Monza', accTrackKey: 'monza' },
  { displayName: 'Mount Panorama', accTrackKey: 'mount_panorama' },
  { displayName: 'Nürburgring GP', accTrackKey: 'nurburgring' },
  { displayName: 'Nürburgring 24H', accTrackKey: 'nurburgring_24h' },
  { displayName: 'Oulton Park', accTrackKey: 'oulton_park' },
  { displayName: 'Paul Ricard', accTrackKey: 'paul_ricard' },
  { displayName: 'Red Bull Ring', accTrackKey: 'red_bull_ring' },
  { displayName: 'Silverstone', accTrackKey: 'silverstone' },
  { displayName: 'Snetterton', accTrackKey: 'snetterton' },
  { displayName: 'Spa-Francorchamps', accTrackKey: 'spa' },
  { displayName: 'Suzuka', accTrackKey: 'suzuka' },
  { displayName: 'Valencia', accTrackKey: 'valencia' },
  { displayName: 'Watkins Glen', accTrackKey: 'watkins_glen' },
  { displayName: 'Zandvoort', accTrackKey: 'zandvoort' },
  { displayName: 'Zolder', accTrackKey: 'zolder' },
];

// The GT3 field — mirrors the SRA GT3 Team Series allowed-cars list.
const ACC_GT3_CARS = [
  'AMR V12 Vantage GT3',
  'AMR V8 Vantage GT3',
  'Audi R8 LMS GT3 Evo 2',
  'Bentley Continental GT3',
  'BMW M4 GT3',
  'BMW M6 GT3',
  'Emil Frey Jaguar G3',
  'Ferrari 296 GT3',
  'Ferrari 488 GT3 Evo',
  'Ford Mustang GT3',
  'Honda NSX GT3 Evo',
  'Lamborghini Huracán GT3 EVO2',
  'Lexus RC F GT3',
  'McLaren 650S GT3',
  'McLaren 720S GT3',
  'McLaren 720S GT3 Evo',
  'Mercedes-AMG GT3 EVO',
  'Nissan GT-R Nismo GT3',
  'Porsche 991 II GT3 R',
  'Porsche 992 GT3 R',
  'Reiter Engineering R-EX GT3',
];

// ── LMU ───────────────────────────────────────────────────────────────────────
const LMU_TRACKS: CatalogTrack[] = [
  { displayName: 'Algarve' },
  { displayName: 'Bahrain' },
  { displayName: 'Barcelona' },
  { displayName: 'COTA' },
  { displayName: 'Fuji' },
  { displayName: 'Fuji Classic' },
  { displayName: 'Imola' },
  { displayName: 'Interlagos' },
  { displayName: 'Le Mans' },
  { displayName: 'Lusail' },
  { displayName: 'Monza' },
  { displayName: 'Portimão' },
  { displayName: 'Qatar' },
  { displayName: 'Sebring' },
  { displayName: 'Silverstone' },
  { displayName: 'Spa-Francorchamps' },
];

const LMU_CARS = [
  // Hypercar
  'Ferrari 499P',
  'Toyota GR010 Hybrid',
  'Porsche 963',
  'Cadillac V-Series.R',
  'BMW M Hybrid V8',
  'Peugeot 9X8',
  'Alpine A424',
  'Lamborghini SC63',
  'Aston Martin Valkyrie',
  'Isotta Fraschini Tipo 6',
  // LMP2
  'Oreca 07 LMP2',
  // LMGT3
  'Aston Martin Vantage AMR LMGT3',
  'BMW M4 LMGT3',
  'Chevrolet Corvette Z06 LMGT3.R',
  'Ferrari 296 LMGT3',
  'Ford Mustang LMGT3',
  'Lamborghini Huracán LMGT3 Evo2',
  'Lexus RC F LMGT3',
  'McLaren 720S LMGT3 Evo',
  'Porsche 911 GT3 R LMGT3',
];

// ── AC Evo ────────────────────────────────────────────────────────────────────
// Only tracks with a verified Emperor identifier are seeded (wrong Name,Layout
// strings would silently break hot-lap lookups). Others go through Custom.
const ACEVO_TRACKS: CatalogTrack[] = [
  { displayName: 'COTA National', emperorTrack: 'Circuit Of The Americas,National', emperorRawTrackName: 'Circuit Of The Americas' },
  { displayName: 'Kyalami', emperorRawTrackName: 'Kyalami' },
  { displayName: 'Laguna Seca', emperorRawTrackName: 'Laguna Seca' },
  { displayName: 'Road Atlanta GP', emperorTrack: 'Road Atlanta,GP', emperorRawTrackName: 'Road Atlanta' },
  { displayName: 'Sebring International Raceway GP', emperorTrack: 'Sebring International Raceway,GP', emperorRawTrackName: 'Sebring International Raceway' },
];

const ACEVO_CARS = ['Mazda MX-5 (ND)'];

// ── Registry ──────────────────────────────────────────────────────────────────
export const SIM_CATALOG: Record<string, GameCatalog> = {
  ACC: {
    tracks: ACC_TRACKS,
    cars: ACC_GT3_CARS,
    classTags: ['GT3', 'GT4', 'GT2', 'GTC', 'TCX'],
    formatTags: FORMAT_TAGS,
    classes: ['GT3', 'GT4', 'GT2'],
    raceLengths: RACE_LENGTHS,
  },
  LMU: {
    tracks: LMU_TRACKS,
    cars: LMU_CARS,
    classTags: ['Hypercar', 'LMP2', 'LMGT3', 'LMP2 / LMGT3', 'Hypercar / LMGT3'],
    formatTags: FORMAT_TAGS,
    classes: ['Hypercar', 'LMP2', 'LMGT3'],
    raceLengths: RACE_LENGTHS,
  },
  'AC Evo': {
    tracks: ACEVO_TRACKS,
    cars: ACEVO_CARS,
    classTags: ['GT3', 'MX-5', 'GT4', 'GT2'],
    formatTags: FORMAT_TAGS,
    classes: ['GT3', 'MX-5', 'GT4'],
    raceLengths: RACE_LENGTHS,
  },
};

const EMPTY_CATALOG: GameCatalog = {
  tracks: [],
  cars: [],
  classTags: [],
  formatTags: FORMAT_TAGS,
  classes: [],
  raceLengths: RACE_LENGTHS,
};

// Never throws — an unknown/unseeded game (e.g. iRacing) yields the shared
// fallback so every field still renders, backed by its Custom escape hatch.
export function getGameCatalog(game: string): GameCatalog {
  return SIM_CATALOG[game] ?? EMPTY_CATALOG;
}
