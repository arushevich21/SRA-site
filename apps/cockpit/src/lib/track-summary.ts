// Sim-neutral shapes for the track-list cards and track-detail header,
// shared between ACC (Supabase-backed acc_tracks, numeric car IDs, car
// classes) and AC Evo (schedule-derived tracks, plain car-name strings, no
// classes). Each sim's own lib layer adapts its native types into these —
// the components never need to know which sim they're rendering for.

export type TrackSummary = {
  trackKey: string;
  displayName: string;
  splashArtUrl: string | null;
  country: string | null; // ISO 3166-1 alpha-2, e.g. 'de' — null where unknown/unset
  location: string | null; // human-readable "place, country" — null where unknown/unset
  mapUrl: string | null; // track_layouts.map_url — curated per (game, layout), null until set
};

export type TrackTopEntry = {
  rank: number;
  steamId: string;
  driverName: string;
  carLabel: string | null; // display text for the car (name, not an ID)
  manufacturerIconName: string | null; // an @cardog-icons/react IconName, pre-resolved by the caller
  manufacturerLogoUrl: string | null; // CDN fallback for manufacturers cardog-icons doesn't cover — null when manufacturerIconName is set
  bestLap: string;
  driverNumber: number | null; // the driver's registered SRA number, from drivers.driver_number — null if unregistered/unlinked
  country: string | null; // ISO 3166-1 alpha-2 nationality, from drivers.country — null if unset
};

// The outright-fastest entry across every class-group bucket, for the
// track-detail header's fastestLap. Each group already arrives sorted
// (fastest first), so this is just a min over each group's own leader —
// no separate query needed when the caller already fetched the full board.
export function outrightFastest<T extends { bestLapMs: number }>(
  byGroup: Record<string, T[]>,
): T | null {
  let best: T | null = null;
  for (const group of Object.values(byGroup)) {
    const first = group[0];
    if (first && (!best || first.bestLapMs < best.bestLapMs)) best = first;
  }
  return best;
}
