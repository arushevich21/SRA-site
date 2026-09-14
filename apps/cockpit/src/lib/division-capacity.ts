// Per-division driver counts for the register page's capacity strip.
//
// Counts DRIVERS, not entries. A GT3 Team Series entry is up to two drivers,
// and the number that matters operationally is how many cars/bodies a division
// has against the pit-box ceiling — not how many team rows exist.
//
// Pure, so it's unit-testable without the DB or React.

export type DivisionEntry = {
  divisionId: number | null;
  driverCount: number;
};

export type DivisionCapacityRow = {
  divisionId: number;
  divisionName: string;
  driverCount: number;
  /** The soft target, or null when the championship sets none. */
  cap: number | null;
  /** True once the division is at or past its target. Advisory only. */
  atCapacity: boolean;
};

/**
 * Rolls confirmed entries up into one row per division.
 *
 * Every division in `divisions` gets a row, including empty ones — "Division 4:
 * 0 drivers" is information (nobody has signed up yet), whereas omitting it
 * would read as though D4 isn't running.
 *
 * Entries with a null division are ignored: they can't be attributed to a
 * division, and silently folding them into one would misreport it. That case
 * shouldn't arise for a graded series — register_entry() raises
 * DIVISION_UNASSIGNED — but this must not invent a number if it does.
 */
export function buildDivisionCapacity(
  entries: DivisionEntry[],
  divisions: { id: number; name: string }[],
  cap: number | null,
): DivisionCapacityRow[] {
  const counts = new Map<number, number>();
  for (const e of entries) {
    if (e.divisionId == null) continue;
    counts.set(e.divisionId, (counts.get(e.divisionId) ?? 0) + e.driverCount);
  }

  return divisions.map((d) => {
    const driverCount = counts.get(d.id) ?? 0;
    return {
      divisionId: d.id,
      divisionName: d.name,
      driverCount,
      cap,
      // >= not >: at exactly the cap the division is full, which is the point
      // at which someone needs to see it, not one driver later.
      atCapacity: cap != null && driverCount >= cap,
    };
  });
}
