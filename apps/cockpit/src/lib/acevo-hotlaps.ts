import { after } from 'next/server';
import { EmperorClient } from '@sra/emperor-client';
import {
  parseAcEvoSession,
  aggregateHotLapLeaderboard,
  computeRacePositionPoints,
  computePoleSteamId,
  totalRoundPoints,
} from '@sra/domain';
import type { HotLapEntry, AcEvoSessionResult } from '@sra/shared-types';
import { supabase } from './supabase';
import { EMPEROR_ACEVO_BASE_URL } from './emperor';

const STALE_MS = 10 * 60 * 1000;
const LOCK_RECLAIM_MS = 5 * 60 * 1000;
const REFRESH_STATE_ID = 'global';
// 2s gap per request. Emperor's limit is ~2 req/min sustained; the cron makes
// at most ~3 requests per 10-min window (0.3 req/min average), so this is safe.
const CRON_REQUEST_INTERVAL_MS = 2_000;

export type IncrementalRefreshResult = {
  processed: number;
  tracks: string[];
  durationMs: number;
  needsBackfill?: boolean;
};

export async function getHotLapBoard(trackKey: string): Promise<HotLapEntry[]> {
  const { data, error } = await supabase
    .from('acevo_hotlap_cache')
    .select('entries')
    .eq('track_key', trackKey)
    .maybeSingle();

  if (error) {
    console.error(`AC Evo hot-lap cache read failed for "${trackKey}":`, error);
  }

  after(() => maybeRefresh());

  return (data?.entries as HotLapEntry[] | undefined) ?? [];
}

export async function getRoundPoints(trackKey: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('acevo_round_points_cache')
    .select('race_position_points, fastest_lap_steam_id, pole_steam_id')
    .eq('track_key', trackKey)
    .maybeSingle();

  if (error) {
    console.error(`AC Evo round-points cache read failed for "${trackKey}":`, error);
  }

  after(() => maybeRefresh());

  if (!data) return {};
  return totalRoundPoints(
    (data.race_position_points as Record<string, number> | null) ?? {},
    data.fastest_lap_steam_id ?? null,
    data.pole_steam_id ?? null,
  );
}

// In-process guard: prevents redundant staleness checks when the same page
// render triggers multiple after() calls (one per track).
let refreshing = false;

async function maybeRefresh(): Promise<void> {
  if (refreshing) return;

  const { data: state, error: stateError } = await supabase
    .from('acevo_hotlap_refresh_state')
    .select('updated_at')
    .eq('id', REFRESH_STATE_ID)
    .maybeSingle();

  if (stateError) {
    console.error('AC Evo hot-lap refresh-state read failed (is acevo_hotlap_refresh_state seeded?):', stateError);
    return;
  }

  const isStale = !state || Date.now() - new Date(state.updated_at).getTime() > STALE_MS;
  if (!isStale) return;

  refreshing = true;
  try {
    await refreshWithLock();
  } finally {
    refreshing = false;
  }
}

// Shared by maybeRefresh() (on-demand fallback) and the cron route (proactive).
// Acquires the DB lock before running so concurrent callers (multiple server
// instances or overlapping after() invocations) don't pile onto Emperor.
// Returns null when the lock is already held by another caller.
export async function refreshWithLock(): Promise<IncrementalRefreshResult | null> {
  const reclaimableBefore = new Date(Date.now() - LOCK_RECLAIM_MS).toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from('acevo_hotlap_refresh_state')
    .update({ refresh_started_at: new Date().toISOString() })
    .eq('id', REFRESH_STATE_ID)
    .or(`refresh_started_at.is.null,refresh_started_at.lt.${reclaimableBefore}`)
    .select();

  if (claimError) {
    console.error('AC Evo hot-lap refresh lock acquisition failed:', claimError);
    return null;
  }
  if (!claimed || claimed.length === 0) return null; // another caller holds the lock

  try {
    return await runIncrementalRefresh();
  } catch (err) {
    console.error('AC Evo hot-lap incremental refresh failed:', err);
    return { processed: 0, tracks: [], durationMs: 0 };
  } finally {
    await releaseLock();
  }
}

