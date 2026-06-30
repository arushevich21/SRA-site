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

const STALE_MS = 10 * 60 * 1000; // re-check Emperor at most every 10 minutes
const LOCK_RECLAIM_MS = 5 * 60 * 1000; // a refresh that's been "in flight" this long is assumed crashed
const REFRESH_STATE_ID = 'global';

// Reads are always a single Supabase row lookup — this never makes a live
// Emperor call itself. Refresh is fully decoupled (see maybeRefresh below),
// so there's no "Emperor unreachable" failure mode on this path at all.
export async function getHotLapBoard(trackKey: string): Promise<HotLapEntry[]> {
  const { data, error } = await supabase
    .from('acevo_hotlap_cache')
    .select('entries')
    .eq('track_key', trackKey)
    .maybeSingle();

  if (error) {
    console.error(`AC Evo hot-lap cache read failed for "${trackKey}":`, error);
  }

  // Next.js ties background fetch() calls to the request's lifecycle and can
  // cancel them once the response is sent — a bare `void maybeRefresh()` here
  // was getting silently killed mid-job before it ever reached Emperor.
  // after() explicitly tells Next this work must keep running post-response.
  after(() => maybeRefresh());

  return (data?.entries as HotLapEntry[] | undefined) ?? [];
}

// Total points scored by each driver (steamId) in the round held at this
// track: finishing-position points from the latest completed Race session
// plus the fastest-lap and pole bonuses. Emperor's API has no per-round
// breakdown endpoint — this is computed by us from session files, the same
// source the hot-lap board uses, refreshed by the same background job.
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

// In-process fast path: once this server process knows a refresh is running,
// skip the DB round-trip entirely for the rest of the requests sharing this
// page render (4 tracks each call getHotLapBoard → maybeRefresh). The real
// concurrency guard is the DB-level lock acquired below, which is what keeps
// multiple server instances (or overlapping requests before this flag is even
// set) from piling concurrent refresh jobs onto Emperor.
let refreshing = false;

async function maybeRefresh(): Promise<void> {
  if (refreshing) return;

  const { data: state, error: stateError } = await supabase
    .from('acevo_hotlap_refresh_state')
    .select('updated_at, refresh_started_at')
    .eq('id', REFRESH_STATE_ID)
    .maybeSingle();

  if (stateError) {
    console.error('AC Evo hot-lap refresh-state read failed (is acevo_hotlap_refresh_state seeded?):', stateError);
    return;
  }

  const isStale = !state || Date.now() - new Date(state.updated_at).getTime() > STALE_MS;
  if (!isStale) return;

  const reclaimableBefore = new Date(Date.now() - LOCK_RECLAIM_MS).toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from('acevo_hotlap_refresh_state')
    .update({ refresh_started_at: new Date().toISOString() })
    .eq('id', REFRESH_STATE_ID)
    .or(`refresh_started_at.is.null,refresh_started_at.lt.${reclaimableBefore}`)
    .select();

  if (claimError) {
    console.error('AC Evo hot-lap refresh lock acquisition failed:', claimError);
    return;
  }
  if (!claimed || claimed.length === 0) return; // another request/instance already holds the lock

  refreshing = true;
  runRefreshJob().finally(() => {
    refreshing = false;
  });
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
    // Lock stays held until LOCK_RECLAIM_MS passes, then self-heals — log so
    // it's visible, but don't throw (this runs from a finally-style cleanup path).
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

// Tracks the *latest* completed Race/Qualify session per track as "the"
// round — there's no explicit per-round session ID from Emperor, so a track
// that sees test/practice races before the scheduled one could briefly skew
// this until the real session (chronologically later) supersedes it. Each
// component (race points + fastest-lap bonus vs. pole bonus) only updates
// when a newer session of its own type arrives, so this never needs the
// track's full session history — just whatever's new this cycle.
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

  if (
    newQualify &&
    (!qualifySessionDate || new Date(newQualify.serverStartTime!) > new Date(qualifySessionDate))
  ) {
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

// One global job covers every track in one pass: Emperor's results list isn't
// filterable by track, so fetching it once and bucketing client-side avoids
// redundant calls a per-track job would make. In steady state (no new
// sessions since any track's cursor) this costs exactly one request.
//
// The cursor lives per-track (acevo_hotlap_cache.last_session_date), not as a
// single global value, and each track is committed independently inside its
// own try/catch. That matters because this job can take many minutes on a
// cold backfill (rate-limited ~31s/request) and can get killed mid-flight
// (dev-server restart, a transient Emperor error on one track) — with a
// global cursor, any partial failure reset progress to zero and caused every
// track to be re-fetched from scratch on every retry, forever. Per-track
// cursors mean a track that already succeeded stays done even if a sibling
// track fails this run.
async function runRefreshJob(): Promise<void> {
  const client = new EmperorClient(EMPEROR_ACEVO_BASE_URL);
  const startedAt = Date.now();

  try {
    const all = await client.getAllResultsList();

    const byTrack = new Map<string, typeof all>();
    for (const entry of all) {
      const arr = byTrack.get(entry.track) ?? [];
      arr.push(entry);
      byTrack.set(entry.track, arr);
    }

    let anyNew = false;
    for (const [track, entries] of byTrack) {
      try {
        const { data: existingRow, error: readError } = await supabase
          .from('acevo_hotlap_cache')
          .select('entries, last_session_date')
          .eq('track_key', track)
          .maybeSingle();
        if (readError) throw readError;

        const cursor = existingRow?.last_session_date ? new Date(existingRow.last_session_date) : null;
        const newEntries = cursor ? entries.filter((e) => new Date(e.date) > cursor) : entries;
        if (newEntries.length === 0) continue;

        anyNew = true;
        console.log(`AC Evo hot-lap refresh: ${newEntries.length} new session(s) for "${track}"...`);

        const sessions: AcEvoSessionResult[] = [];
        let maxDate = cursor ?? new Date(0);
        for (const entry of newEntries) {
          const raw = await client.downloadResult(entry.resultsJsonUrl);
          sessions.push(parseAcEvoSession(raw));
          const entryDate = new Date(entry.date);
          if (entryDate > maxDate) maxDate = entryDate;
        }

        const fresh = aggregateHotLapLeaderboard(sessions);
        const merged = mergeEntries((existingRow?.entries as HotLapEntry[] | undefined) ?? [], fresh);

        const { error: writeError } = await supabase
          .from('acevo_hotlap_cache')
          .upsert(
            {
              track_key: track,
              entries: merged,
              last_session_date: maxDate.toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'track_key' },
          );
        if (writeError) throw writeError;

        // A separate try/catch: round-points failing shouldn't roll back the
        // hot-lap board write above, and vice versa — they're independent
        // features sharing the same downloaded `sessions`.
        try {
          await updateRoundPointsCache(track, sessions);
        } catch (pointsErr) {
          console.error(`AC Evo round-points refresh failed for "${track}":`, pointsErr);
        }
      } catch (err) {
        // Don't let one track's failure roll back or block the others — it
        // just retries on the next refresh cycle (its cursor wasn't advanced).
        console.error(`AC Evo hot-lap refresh failed for "${track}":`, err);
      }
    }

    if (!anyNew) {
      console.log('AC Evo hot-lap refresh: nothing new since last check');
    } else {
      console.log(`AC Evo hot-lap refresh: done in ${Math.round((Date.now() - startedAt) / 1000)}s`);
    }
  } catch (err) {
    console.error('AC Evo hot-lap refresh failed:', err);
  } finally {
    await releaseLock();
  }
}
