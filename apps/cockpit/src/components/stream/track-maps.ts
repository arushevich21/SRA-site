// Track map artwork (public/tracks/maps — the 24 ACC circuits, re-hosted from
// the old static CDN, see lib/acc/tracks.ts) and the circuit facts the track
// scene shows. Pure lookups keyed on the schedule's human track name.

const TRACK_ALIASES: Record<string, string> = {
  'circuit of the americas': 'cota',
  nordschleife: 'nurburgring',
  'nurburgring 24h': 'nurburgring',
  nürburgring: 'nurburgring',
  'spa francorchamps': 'spa',
  'laguna': 'laguna_seca',
  indy: 'indianapolis',
  'brands hatch gp': 'brands_hatch',
};

export type TrackFacts = { location: string; country: string; length: string; turns: number };

export const TRACK_FACTS: Record<string, TrackFacts> = {
  barcelona: { location: 'Barcelona, Spain', country: 'es', length: '4.657 km', turns: 16 },
  brands_hatch: { location: 'Kent, United Kingdom', country: 'gb', length: '3.908 km', turns: 9 },
  cota: { location: 'Austin, Texas, USA', country: 'us', length: '5.513 km', turns: 20 },
  donington: { location: 'Leicestershire, United Kingdom', country: 'gb', length: '4.020 km', turns: 12 },
  hungaroring: { location: 'Mogyoród, Hungary', country: 'hu', length: '4.381 km', turns: 14 },
  imola: { location: 'Imola, Italy', country: 'it', length: '4.909 km', turns: 19 },
  indianapolis: { location: 'Indianapolis, Indiana, USA', country: 'us', length: '3.925 km', turns: 14 },
  kyalami: { location: 'Midrand, South Africa', country: 'za', length: '4.522 km', turns: 16 },
  laguna_seca: { location: 'Monterey, California, USA', country: 'us', length: '3.602 km', turns: 11 },
  misano: { location: 'Misano Adriatico, Italy', country: 'it', length: '4.226 km', turns: 16 },
  monza: { location: 'Monza, Italy', country: 'it', length: '5.793 km', turns: 11 },
  mount_panorama: { location: 'Bathurst, Australia', country: 'au', length: '6.213 km', turns: 23 },
  nurburgring: { location: 'Nürburg, Germany', country: 'de', length: '5.148 km', turns: 16 },
  oulton_park: { location: 'Cheshire, United Kingdom', country: 'gb', length: '4.332 km', turns: 17 },
  paul_ricard: { location: 'Le Castellet, France', country: 'fr', length: '5.842 km', turns: 15 },
  red_bull_ring: { location: 'Spielberg, Austria', country: 'at', length: '4.318 km', turns: 10 },
  silverstone: { location: 'Northamptonshire, United Kingdom', country: 'gb', length: '5.891 km', turns: 18 },
  snetterton: { location: 'Norfolk, United Kingdom', country: 'gb', length: '4.778 km', turns: 12 },
  spa: { location: 'Stavelot, Belgium', country: 'be', length: '7.004 km', turns: 19 },
  suzuka: { location: 'Suzuka, Japan', country: 'jp', length: '5.807 km', turns: 18 },
  valencia: { location: 'Cheste, Spain', country: 'es', length: '4.005 km', turns: 14 },
  watkins_glen: { location: 'New York, USA', country: 'us', length: '5.552 km', turns: 11 },
  zandvoort: { location: 'Zandvoort, Netherlands', country: 'nl', length: '4.259 km', turns: 14 },
  zolder: { location: 'Heusden-Zolder, Belgium', country: 'be', length: '4.011 km', turns: 10 },
};

export function trackMapKey(track: string): string {
  const normalized = track.toLowerCase().trim().replace(/[^a-z0-9ü]+/g, ' ').trim();
  return TRACK_ALIASES[normalized] ?? normalized.replaceAll(' ', '_');
}

export function trackMapUrl(track: string): string | null {
  const key = trackMapKey(track);
  return key in TRACK_FACTS ? `/tracks/maps/map_${key}.png` : null;
}

export function trackFacts(track: string): TrackFacts | null {
  return TRACK_FACTS[trackMapKey(track)] ?? null;
}

export function isTbaTrack(track: string): boolean {
  return /^\s*(tba|tbd|tbc)\s*$/i.test(track) || track.trim() === '';
}
