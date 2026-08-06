import { getHotLapBoardByLayoutKey } from './acevo-hotlaps';
import { supabase } from './supabase';
import type { TrackSummary, TrackTopEntry } from './track-summary';
import type { TrackWithTopTimes } from '@/components/TrackList';

export type LeaderboardTrack = {
  slug: string; // = layout_key; also the /[sim]/leaderboards/[track] route param
  layoutKey: string; // acevo_hotlap_cache_v2 key
  displayName: string; // e.g. "Kyalami", "COTA National"
  baseTrackKey: string; // tracks-table key for splash/country/location metadata
};

// Data-driven: every track_layouts row the ingest has written for this game —
// the AC Evo cron dual-writes one per track+layout it processes from Emperor
// (see dualWriteV2Cache in acevo-hotlaps.ts). So ANY track the server logs gets
// a board, not just those wired into a championship schedule (which is why
// Kyalami — run on the server but not in a championship — previously had no
// board despite having lap data).
export async function getLeaderboardTracks(game: string): Promise<LeaderboardTrack[]> {
  const { data, error } = await supabase
    .from('track_layouts')
    .select('layout_key, base_track_key, display_name')
    .eq('game', game)
    .order('display_name', { ascending: true });

  if (error) {
    console.error(`Leaderboard tracks lookup failed for "${game}":`, error);
    return [];
  }

  return (data ?? []).map((r) => ({
    slug: r.layout_key as string,
    layoutKey: r.layout_key as string,
    displayName: r.display_name as string,
    baseTrackKey: r.base_track_key as string,
  }));
}

export async function findLeaderboardTrack(
  game: string,
  slug: string,
): Promise<LeaderboardTrack | undefined> {
  return (await getLeaderboardTracks(game)).find((t) => t.slug === slug);
}

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
const ACEVO_MANUFACTURERS: ReadonlyArray<
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

function matchAcEvoManufacturer(carModel: string | null): { icon?: string; slug?: string } | null {
  if (!carModel) return null;
  for (const [pattern, entry] of ACEVO_MANUFACTURERS) {
    if (pattern.test(carModel)) return entry;
  }
  return null;
}

export function acEvoManufacturerIconName(carModel: string | null): string | null {
  return matchAcEvoManufacturer(carModel)?.icon ?? null;
}

// Public URL for a manufacturer's uploaded logo in the manufacturer-logos
// Supabase Storage bucket — our own hosting, since the old site's CDN (where
// ACC's equivalent fallback used to point) is gone. Returns null whenever an
// icon is available (icon takes priority) or the manufacturer has no slug
// mapped; callers should render defensively via FallbackLogoImage, since a
// mapped slug doesn't guarantee the file has actually been uploaded yet.
export function acEvoManufacturerLogoUrl(carModel: string | null): string | null {
  const entry = matchAcEvoManufacturer(carModel);
  if (!entry || entry.icon || !entry.slug) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/manufacturer-logos/${entry.slug}.svg`;
}

// Adapters into the sim-neutral shapes TrackList/TrackHeader consume.
export function toTrackTopEntry(entry: {
  rank: number;
  steamId: string;
  driverName: string;
  carModel: string | null;
  bestLap: string;
  driverNumber: number | null;
  country: string | null;
}): TrackTopEntry {
  return {
    rank: entry.rank,
    steamId: entry.steamId,
    driverName: entry.driverName,
    carLabel: entry.carModel,
    manufacturerIconName: acEvoManufacturerIconName(entry.carModel),
    manufacturerLogoUrl: acEvoManufacturerLogoUrl(entry.carModel),
    bestLap: entry.bestLap,
    driverNumber: entry.driverNumber,
    country: entry.country,
  };
}

// Enriches with real splash art / country / location from the shared tracks
// table (see supabase/migrations/20260722_shared_tracks_and_acevo_v2_cache.sql)
// — e.g. AC Evo racing at the same physical place ACC already has curated,
// Nurburgring. Falls back to nulls wherever nothing has been curated yet.
//
// mapUrl is intentionally always null here — track maps are an ACC-only
// feature for now (see lib/acc/tracks.ts's toTrackSummary for where it's
// actually populated).
export async function toTrackSummary(track: LeaderboardTrack): Promise<TrackSummary> {
  const { data, error } = await supabase
    .from('tracks')
    .select('splash_art_url, country, location')
    .eq('base_track_key', track.baseTrackKey)
    .maybeSingle();

  if (error) {
    console.error(`Track metadata lookup failed for "${track.baseTrackKey}":`, error);
  }

  return {
    trackKey: track.slug,
    displayName: track.displayName,
    splashArtUrl: data?.splash_art_url ?? null,
    country: data?.country ?? null,
    location: data?.location ?? null,
    mapUrl: null,
  };
}

// Used by the leaderboards list page — one getHotLapBoard call per track,
// just to preview the top N. The track detail page fetches the full board
// itself (needed for HotLapBoard anyway) and derives the fastest lap from
// that instead of calling this a second time.
export async function getLeaderboardTracksWithTopTimes(
  game: string,
  limit = 3,
): Promise<TrackWithTopTimes[]> {
  const tracks = await getLeaderboardTracks(game);
  return Promise.all(
    tracks.map(async (track) => {
      const [entries, summary] = await Promise.all([
        getHotLapBoardByLayoutKey(track.layoutKey),
        toTrackSummary(track),
      ]);
      return {
        ...summary,
        topTimes: entries.slice(0, limit).map(toTrackTopEntry),
      };
    }),
  );
}
