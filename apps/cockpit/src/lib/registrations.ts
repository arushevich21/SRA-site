import 'server-only';
import { supabase } from './supabase';

export type RegistrationStatus = 'confirmed' | 'waitlisted';

export type WaitlistedRegistration = {
  id: string;
  waitlistPosition: number;
  teamName: string | null;
  raceNumber: number | null;
  entryClass: string | null;
};

export type EventRegistrationSummary = {
  confirmedCount: number;
  maxRegistrations: number | null;
  waitlisted: WaitlistedRegistration[];
};

type WaitlistRow = {
  id: string;
  waitlist_position: number | null;
  race_number: number | null;
  entry_class: string | null;
  teams: { name: string } | { name: string }[] | null;
};

// Confirmed count + waitlist for one event (registrations.championship_key +
// season — see supabase/migrations/20260811b_registrations_waitlist.sql).
// `maxRegistrations` is passed in rather than re-queried here since the
// caller (the event admin page) already has the championships row.
export async function getEventRegistrationSummary(
  championshipKey: string,
  season: string,
  maxRegistrations: number | null,
): Promise<EventRegistrationSummary> {
  const [confirmed, waitlist] = await Promise.all([
    supabase
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('championship_key', championshipKey)
      .eq('season', season)
      .eq('status', 'confirmed'),
    supabase
      .from('registrations')
      .select('id, waitlist_position, race_number, entry_class, teams(name)')
      .eq('championship_key', championshipKey)
      .eq('season', season)
      .eq('status', 'waitlisted')
      .order('waitlist_position', { ascending: true }),
  ]);

  if (confirmed.error) throw new Error(confirmed.error.message);
  if (waitlist.error) throw new Error(waitlist.error.message);

  const rows = (waitlist.data ?? []) as WaitlistRow[];

  return {
    confirmedCount: confirmed.count ?? 0,
    maxRegistrations,
    waitlisted: rows.map((r) => ({
      id: r.id,
      // NOT NULL by registrations_waitlist_position_check for any row with
      // status='waitlisted' — the `!` reflects that DB-enforced invariant.
      waitlistPosition: r.waitlist_position!,
      teamName: (Array.isArray(r.teams) ? r.teams[0] : r.teams)?.name ?? null,
      raceNumber: r.race_number,
      entryClass: r.entry_class,
    })),
  };
}

export type RegistrationDriverInput = {
  driverId: string;
  driverCategory?: number;
  slot?: number;
};

export type CreateRegistrationInput = {
  series: string;
  season: string;
  championshipKey: string;
  teamId: string;
  carModelId: number | null;
  raceNumber: number | null;
  entryClass: string | null;
  // The authenticated caller's own driver id — register_entry() requires it
  // to appear in `drivers` (REGISTRANT_NOT_IN_ROSTER otherwise). No
  // divisionId here: register_entry() derives it from `drivers` itself
  // (every driver's drivers.division_id must agree) rather than trusting a
  // value the caller computed — see 20260814e's DECISION 1.
  registrantDriverId: string;
  drivers: RegistrationDriverInput[];
};

// Exact prefixes register_entry() raises — see 20260814e/f's header
// comments for the full rationale on each. Order matters for matching:
// longer/more-specific prefixes never collide here since they're all
// distinct literal words, but keep using `startsWith` (not `includes`) so a
// message that happens to mention another code in its detail text can't be
// misclassified.
const REGISTRATION_ERROR_CODES = [
  'EMPTY_ROSTER',
  'DRIVER_NOT_FOUND',
  'DIVISION_UNASSIGNED',
  'DIVISION_MISMATCH',
  'REGISTRANT_NOT_IN_ROSTER',
  'DRIVER_ALREADY_CLAIMED',
] as const;

export type RegistrationErrorCode = (typeof REGISTRATION_ERROR_CODES)[number] | 'UNKNOWN';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Parses register_entry()'s RAISE EXCEPTION message ("CODE" or
// "CODE: detail including a uuid") into a structured code + the driver id
// it's about, if any. Falls back to UNKNOWN for anything else (a real
// Postgres error unrelated to these business-rule checks — a connection
// issue, a constraint we didn't anticipate, etc.) so the caller can show a
// generic message rather than mis-parsing something as one of these codes.
function parseRegistrationError(message: string): { errorCode: RegistrationErrorCode; driverId: string | null } {
  const code = REGISTRATION_ERROR_CODES.find((c) => message.startsWith(c));
  if (!code) return { errorCode: 'UNKNOWN', driverId: null };
  const driverId = message.match(UUID_RE)?.[0] ?? null;
  return { errorCode: code, driverId };
}

export type CreateRegistrationResult =
  | { ok: true; status: 'confirmed' }
  | { ok: true; status: 'waitlisted'; waitlistPosition: number }
  | { ok: false; errorCode: RegistrationErrorCode; driverId: string | null; message: string };

// The cap-enforcing write path — see register_entry() in
// 20260811b_registrations_waitlist.sql for why the count-then-insert has to
// happen as one atomic DB call rather than here: two concurrent callers each
// reading "confirmed_count < max" before either has inserted is exactly how
// you blow past the cap. As of 20260814d/e/f, this single call also
// atomically enforces one-claim-per-driver-per-event (a real UNIQUE
// constraint, not a check-then-insert), division agreement across the
// roster, and writes team_members in the same transaction as the entry —
// see those migrations' headers.
//
// Does not create the `teams` row itself — pass an existing team's id as
// teamId; the caller resolves/creates the team first.
export async function createRegistration(
  input: CreateRegistrationInput,
): Promise<CreateRegistrationResult> {
  const { data, error } = await supabase.rpc('register_entry', {
    p_series: input.series,
    p_season: input.season,
    p_championship_key: input.championshipKey,
    p_team_id: input.teamId,
    p_car_model_id: input.carModelId,
    p_race_number: input.raceNumber,
    p_entry_class: input.entryClass,
    p_registrant_driver_id: input.registrantDriverId,
    p_drivers: input.drivers.map((d) => ({
      driver_id: d.driverId,
      driver_category: d.driverCategory ?? 1,
      slot: d.slot ?? 0,
    })),
  });

  if (error) {
    const { errorCode, driverId } = parseRegistrationError(error.message);
    return { ok: false, errorCode, driverId, message: error.message };
  }

  const row = data as { status: RegistrationStatus; waitlist_position: number | null };
  return row.status === 'waitlisted'
    ? { ok: true, status: 'waitlisted', waitlistPosition: row.waitlist_position! }
    : { ok: true, status: 'confirmed' };
}
