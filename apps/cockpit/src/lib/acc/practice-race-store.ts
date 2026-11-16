import { supabase } from '@/lib/supabase';
import { eventWallClockMs } from '@/lib/event-time';
import type { CalendarEventRow } from '@/lib/calendar-events-store';
import { groupForServer, type PracticeRaceGroup } from './practice-race';

// The acc_race_sessions side of the Monday practice races — which two Custom
// Race events ran for a given calendar entry. Grid rules live in
// practice-race.ts.

// How far either side of the calendar's 9 PM start a session may fall and
// still be that night's practice race, in wall-clock terms (session dates are
// stamped when the session ENDS). Practice/qualifying wrap up around and
// after the start; the race result lands ~1.5 hours after. One hour back is
// enough. Further back starts catching unrelated earlier sessions on the same
// server, and the earliest match per grid wins.
const BEFORE_MS = 1 * 60 * 60 * 1000;
const AFTER_MS = 6 * 60 * 60 * 1000;

// Only the practice-race servers — the free-practice servers running the same
// night on SRAM2/SRAM3 carry "GT3_FreePractice" instead.
const SERVER_TAG = 'PracticeRace';

export type PracticeRaceEvent = {
  group: PracticeRaceGroup;
  eventKey: string;
  track: string;
  date: string;
};

type Row = { event_key: string; track_key: string; server_name: string | null; session_date: string };

// The practice-race events run for one calendar entry, keyed by grid. A grid
// whose result hasn't been ingested yet is simply absent.
export async function getPracticeRaceEvents(
  event: Pick<CalendarEventRow, 'eventDate'>,
): Promise<Map<PracticeRaceGroup['key'], PracticeRaceEvent>> {
  // Wall-clock on both sides — session_date is ACCSM's Eastern wall-clock
  // stamped as UTC. Comparing it to the real instant missed every practice
  // race after DST ended (the 9 PM start moved to 02:00Z, five hours past
  // the 22:12Z-stamped result, outside BEFORE_MS). See eventWallClockMs.
  const start = eventWallClockMs(event.eventDate);
  const { data, error } = await supabase
    .from('acc_race_sessions')
    .select('event_key, track_key, server_name, session_date')
    .ilike('server_name', `%${SERVER_TAG}%`)
    .gte('session_date', new Date(start - BEFORE_MS).toISOString())
    .lte('session_date', new Date(start + AFTER_MS).toISOString())
    .order('session_date', { ascending: true });
  if (error) throw error;

  const found = new Map<PracticeRaceGroup['key'], PracticeRaceEvent>();
  for (const row of (data ?? []) as Row[]) {
    const group = groupForServer(row.server_name);
    if (!group || found.has(group.key)) continue;
    found.set(group.key, { group, eventKey: row.event_key, track: row.track_key, date: row.session_date });
  }
  return found;
}
