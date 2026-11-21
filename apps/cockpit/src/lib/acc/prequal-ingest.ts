import type { SupabaseClient } from '@supabase/supabase-js';
import { fromZonedTime } from 'date-fns-tz';
import {
  accLedgerFileKeyFromEmperorUrl,
  accLedgerSourceFromBaseUrl,
  accSessionAtFromFileName,
  extractAccValidLaps,
} from '@sra/domain';

// Endurance pre-qualifying ingest: copies every valid lap from an in-scope
// ACC result file into prequal_laps (see
// supabase/migrations/20261121_endurance_prequal.sql). Scoring is done at read
// time by @sra/domain computePrequalStandings, against current registrations.
//
// Takes the client as a parameter (no 'server-only' import) so the backfill
// script reuses this exact logic — same pattern as lap-ledger-store.ts.
//
// Called from the hot-lap cron for every result file it already downloads,
// so pre-qual costs no extra ACCSM requests (5 req / 20s per IP — see the
// accsm rate-limit notes in lib/acc/hotlaps.ts).

// ACCSM writes result names in the host's local wall-clock time, no zone
// (2026-11-21 20:30 Eastern -> 261121_203000_Q). The window is stored as real
// instants, so convert before comparing.
const ACCSM_HOST_TIMEZONE = 'America/New_York';

type PrequalEventRow = {
  id: string;
  source: string;
  server_id: number;
  track_key: string;
  opens_at: string;
  closes_at: string;
};

// The events list is tiny and changes about once a season; re-reading it for
// every result file across every server would be pure waste.
let cache: { at: number; rows: PrequalEventRow[] } | null = null;
const CACHE_MS = 5 * 60 * 1000;

async function loadEvents(client: SupabaseClient): Promise<PrequalEventRow[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const { data, error } = await client
    .from('prequal_events')
    .select('id, source, server_id, track_key, opens_at, closes_at');
  if (error) {
    // 42P01 = table missing (migration not applied yet): pre-qual is simply
    // off, not an ingest failure.
    if (error.code !== '42P01') console.error('prequal: loading events failed:', error.message);
    cache = { at: Date.now(), rows: [] };
    return [];
  }
  cache = { at: Date.now(), rows: (data ?? []) as PrequalEventRow[] };
  return cache.rows;
}

// Real instant a result file was written (= its session ended), from its
// filename stamp. null when the URL isn't a keyable results download.
export function prequalSessionEndedAt(resultsJsonUrl: string): Date | null {
  const stem = /\/(\d{6}_\d{6}_[A-Za-z0-9]+)\.json$/.exec(resultsJsonUrl)?.[1];
  if (!stem) return null;
  const wall = accSessionAtFromFileName(stem); // wall-clock read as UTC
  if (!wall) return null;
  return fromZonedTime(wall.toISOString().slice(0, 19), ACCSM_HOST_TIMEZONE);
}

const SERVER_IN_URL = /^\/server\/(\d+)\/results\/download\//;

// Returns how many laps were newly recorded (0 when the file is out of scope).
// Idempotent: (event_id, file_key, lap_index) is the primary key, so a replay
// — or the cron and the backfill both seeing a file — records each lap once.
export async function ingestPrequalLaps(
  client: SupabaseClient,
  baseUrl: string,
  resultsJsonUrl: string,
  raw: unknown,
): Promise<number> {
  const source = accLedgerSourceFromBaseUrl(baseUrl);
  const serverId = Number(SERVER_IN_URL.exec(resultsJsonUrl)?.[1] ?? NaN);
  if (!source || !Number.isInteger(serverId)) return 0;

  const events = (await loadEvents(client)).filter((e) => e.source === source && e.server_id === serverId);
  if (events.length === 0) return 0;

  const fileKey = accLedgerFileKeyFromEmperorUrl(source, resultsJsonUrl);
  const endedAt = prequalSessionEndedAt(resultsJsonUrl);
  if (!fileKey || !endedAt) return 0;

  const track = String((raw as { trackName?: string } | null)?.trackName ?? '').trim();
  const inScope = events.filter(
    (e) =>
      e.track_key === track &&
      endedAt.getTime() >= Date.parse(e.opens_at) &&
      endedAt.getTime() < Date.parse(e.closes_at),
  );
  if (inScope.length === 0) return 0;

  const laps = extractAccValidLaps(raw);
  if (laps.length === 0) return 0;

  let recorded = 0;
  for (const e of inScope) {
    const rows = laps.map((l) => ({
      event_id: e.id,
      file_key: fileKey,
      lap_index: l.lapIndex,
      steam_id: l.steamId,
      car_model_id: l.carModelId,
      lap_ms: l.lapMs,
      session_at: endedAt.toISOString(),
    }));
    const { data, error } = await client
      .from('prequal_laps')
      .upsert(rows, { onConflict: 'event_id,file_key,lap_index', ignoreDuplicates: true })
      .select('lap_index');
    if (error) throw new Error(`prequal_laps insert failed for ${fileKey}: ${error.message}`);
    recorded += data?.length ?? 0;
  }
  return recorded;
}