// Core incremental refresh. Fetches only page 0 of Emperor's results list
// (confirmed newest-first: see scripts/check-emperor-page-order.ts), identifies
// sessions not yet in acevo_processed_sessions, and processes only those.
// Normal run (0-1 new sessions) completes in ~1-5s — well within Vercel's limit.
async function runIncrementalRefresh(): Promise<IncrementalRefreshResult> {
  const client = new EmperorClient(EMPEROR_ACEVO_BASE_URL, {
    minRequestIntervalMs: CRON_REQUEST_INTERVAL_MS,
  });
  const startedAt = Date.now();

  const { entries, numPages } = await client.getResultsList(0);

  // Batch-check which of these session URLs we've already processed.
  const allUrls = entries.map((e) => e.resultsJsonUrl);
  const { data: knownRows, error: knownError } = await supabase
    .from('acevo_processed_sessions')
    .select('session_url')
    .in('session_url', allUrls);

  if (knownError) throw knownError;

  const knownUrls = new Set((knownRows ?? []).map((r) => r.session_url as string));

  // Page 0 is newest-first: stop at the first known URL — everything after it
  // is also already processed, so there's no need to scan further.
  const newEntries: typeof entries = [];
  for (const entry of entries) {
    if (knownUrls.has(entry.resultsJsonUrl)) break;
    newEntries.push(entry);
  }

  if (newEntries.length === 0) {
    console.log('AC Evo hot-lap refresh: nothing new');
    return { processed: 0, tracks: [], durationMs: Date.now() - startedAt };
  }

  // Safety: if the entire page is new AND there are more pages, we're looking
  // at a first-run scenario with many historical sessions. The cron path isn't
  // designed for that volume — bail and let the backfill script handle it.
  if (newEntries.length === entries.length && numPages > 1) {
    console.warn(
      'AC Evo hot-lap refresh: entire page 0 is unprocessed with multiple pages — ' +
      'run scripts/backfill-acevo-hotlaps.ts locally to catch up.',
    );
    return { processed: 0, tracks: [], durationMs: Date.now() - startedAt, needsBackfill: true };
  }

  const processedTracks = new Set<string>();

  for (const entry of newEntries) {
    try {
      const raw = await client.downloadResult(entry.resultsJsonUrl);
      const session = parseAcEvoSession(raw);

      const { data: existing, error: readErr } = await supabase
        .from('acevo_hotlap_cache')
        .select('entries')
        .eq('track_key', entry.track)
        .maybeSingle();
      if (readErr) throw readErr;

      const fresh = aggregateHotLapLeaderboard([session]);
      const merged = mergeEntries((existing?.entries as HotLapEntry[] | undefined) ?? [], fresh);

      const { error: cacheErr } = await supabase
        .from('acevo_hotlap_cache')
        .upsert(
          { track_key: entry.track, entries: merged, last_session_date: entry.date, updated_at: new Date().toISOString() },
          { onConflict: 'track_key' },
        );
      if (cacheErr) throw cacheErr;

      try {
        await updateRoundPointsCache(entry.track, [session]);
      } catch (pointsErr) {
        console.error(`AC Evo round-points update failed for "${entry.track}":`, pointsErr);
      }

      const { error: markErr } = await supabase
        .from('acevo_processed_sessions')
        .insert({
          session_url: entry.resultsJsonUrl,
          track: entry.track,
          session_type: entry.sessionType,
          session_date: entry.date,
        });
      if (markErr) throw markErr;

      processedTracks.add(entry.track);
      console.log(`AC Evo hot-lap refresh: processed [${entry.sessionType}] ${entry.track} @ ${entry.date}`);
    } catch (err) {
      // Don't let one session abort the rest. Its URL stays out of
      // acevo_processed_sessions, so the next run will retry it.
      console.error(`AC Evo hot-lap refresh: failed to process ${entry.resultsJsonUrl}:`, err);
    }
  }

  const durationMs = Date.now() - startedAt;
  console.log(`AC Evo hot-lap refresh: done — ${newEntries.length} session(s) in ${Math.round(durationMs / 1000)}s`);
  return { processed: newEntries.length, tracks: [...processedTracks], durationMs };
}

