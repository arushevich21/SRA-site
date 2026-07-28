import { HOT_LAP_TIMES, HOT_STINT_TIMES, type LapTimeEntry } from '@/content/reference-lap-times';

// Reference-time tiers, fastest to slowest. 'alien' = at/under the outright
// reference time; 'div1'..'div4' = at/under that division's threshold but not
// the tier above it. div4 is a catch-all floor — a lap slower than the div4
// threshold still tags as 'div4' rather than getting no tier at all.
export type LapTier = 'alien' | 'div1' | 'div2' | 'div3' | 'div4';

export const LAP_TIER_BADGE: Record<LapTier, { src: string; label: string }> = {
  alien: { src: '/badges/Alien.png', label: 'Alien pace' },
  div1: { src: '/badges/Division 1.png', label: 'Division 1 pace' },
  div2: { src: '/badges/Division 2.png', label: 'Division 2 pace' },
  div3: { src: '/badges/Division 3.png', label: 'Division 3 pace' },
  div4: { src: '/badges/Division 4.png', label: 'Division 4 pace' },
};

const TIER_FIELDS: ReadonlyArray<readonly [LapTier, keyof LapTimeEntry]> = [
  ['alien', 'reference'],
  ['div1', 'div1'],
  ['div2', 'div2'],
  ['div3', 'div3'],
  ['div4', 'div4'],
];

// track_key -> reference-lap-times.ts's `track` field, for the tracks whose
// naming doesn't survive a simple "replace _ with space" normalization
// (everything else matches after normalizeTrackName below).
const TRACK_NAME_ALIASES: Readonly<Record<string, string>> = {
  cota: 'Circuit of The Americas',
  donington: 'Donington Park',
  spa: 'Spa Francorchamps',
};

function normalizeTrackName(s: string): string {
  // Strip diacritics (e.g. "Nürburgring" -> "Nurburgring") before dropping
  // non-alphanumerics, or the ü (not in [a-z0-9]) would vanish instead of
  // folding to a plain "u" and the match would silently fail.
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function findReferenceEntry(table: LapTimeEntry[], trackKey: string): LapTimeEntry | null {
  const target = normalizeTrackName(TRACK_NAME_ALIASES[trackKey] ?? trackKey.replace(/_/g, ' '));
  return table.find((e) => normalizeTrackName(e.track) === target) ?? null;
}

// "M:SS.mmm" (or longer, e.g. "8:10.000") -> milliseconds.
function parseLapTimeMs(t: string): number {
  const m = /^(\d+):(\d{2})\.(\d{3})$/.exec(t);
  if (!m) return Infinity;
  return (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) * 1000 + parseInt(m[3], 10);
}

// Classifies a GT3, dry-conditions lap/stint time against the curated
// reference times (content/reference-lap-times.ts — the same data
// /about/reference-lap-times already renders). Reference times are GT3-only
// and dry-only, so callers must gate on carGroup === 'GT3' && !isWet
// themselves — this returns null for it implicitly (no reference table would
// sensibly apply to a wet lap), but the gate belongs at the call site so it's
// explicit rather than silently inferred here.
export function classifyLapTier(
  bestTimeMs: number,
  trackKey: string,
  variant: 'lap' | 'stint',
): LapTier | null {
  const entry = findReferenceEntry(variant === 'lap' ? HOT_LAP_TIMES : HOT_STINT_TIMES, trackKey);
  if (!entry) return null;

  for (const [tier, field] of TIER_FIELDS) {
    if (bestTimeMs <= parseLapTimeMs(entry[field])) return tier;
  }
  // Slower than every threshold, including div4 — div4 is the floor tier, so
  // it still applies rather than leaving the lap unclassified.
  return 'div4';
}

export type ReferenceLegendEntry = { tier: LapTier; time: string };

// The full cutoff legend for a track/variant — one row per tier, in
// fastest-to-slowest order — for the "here's what each tag means" strip
// shown above the board (next to Unique Drivers / My Laps). Null when this
// track has no curated reference data at all (e.g. an AC Evo track, or an
// ACC track/layout — like the Nürburgring 24h layout — not covered by the
// GT3 reference sheet).
export function getReferenceLegend(
  trackKey: string,
  variant: 'lap' | 'stint',
): ReferenceLegendEntry[] | null {
  const entry = findReferenceEntry(variant === 'lap' ? HOT_LAP_TIMES : HOT_STINT_TIMES, trackKey);
  if (!entry) return null;
  return TIER_FIELDS.map(([tier, field]) => ({ tier, time: entry[field] }));
}
