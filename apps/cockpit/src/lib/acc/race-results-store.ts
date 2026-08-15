import { msToLaptime } from '@sra/domain';
import type { AccSessionResult, AccSessionType } from '@sra/shared-types';
import { supabase } from '../supabase';
import { ingestAccRaceSessionInto } from './ingest-session';

const SESSION_ORDER: Record<AccSessionType, number> = { Practice: 0, Qualify: 1, Race: 2 };

// Upserts one parsed session into acc_race_sessions, using the production
// singleton client. Thin wrapper over ingestAccRaceSessionInto (see
// ingest-session.ts for the actual upsert logic and why it's factored out
// this way) — kept so existing callers (the cron's hotlaps.ts, the admin
// upload action) don't need to change; scripts/backfill-acc-sessions.ts
// calls ingestAccRaceSessionInto directly with its own client and
// 'acc_race_sessions_staging' as the target instead.
export async function ingestAccRaceSession(session: AccSessionResult, sessionKey: string): Promise<void> {
  await ingestAccRaceSessionInto(supabase, 'acc_race_sessions', session, sessionKey);
}

export type AccRaceEventSummary = {
  eventKey: string;
  track: string;
  serverName: string | null;
  date: string; // earliest session date in the event
  championshipId: string | null;
  seasonId: string | null;
  sessionTypes: AccSessionType[]; // which of FP/Q/R exist, unordered
};

type RaceSessionRow = {
  event_key: string;
  track_key: string;
  server_name: string | null;
  session_date: string;
  session_type: AccSessionType;
  championship_id: string | null;
  season_id: string | null;
};

// Race events aren't a separate table — they're derived by grouping
// acc_race_sessions rows by event_key here. Simpler than keeping a second
// table in sync, and fine at the data volumes a league's race archive
// actually produces; revisit with a SQL view if this ever needs to paginate
// server-side.
export async function getAccRaceEvents(): Promise<AccRaceEventSummary[]> {
  const { data, error } = await supabase
    .from('acc_race_sessions')
    .select('event_key, track_key, server_name, session_date, session_type, championship_id, season_id')
    .order('session_date', { ascending: false });
  if (error) throw error;

  const byEvent = new Map<string, AccRaceEventSummary>();
  for (const row of (data ?? []) as RaceSessionRow[]) {
    const existing = byEvent.get(row.event_key);
    if (!existing) {
      byEvent.set(row.event_key, {
        eventKey: row.event_key,
        track: row.track_key,
        serverName: row.server_name,
        date: row.session_date,
        championshipId: row.championship_id,
        seasonId: row.season_id,
        sessionTypes: [row.session_type],
      });
    } else {
      if (row.session_date < existing.date) existing.date = row.session_date;
      if (!existing.sessionTypes.includes(row.session_type)) existing.sessionTypes.push(row.session_type);
    }
  }
  // Rows arrive newest-first, and a Map preserves first-insertion order, so
  // this is already newest-event-first.
  return [...byEvent.values()];
}

type FullRaceSessionRow = RaceSessionRow & {
  session_file: string | null;
  meta_data: string | null;
  is_wet_session: boolean;
  best_lap_ms: number | null;
  results: AccSessionResult['results'];
};

export async function getAccRaceEventSessions(eventKey: string): Promise<AccSessionResult[]> {
  const { data, error } = await supabase
    .from('acc_race_sessions')
    .select(
      'session_type, track_key, server_name, session_date, session_file, meta_data, championship_id, season_id, is_wet_session, best_lap_ms, results',
    )
    .eq('event_key', eventKey);
  if (error) throw error;

  const sessions: AccSessionResult[] = ((data ?? []) as FullRaceSessionRow[]).map((row) => ({
    sessionType: row.session_type,
    track: row.track_key,
    serverName: row.server_name,
    date: row.session_date,
    sessionFile: row.session_file,
    championshipId: row.championship_id,
    seasonId: row.season_id,
    metaDataRaw: row.meta_data,
    isWetSession: row.is_wet_session,
    bestLapMs: row.best_lap_ms,
    bestLap: msToLaptime(row.best_lap_ms),
    bestSplits: null,
    results: row.results,
  }));

  return sessions.sort((a, b) => SESSION_ORDER[a.sessionType] - SESSION_ORDER[b.sessionType]);
}
