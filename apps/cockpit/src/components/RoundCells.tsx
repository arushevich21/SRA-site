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
            {r.track}
          </span>
        </th>
      ))}
    </>
  );
}
