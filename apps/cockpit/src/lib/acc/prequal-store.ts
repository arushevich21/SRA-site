import 'server-only';
import { accCarClassName, computePrequalStandings, type PrequalStandingRow } from '@sra/domain';
import { supabase } from '../supabase';
import { bareDriverName } from '../driver-display-name';

// Read side of endurance pre-qualifying (write side: prequal-ingest.ts).
// Standings are recomputed on every read against CURRENT confirmed
// registrations — a car swap, a withdrawal or an admin fix is reflected
// immediately, with nothing re-ingested.

export type PrequalEvent = {
  id: string;
  championshipId: string;
  championshipTitle: string;
  championshipSlug: string;
  trackKey: string;
  opensAt: string;
  closesAt: string;
  lapsCounted: number;
  noTimeMs: number;
  classOrder: string[];
};

export type PrequalBoard = {
  event: PrequalEvent;
  rows: PrequalStandingRow[];
  isOpen: boolean;
};

// ACC's car group -> the championship's class label. The only rename is the
// Porsche Cup: ACC groups it as GTC; the league calls the class CUP.
export function prequalClassForCar(carModelId: number): string {
  const group = accCarClassName(carModelId) ?? 'Other';
  return group === 'GTC' ? 'CUP' : group;
}

type EventRow = {
  id: string;
  championship_id: string;
  track_key: string;
  opens_at: string;
  closes_at: string;
  laps_counted: number;
  no_time_ms: number;
  class_order: string[];
  championships: { title: string; slug: string } | { title: string; slug: string }[] | null;
};

function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

// The pre-qual event to show: the most recent one that has opened. null when
// none has (or the tables don't exist yet — pre-qual is then just "off").
export async function getCurrentPrequalEvent(): Promise<PrequalEvent | null> {
  const { data, error } = await supabase
    .from('prequal_events')
    .select('id, championship_id, track_key, opens_at, closes_at, laps_counted, no_time_ms, class_order, championships(title, slug)')
    .lte('opens_at', new Date().toISOString())
    .order('opens_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (error.code !== '42P01') console.error('prequal: loading event failed:', error.message);
    return null;
  }
  if (!data) return null;
  const r = data as unknown as EventRow;
  const champ = one(r.championships);
  return {
    id: r.id,
    championshipId: r.championship_id,
    championshipTitle: champ?.title ?? 'Endurance',
    championshipSlug: champ?.slug ?? '',
    trackKey: r.track_key,
    opensAt: r.opens_at,
    closesAt: r.closes_at,
    lapsCounted: r.laps_counted,
    noTimeMs: r.no_time_ms,
    classOrder: r.class_order,
  };
}

type RegistrationRow = {
  id: string;
  car_model_id: number | null;
  teams: { name: string } | { name: string }[] | null;
  registration_drivers:
    | Array<{
        slot: number;
        drivers: { steam_id: string | null; display_name: string | null } | null;
      }>
    | null;
};

export async function getPrequalBoard(event: PrequalEvent): Promise<PrequalBoard> {
  const isOpen = Date.now() < Date.parse(event.closesAt);

  const { data: champ } = await supabase
    .from('championships')
    .select('registration_key, registration_season')
    .eq('id', event.championshipId)
    .maybeSingle();
  if (!champ?.registration_key || !champ.registration_season) {
    return { event, rows: [], isOpen };
  }

  const [{ data: regs, error: regErr }, { data: top, error: lapErr }] = await Promise.all([
    // Confirmed only: a waitlisted entry has no grid slot to qualify for.
    supabase
      .from('registrations')
      .select('id, car_model_id, teams(name), registration_drivers(slot, drivers(steam_id, display_name))')
      .eq('championship_key', champ.registration_key)
      .eq('season', champ.registration_season)
      .eq('status', 'confirmed'),
    supabase.rpc('prequal_top_laps', { p_event_id: event.id }),
  ]);
  if (regErr) console.error('prequal: loading registrations failed:', regErr.message);
  if (lapErr) console.error('prequal: loading laps failed:', lapErr.message);

  const entries = ((regs ?? []) as unknown as RegistrationRow[])
    .filter((r) => r.car_model_id != null)
    .map((r) => ({
      entryId: r.id,
      teamName: one(r.teams)?.name ?? 'Unnamed Team',
      entryClass: prequalClassForCar(r.car_model_id!),
      carModelId: r.car_model_id!,
      drivers: [...(r.registration_drivers ?? [])]
        .sort((a, b) => a.slot - b.slot)
        .filter((d) => d.drivers?.steam_id)
        .map((d) => ({
          // drivers.steam_id is bare; laps are S-prefixed (CLAUDE.md join rule).
          steamId: `S${d.drivers!.steam_id}`,
          name: d.drivers!.display_name ? bareDriverName(d.drivers!.display_name) : 'Unknown driver',
        })),
    }));

  const lapRows = (top ?? []) as Array<{ steam_id: string; car_model_id: number; lap_ms: number; laps_in_car: number }>;
  const lapCounts = new Map(lapRows.map((l) => [`${l.steam_id}:${l.car_model_id}`, Number(l.laps_in_car)]));

  const rows = computePrequalStandings(
    entries,
    lapRows.map((l) => ({ steamId: l.steam_id, carModelId: l.car_model_id, lapMs: l.lap_ms })),
    { lapsCounted: event.lapsCounted, noTimeMs: event.noTimeMs, classOrder: event.classOrder, lapCounts },
  );
  return { event, rows, isOpen };
}
