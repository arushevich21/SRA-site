import type { CalendarEventRow } from '../calendar-events-store.js';

// Monday practice races. Two ACCSM Custom Races run at once: SRAM1 hosts
// Divisions 1 & 2, SRAM2 hosts Divisions 3 & 4. Neither belongs to a
// championship round, so nothing in the round-matching pipeline
// (lib/acc/round-match.ts) links them; the only way in is the "R<N> Practice
// Race" calendar_events row, which /calendar turns into a link to
// /acc/practice-race/<event id> (see practiceRaceHref). That page lets the
// driver pick which of the two grids they were on, then shows the usual
// results tabs. Pure lookups only (unit-tested); the acc_race_sessions query
// is in practice-race-store.ts.

export type PracticeRaceGroup = {
  // URL segment.
  key: 'd1-d2' | 'd3-d4';
  label: string;
  divisionIds: number[];
  // The ACCSM server slot the grid runs on, as tagged in the server name
  // ("… | SRAM1 | cBOP").
  server: 'SRAM1' | 'SRAM2';
};

export const PRACTICE_RACE_GROUPS: PracticeRaceGroup[] = [
  { key: 'd1-d2', label: 'D1/D2', divisionIds: [1, 2], server: 'SRAM1' },
  { key: 'd3-d4', label: 'D3/D4', divisionIds: [3, 4], server: 'SRAM2' },
];

export function practiceRaceGroup(key: string): PracticeRaceGroup | null {
  return PRACTICE_RACE_GROUPS.find((g) => g.key === key) ?? null;
}

const PRACTICE_RACE_TITLE = /\bpractice\s+race\b/i;

// True for the calendar rows this feature owns: an ACC entry titled like
// "R1 Practice Race".
export function isPracticeRaceEvent(event: Pick<CalendarEventRow, 'title' | 'game'>): boolean {
  return event.game === 'ACC' && PRACTICE_RACE_TITLE.test(event.title);
}

// The link a practice-race calendar entry gets when the admin hasn't set an
// explicit href. Null for any other entry.
export function practiceRaceHref(event: Pick<CalendarEventRow, 'id' | 'title' | 'game' | 'href'>): string | null {
  if (event.href || !isPracticeRaceEvent(event)) return null;
  return `/acc/practice-race/${event.id}`;
}

// Which ACCSM grid a server name belongs to: the SRAM slot tag is the fixed
// part of the name; the "Locked: D1 D2" segment is the human label and only
// consulted if the slot tag is ever missing.
export function groupForServer(serverName: string | null): PracticeRaceGroup | null {
  if (!serverName) return null;
  const parts = serverName.split('|').map((p) => p.trim().toUpperCase());
  const bySlot = PRACTICE_RACE_GROUPS.find((g) => parts.includes(g.server));
  if (bySlot) return bySlot;
  const flat = parts.join(' ');
  return (
    PRACTICE_RACE_GROUPS.find((g) => g.divisionIds.every((d) => new RegExp(`\\bD${d}\\b`).test(flat))) ?? null
  );
}
