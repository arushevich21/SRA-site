import { EmperorClient } from '@sra/emperor-client';
import { parseAccSession, aggregateAccHotLapLeaderboard } from '@sra/domain';
import type { AccSessionResult } from '@sra/shared-types';
import { supabase } from '../supabase';
import { EMPEROR_ACC_BASE_URLS } from '../emperor';

const LOCK_RECLAIM_MS = 5 * 60 * 1000;
const REFRESH_STATE_ID = 'global';
// Emperor's documented limit is ~2 req/min sustained (one request per ~30s) —
// 2s is only safe in normal steady-state, where a run makes 0-1 requests
// because there's rarely more than one new session between cron ticks. A
// backfill burst of many requests at 2s apart is ~30 req/min and gets 429'd
// (confirmed against ACCSM4). This mirrors the same wrong assumption in the
// AC Evo cron's comment, carried over — that one's steady-state is small
// enough it never triggers the bug.
// TEMPORARY for the backfill run: matches Emperor's real ~2 req/min limit.
// Revert to 2_000 after — steady-state is 0-1 requests per run so the gap
// barely matters there.
// const CRON_REQUEST_INTERVAL_MS = 2_000;
const CRON_REQUEST_INTERVAL_MS = 31_000;

// Caps how many new sessions get downloaded per server per run. There's no
// backfill script for ACC (unlike AC Evo), so on a cold start every entry on
// page 0 looks "new" at once — without this cap, a 20-entry backlog at 2s/
// request would take 40+s, risking a Vercel function timeout and hammering
// Emperor in one burst. Newest entries are processed first (list is
// newest-first); anything left over stays unprocessed and is simply picked
// up on the next run, so a big backlog drains gradually instead of all at
// once or never (see git history for the all-or-nothing guard this replaced).
// TEMPORARY: raised to 20 to backfill car_model_id into existing rows and pull
// in the rest of page 0's backlog in one go. Revert to 5 after this populate run.
// const MAX_SESSIONS_PER_SERVER_PER_RUN = 5;
const MAX_SESSIONS_PER_SERVER_PER_RUN = 20;

export type AccIncrementalRefreshResult = {
  processed: number;
  tracks: string[];
  durationMs: number;
};

// Shared by the cron route. Acquires the DB lock before running so concurrent
// callers (multiple server instances, or an overlapping manual trigger) don't
// pile onto Emperor. Returns null when the lock is genuinely already held.
// Throws (rather than returning null) when the lock query itself fails — e.g.
// acc_hotlap_refresh_state doesn't exist yet — so that case isn't silently
// reported as "refresh already in progress" by the cron route.
export async function refreshWithLock(): Promise<AccIncrementalRefreshResult | null> {
  const reclaimableBefore = new Date(Date.now() - LOCK_RECLAIM_MS).toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from('acc_hotlap_refresh_state')
    .update({ refresh_started_at: new Date().toISOString() })
    .eq('id', REFRESH_STATE_ID)
    .or(`refresh_started_at.is.null,refresh_started_at.lt.${reclaimableBefore}`)
    .select();

  if (claimError) {
    throw new Error(`ACC hot-lap refresh lock acquisition failed: ${claimError.message}`);
  }
  if (!claimed || claimed.length === 0) return null; // another caller holds the lock

  try {
    return await runIncrementalRefresh();
  } catch (err) {
    console.error('ACC hot-lap incremental refresh failed:', err);
    return { processed: 0, tracks: [], durationMs: 0 };
  } finally {
    await releaseLock();
  }
}