function mergeEntries(existing: HotLapEntry[], fresh: HotLapEntry[]): HotLapEntry[] {
  const bySteamId = new Map<string, Omit<HotLapEntry, 'rank'>>();
  for (const e of existing) bySteamId.set(e.steamId, e);
  for (const e of fresh) {
    const prev = bySteamId.get(e.steamId);
    if (!prev || e.bestLapMs < prev.bestLapMs) bySteamId.set(e.steamId, e);
  }
  return [...bySteamId.values()]
    .sort((a, b) => a.bestLapMs - b.bestLapMs)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

async function releaseLock(): Promise<void> {
  const { error } = await supabase
    .from('acevo_hotlap_refresh_state')
    .update({ refresh_started_at: null, updated_at: new Date().toISOString() })
    .eq('id', REFRESH_STATE_ID);
  if (error) {
    console.error('AC Evo hot-lap refresh lock release failed:', error);
  }
}

function latestCompletedSession(
  sessions: AcEvoSessionResult[],
  type: AcEvoSessionResult['sessionType'],
): AcEvoSessionResult | null {
  return sessions
    .filter((s) => s.sessionType === type && s.isCompleted && s.serverStartTime)
    .reduce<AcEvoSessionResult | null>(
      (latest, s) =>
        !latest || new Date(s.serverStartTime!) > new Date(latest.serverStartTime!) ? s : latest,
      null,
    );
}

async function updateRoundPointsCache(track: string, sessions: AcEvoSessionResult[]): Promise<void> {
  const newRace = latestCompletedSession(sessions, 'Race');
  const newQualify = latestCompletedSession(sessions, 'Qualify');
  if (!newRace && !newQualify) return;

  const { data: existing, error: readError } = await supabase
    .from('acevo_round_points_cache')
    .select('race_position_points, fastest_lap_steam_id, pole_steam_id, race_session_date, qualify_session_date')
    .eq('track_key', track)
    .maybeSingle();
  if (readError) throw readError;

  let racePositionPoints = (existing?.race_position_points as Record<string, number> | null) ?? {};
  let fastestLapSteamId: string | null = existing?.fastest_lap_steam_id ?? null;
  let raceSessionDate: string | null = existing?.race_session_date ?? null;
  let poleSteamId: string | null = existing?.pole_steam_id ?? null;
  let qualifySessionDate: string | null = existing?.qualify_session_date ?? null;

  if (newRace && (!raceSessionDate || new Date(newRace.serverStartTime!) > new Date(raceSessionDate))) {
    const result = computeRacePositionPoints(newRace);
    racePositionPoints = result.points;
    fastestLapSteamId = result.fastestLapSteamId;
    raceSessionDate = newRace.serverStartTime;
  }

  if (newQualify && (!qualifySessionDate || new Date(newQualify.serverStartTime!) > new Date(qualifySessionDate))) {
    poleSteamId = computePoleSteamId(newQualify);
    qualifySessionDate = newQualify.serverStartTime;
  }

  const { error: writeError } = await supabase.from('acevo_round_points_cache').upsert(
    {
      track_key: track,
      race_position_points: racePositionPoints,
      fastest_lap_steam_id: fastestLapSteamId,
      pole_steam_id: poleSteamId,
      race_session_date: raceSessionDate,
      qualify_session_date: qualifySessionDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'track_key' },
  );
  if (writeError) throw writeError;
}
