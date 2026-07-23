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
};