// Loops over every configured ACCSM server (currently just ACCSM4), fetching
// only page 0 of each server's results list (newest-first, same assumption as
// AC Evo — see scripts/check-emperor-page-order.ts) and processing sessions
// not yet in acc_processed_sessions.
async function runIncrementalRefresh(): Promise<AccIncrementalRefreshResult> {
  const startedAt = Date.now();
  const processedTracks = new Set<string>();
  let processedCount = 0;

  // Cutoff = wall-clock time of the last completed cron run
  // (acc_hotlap_refresh_state.updated_at, set by releaseLock() below — the
  // claim UPDATE in refreshWithLock only touches refresh_started_at, so this
  // still holds the previous run's completion time here). Per-request choice:
  // any backlog entry older than this that a prior run's
  // MAX_SESSIONS_PER_SERVER_PER_RUN cap left unprocessed will not be picked
  // up by this filter — only the URL-registry check below still catches it,
  // and only as long as it's still present on page 0.
  const { data: refreshState, error: refreshStateErr } = await supabase
    .from('acc_hotlap_refresh_state')
    .select('updated_at')
    .eq('id', REFRESH_STATE_ID)
    .maybeSingle();
  if (refreshStateErr) {
    console.error('ACC hot-lap refresh: last-run lookup failed:', refreshStateErr);
  }
  const lastRunMs = refreshState?.updated_at ? new Date(refreshState.updated_at).getTime() : 0;

  for (const baseUrl of EMPEROR_ACC_BASE_URLS) {
    const client = new EmperorClient(baseUrl, { minRequestIntervalMs: CRON_REQUEST_INTERVAL_MS });

    const { entries } = await client.getResultsList(0);

    // Cheap pre-filter before even querying the URL registry: anything at or
    // before the last cron run's completion time predates this run's window.
    const candidateEntries = entries.filter((e) => new Date(e.date).getTime() > lastRunMs);
    if (candidateEntries.length === 0) continue;

    const allUrls = candidateEntries.map((e) => e.resultsJsonUrl);
    const { data: knownRows, error: knownError } = await supabase
      .from('acc_processed_sessions')
      .select('session_url')
      .in('session_url', allUrls);

    if (knownError) {
      console.error(`ACC hot-lap refresh: known-sessions lookup failed for ${baseUrl}:`, knownError);
      continue;
    }

    const knownUrls = new Set((knownRows ?? []).map((r) => r.session_url as string));

    // Still can't assume a clean "unprocessed prefix, then already-processed
    // rest" boundary — MAX_SESSIONS_PER_SERVER_PER_RUN means a run can leave
    // older candidates unprocessed while a newer one right before them (in
    // this newest-first list) already got marked done. Check every candidate
    // rather than stopping at the first known one.
    const newEntries = candidateEntries.filter((e) => !knownUrls.has(e.resultsJsonUrl));

    if (newEntries.length === 0) continue;

    // Unlike the AC Evo cron, there's no backfill script for ACC — this cron
    // is the only ingestion path, and this never reaches further back than
    // page 0 regardless. Cap what gets processed this run (see
    // MAX_SESSIONS_PER_SERVER_PER_RUN) — a big first-run backlog drains over
    // several runs rather than all at once or never.
    const toProcess = newEntries.slice(0, MAX_SESSIONS_PER_SERVER_PER_RUN);
    if (newEntries.length > toProcess.length) {
      console.log(
        `ACC hot-lap refresh: ${newEntries.length} new session(s) for ${baseUrl}, processing ${toProcess.length} this run — remainder picked up next run`,
      );
    }

    for (const entry of toProcess) {
      try {
        const raw = await client.downloadResult(entry.resultsJsonUrl);
        const session = parseAccSession(raw);

        await upsertTrackAndLeaderboard(entry.track, session);

        const { error: markErr } = await supabase.from('acc_processed_sessions').insert({
          session_url: entry.resultsJsonUrl,
          track: entry.track,
          session_type: entry.sessionType,
          session_date: entry.date,
        });
        if (markErr) throw markErr;

        processedTracks.add(entry.track);
        processedCount++;
        console.log(`ACC hot-lap refresh: processed [${entry.sessionType}] ${entry.track} @ ${entry.date} (${baseUrl})`);
      } catch (err) {
        // Don't let one session abort the rest — its URL stays unmarked, so
        // the next run retries it.
        console.error(`ACC hot-lap refresh: failed to process ${entry.resultsJsonUrl}:`, err);
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  console.log(`ACC hot-lap refresh: done — ${processedCount} session(s) in ${Math.round(durationMs / 1000)}s`);
  return { processed: processedCount, tracks: [...processedTracks], durationMs };
}

// Ensures the track exists in acc_tracks (placeholder display_name = the raw
// track key if not already seeded — curate the real name/splash art later),
// then merges this session's best laps into acc_hotlap_leaderboard, only
// keeping a driver's fastest time per (track, carGroup).
async function upsertTrackAndLeaderboard(track: string, session: AccSessionResult): Promise<void> {
  const { error: trackErr } = await supabase
    .from('acc_tracks')
    .upsert({ track_key: track, display_name: track }, { onConflict: 'track_key', ignoreDuplicates: true });
  if (trackErr) throw trackErr;

  const fresh = aggregateAccHotLapLeaderboard([session]);
  const carGroups = new Set(fresh.map((e) => e.carGroup));

  for (const carGroup of carGroups) {
    const { data: existing, error: readErr } = await supabase
      .from('acc_hotlap_leaderboard')
      .select('steam_id, driver_name, car_model, car_model_id, best_lap_ms, sectors_ms')
      .eq('track_key', track)
      .eq('car_group', carGroup);
    if (readErr) throw readErr;

    const bySteamId = new Map(
      (existing ?? []).map((r) => [
        r.steam_id as string,
        {
          steamId: r.steam_id as string,
          driverName: r.driver_name as string,
          carModel: r.car_model as string | null,
          carModelId: r.car_model_id as number | null,
          bestLapMs: r.best_lap_ms as number,
          sectorsMs: r.sectors_ms as number[] | null,
        },
      ]),
    );

    for (const entry of fresh.filter((e) => e.carGroup === carGroup)) {
      const prev = bySteamId.get(entry.steamId);
      if (!prev || entry.bestLapMs < prev.bestLapMs) {
        bySteamId.set(entry.steamId, {
          steamId: entry.steamId,
          driverName: entry.driverName,
          carModel: entry.carModelName,
          carModelId: entry.carModel,
          bestLapMs: entry.bestLapMs,
          sectorsMs: entry.sectorsMs,
        });
      }
    }

    const rows = [...bySteamId.values()].map((e) => ({
      track_key: track,
      car_group: carGroup,
      steam_id: e.steamId,
      driver_name: e.driverName,
      car_model: e.carModel,
      car_model_id: e.carModelId,
      best_lap_ms: e.bestLapMs,
      sectors_ms: e.sectorsMs,
      updated_at: new Date().toISOString(),
    }));

    const { error: writeErr } = await supabase
      .from('acc_hotlap_leaderboard')
      .upsert(rows, { onConflict: 'track_key,car_group,steam_id' });
    if (writeErr) throw writeErr;
  }
}

async function releaseLock(): Promise<void> {
  const { error } = await supabase
    .from('acc_hotlap_refresh_state')
    .update({ refresh_started_at: null, updated_at: new Date().toISOString() })
    .eq('id', REFRESH_STATE_ID);
  if (error) {
    console.error('ACC hot-lap refresh lock release failed:', error);
  }
}
