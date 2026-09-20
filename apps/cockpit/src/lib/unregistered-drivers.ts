// Per-division "who hasn't registered yet" for the register page.
//
// The roster is every driver with a division assigned (drivers.division_id) —
// that's the graded pool an admin has placed for the season. Anyone in it
// who holds no claim on the event (registration_drivers, confirmed OR
// waitlisted — a waitlisted driver has registered, they're just not in yet)
// is "still to register". Same claim set the teammate picker uses, so the
// two views can't disagree about who's spoken for.
//
// Pure, so it's unit-testable without the DB or React.

export type RosterDriver = {
  id: string;
  displayName: string | null;
  divisionId: number | null;
  tier: 'gold' | 'silver' | null;
  isSralien: boolean;
};

export type UnregisteredDivisionRow = {
  divisionId: number;
  divisionName: string;
  /** Drivers assigned to this division. */
  rosterCount: number;
  /** Roster drivers who hold a claim on the event. */
  registeredCount: number;
  /** Roster drivers with no claim, A→Z by name. */
  unregistered: RosterDriver[];
};

export function buildUnregisteredByDivision(
  roster: RosterDriver[],
  claimedDriverIds: Set<string>,
  divisions: { id: number; name: string }[],
): UnregisteredDivisionRow[] {
  const byDivision = new Map<number, RosterDriver[]>();
  for (const d of roster) {
    if (d.divisionId == null) continue;
    (byDivision.get(d.divisionId) ?? byDivision.set(d.divisionId, []).get(d.divisionId)!).push(d);
  }

  return divisions.map((div) => {
    const members = byDivision.get(div.id) ?? [];
    const unregistered = members
      .filter((d) => !claimedDriverIds.has(d.id))
      .sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? '', undefined, { sensitivity: 'base' }));
    return {
      divisionId: div.id,
      divisionName: div.name,
      rosterCount: members.length,
      registeredCount: members.length - unregistered.length,
      unregistered,
    };
  });
}
