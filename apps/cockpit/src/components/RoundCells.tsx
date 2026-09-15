import type { RoundEvent } from '@sra/domain';

// Shared between the driver and team standings tables so a round reads the
// same in both: R-number over the track, podium colours, dropped styling.

// P1 gold (the brand gold), P2 silver, P3 bronze. Index = finishing
// position / round rank; only 1–3 are keys.
export const PODIUM_CLASS: Record<number, string> = {
  1: 'text-gold',
  2: 'text-[#c0c8d4]',
  3: 'text-[#cd7f4f]',
};

// Short forms for the round header, where a column is ~90px wide. Keyed on
// the normalized schedule/track name so either the schedule's wording or a
// prettified track_key resolves. Anything not listed shows as written.
const SHORT_TRACK_NAMES: Readonly<Record<string, string>> = {
  circuitoftheamericas: 'COTA',
  cota: 'COTA',
  mountpanorama: 'Mount Panorama',
  mountpanoramacircuit: 'Mount Panorama',
  nurburgring: 'Nürburgring',
  nurburgring24h: 'Nürburgring 24h',
  spafrancorchamps: 'Spa',
  spa: 'Spa',
  paulricard: 'Paul Ricard',
  brandshatch: 'Brands Hatch',
  watkinsglen: 'Watkins Glen',
  indianapolis: 'Indy',
  redbullring: 'Red Bull Ring',
  hungaroring: 'Hungaroring',
  laguna: 'Laguna Seca',
  lagunaseca: 'Laguna Seca',
  silverstone: 'Silverstone',
  kyalami: 'Kyalami',
  suzuka: 'Suzuka',
  valencia: 'Valencia',
  donington: 'Donington',
  oulton: 'Oulton Park',
  oultonpark: 'Oulton Park',
  snetterton: 'Snetterton',
  imola: 'Imola',
  monza: 'Monza',
  misano: 'Misano',
  zolder: 'Zolder',
  zandvoort: 'Zandvoort',
  barcelona: 'Barcelona',
};

export function shortTrackName(name: string): string {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SHORT_TRACK_NAMES[key] ?? name;
}

export function RoundHeaders({ rounds }: { rounds: RoundEvent[] }) {
  return (
    <>
      {rounds.map((r) => (
        <th
          key={r.eventId}
          title={r.track}
          className="font-mono text-[15px] tracking-[.15em] uppercase text-txt-3 py-2 pl-5 w-20 text-center hidden sm:table-cell"
        >
          R{r.round}
          <span className="block font-mono text-[10px] tracking-[.1em] normal-case text-txt-3/70 mt-0.5 truncate max-w-[88px] mx-auto">
            {shortTrackName(r.track)}
          </span>
        </th>
      ))}
    </>
  );
}
