import type { ScheduleRound } from '@/content/championships';
import Image from 'next/image';
import { OverlayHeader, OverlayPanel } from './OverlayPrimitives';

const TRACK_MAP_ALIASES: Record<string, string> = {
  'circuit of the americas': 'cota',
  'nordschleife': 'nurburgring',
  'nurburgring 24h': 'nurburgring',
};
const TRACK_MAP_KEYS = new Set([
  'barcelona', 'brands_hatch', 'cota', 'donington', 'hungaroring', 'imola',
  'indianapolis', 'kyalami', 'laguna_seca', 'misano', 'monza', 'mount_panorama',
  'nurburgring', 'oulton_park', 'paul_ricard', 'red_bull_ring', 'silverstone',
  'snetterton', 'spa', 'suzuka', 'valencia', 'watkins_glen', 'zandvoort', 'zolder',
]);

const TRACK_DETAILS: Record<string, { location: string; length: string; turns: string }> = {
  barcelona: { location: 'Barcelona, Spain', length: '4.657 km', turns: '16 turns' },
  brands_hatch: { location: 'Kent, United Kingdom', length: '3.908 km', turns: '9 turns' },
  cota: { location: 'Austin, Texas, USA', length: '5.513 km', turns: '20 turns' },
  donington: { location: 'Leicestershire, United Kingdom', length: '4.020 km', turns: '12 turns' },
  hungaroring: { location: 'Mogyoród, Hungary', length: '4.381 km', turns: '14 turns' },
  imola: { location: 'Imola, Italy', length: '4.909 km', turns: '19 turns' },
  indianapolis: { location: 'Indianapolis, Indiana, USA', length: '3.925 km', turns: '14 turns' },
  kyalami: { location: 'Midrand, South Africa', length: '4.522 km', turns: '16 turns' },
  laguna_seca: { location: 'Monterey, California, USA', length: '3.602 km', turns: '11 turns' },
  misano: { location: 'Misano Adriatico, Italy', length: '4.226 km', turns: '16 turns' },
  monza: { location: 'Monza, Italy', length: '5.793 km', turns: '11 turns' },
  mount_panorama: { location: 'Bathurst, Australia', length: '6.213 km', turns: '23 turns' },
  nurburgring: { location: 'Nürburg, Germany', length: '5.148 km', turns: '16 turns' },
  oulton_park: { location: 'Cheshire, United Kingdom', length: '4.332 km', turns: '17 turns' },
  paul_ricard: { location: 'Le Castellet, France', length: '5.842 km', turns: '15 turns' },
  red_bull_ring: { location: 'Spielberg, Austria', length: '4.318 km', turns: '10 turns' },
  silverstone: { location: 'Northamptonshire, United Kingdom', length: '5.891 km', turns: '18 turns' },
  snetterton: { location: 'Norfolk, United Kingdom', length: '4.778 km', turns: '12 turns' },
  spa: { location: 'Stavelot, Belgium', length: '7.004 km', turns: '19 turns' },
  suzuka: { location: 'Suzuka, Japan', length: '5.807 km', turns: '18 turns' },
  valencia: { location: 'Cheste, Spain', length: '4.005 km', turns: '14 turns' },
  watkins_glen: { location: 'New York, USA', length: '3.450 km', turns: '11 turns' },
  zandvoort: { location: 'Zandvoort, Netherlands', length: '4.259 km', turns: '14 turns' },
  zolder: { location: 'Heusden-Zolder, Belgium', length: '4.011 km', turns: '10 turns' },
};

export function trackMapUrl(track: string): string | null {
  const key = trackMapKey(track);
  return TRACK_MAP_KEYS.has(key) ? `/tracks/maps/map_${key}.png` : null;
}

function trackMapKey(track: string): string {
  const normalized = track.toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ');
  return TRACK_MAP_ALIASES[normalized] ?? normalized.replaceAll(' ', '_');
}

export function TrackOverlay({ track, round }: { track: string; round?: ScheduleRound }) {
  const mapSrc = trackMapUrl(track);
  const mapKey = trackMapKey(track);
  const details = TRACK_DETAILS[mapKey];
  return <><OverlayHeader title="TRACK MAP" subtitle="Sim Racing Alliance" /><div className="stream-track-layout"><OverlayPanel className="stream-track-map">{mapSrc ? <Image className="stream-track-map-image" src={mapSrc} alt={`${track} circuit map`} width={1200} height={800} unoptimized /> : <span className="stream-map-placeholder">{track.toUpperCase()}<br /><small>TRACK MAP</small></span>}</OverlayPanel><OverlayPanel className="stream-track-facts"><Fact label="Track" value={track} /><Fact label="Location" value={details?.location ?? 'Location pending'} /><Fact label="Length" value={details?.length ?? 'Track data pending'} /><Fact label="Turns" value={details?.turns ?? 'Track data pending'} /><Fact label="Round" value={round ? `Round ${round.round}` : 'TBA'} /></OverlayPanel></div></>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div><b>{label}:</b><strong>{value}</strong></div>; }
