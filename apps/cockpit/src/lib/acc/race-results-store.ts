import { computeAccEventKey, msToLaptime } from '@sra/domain';
import type { AccSessionResult, AccSessionType } from '@sra/shared-types';
import { supabase } from '../supabase';

const SESSION_ORDER: Record<AccSessionType, number> = { Practice: 0, Qualify: 1, Race: 2 };

// Upserts one parsed session into acc_race_sessions. sessionKey must be
// stable and unique per session: the cron passes Emperor's resultsJsonUrl;
// the admin upload page (no Emperor URL to key on) passes
// 'manual:'+track+':'+sessionFile. Also ensures the track exists in both the
// legacy acc_tracks table and the shared tracks/track_layouts v2 schema —
// same idempotent upserts as hotlaps.ts's upsertTrackAndLeaderboard — so
// this is self-sufficient regardless of caller, including the admin upload
// action which (unlike the cron) never otherwise touches those tables, and
// getAccTrack()/getAccTracks() (which read track_layouts) resolve a display
// name for every event, not just cron-ingested ones.
export async function ingestAccRaceSession(session: AccSessionResult, sessionKey: string): Promise<void> {
  const { error: trackErr } = await supabase
    .from('acc_tracks')
    .upsert({ track_key: session.track, display_name: session.track }, { onConflict: 'track_key', ignoreDuplicates: true });
  if (trackErr) throw trackErr;

  try {
    await supabase
      .from('tracks')
      .upsert({ base_track_key: session.track, display_name: session.track }, { onConflict: 'base_track_key', ignoreDuplicates: true })
      .throwOnError();
    await supabase
      .from('track_layouts')
      .upsert(
        { layout_key: session.track, base_track_key: session.track, game: 'ACC', layout_name: null, display_name: session.track },
        { onConflict: 'layout_key', ignoreDuplicates: true },
      )
      .throwOnError();
  } catch (v2Err) {
    console.error(`ACC tracks/track_layouts dual-write failed for "${session.track}":`, v2Err);
  }

  const { error } = await supabase.from('acc_race_sessions').upsert(
    {
      session_key: sessionKey,
      event_key: computeAccEventKey(session),
      session_type: session.sessionType,
      track_key: session.track,
      server_name: session.serverName,
      session_date: session.date ?? new Date().toISOString(),
      session_file: session.sessionFile,
      meta_data: session.metaDataRaw,
      championship_id: session.championshipId,
      season_id: session.seasonId,
      is_wet_session: session.isWetSession,
      best_lap_ms: session.bestLapMs,
      results: session.results,
    },
    { onConflict: 'session_key' },
  );
  if (error) throw error;
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
