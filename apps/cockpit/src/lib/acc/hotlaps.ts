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
const CRON_REQUEST_INTERVAL_MS = 5000;

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

// Loops over every configured ACCSM server (accsm1-7, see
// EMPEROR_ACC_BASE_URLS), fetching only page 0 of each server's results list
// (newest-first, same assumption as AC Evo — see
// scripts/check-emperor-page-order.ts) and processing sessions not yet in
// acc_processed_sessions. New tracks (e.g. a quick-race venue) are
// auto-created with a placeholder name by upsertTrackAndLeaderboard.
async function runIncrementalRefresh(): Promise<AccIncrementalRefreshResult> {
  const startedAt = Date.now();
  const processedTracks = new Set<string>();
  let processedCount = 0;

  for (const baseUrl of EMPEROR_ACC_BASE_URLS) {
    try {
      const client = new EmperorClient(baseUrl, { minRequestIntervalMs: CRON_REQUEST_INTERVAL_MS });

      const { entries } = await client.getResultsList(0);
      if (entries.length === 0) continue;

      // Registry check is the sole source of truth for "already processed" —
      // page 0 is capped at ~20 entries, so checking every one is cheap. An
      // earlier version pre-filtered by wall-clock date (last run's
      // completion time) before this check, as an optimization; that silently
      // and permanently orphaned any entry whose results.json appeared later
      // than its embedded session date, or that a prior run's cap/error left
      // behind — once the cutoff advanced past it, it was never picked up
      // again. Confirmed happening in practice (Nurburgring FP posted
      // 2026-07-22T18:13:41Z, still unprocessed, excluded because a later run
      // had already bumped the cutoff past it).
      const allUrls = entries.map((e) => e.resultsJsonUrl);
      const { data: knownRows, error: knownError } = await supabase
        .from('acc_processed_sessions')
        .select('session_url')
        .in('session_url', allUrls);

      if (knownError) {
        console.error(`ACC hot-lap refresh: known-sessions lookup failed for ${baseUrl}:`, knownError);
        continue;
      }

      const knownUrls = new Set((knownRows ?? []).map((r) => r.session_url as string));

      // Can't assume a clean "unprocessed prefix, then already-processed
      // rest" boundary — MAX_SESSIONS_PER_SERVER_PER_RUN means a run can leave
      // older entries unprocessed while a newer one right before them (in
      // this newest-first list) already got marked done. Check every entry
      // rather than stopping at the first known one.
      const newEntries = entries.filter((e) => !knownUrls.has(e.resultsJsonUrl));

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
    } catch (err) {
      // Don't let one unreachable/not-yet-live server (e.g. accsm1-3/5-7
      // before they're brought online) abort the rest of the server list.
      console.error(`ACC hot-lap refresh: server ${baseUrl} failed:`, err);
    }
  }

  const durationMs = Date.now() - startedAt;
  console.log(`ACC hot-lap refresh: done — ${processedCount} session(s) in ${Math.round(durationMs / 1000)}s`);
  return { processed: processedCount, tracks: [...processedTracks], durationMs };
}

// Ensures the track exists in acc_tracks (placeholder display_name = the raw
// track key if not already seeded — curate the real name/splash art later),
// then merges this session's best laps into acc_hotlap_leaderboard, keeping
// a driver's fastest time per (track, car) — not collapsed to one
// all-time-best per driver, so switching cars doesn't discard their best
// time in the one they left (see acc_hotlap_leaderboard's composite PK,
// supabase/migrations/20260725b_acc_hotlap_drop_car_group.sql).
//
// car_group/class is intentionally NOT stored here at all — it's a pure
// function of car_model_id (see accCarClassName in
// packages/domain/src/acc/acc-constants.ts), and persisting a derived value
// goes stale the moment that lookup table is corrected (confirmed: this
// happened twice to Oulton Park's TCX/GTC cars within the same session).
// Every consumer derives class fresh from car_model_id instead.
async function upsertTrackAndLeaderboard(track: string, session: AccSessionResult): Promise<void> {
  const { error: trackErr } = await supabase
    .from('acc_tracks')
    .upsert({ track_key: track, display_name: track }, { onConflict: 'track_key', ignoreDuplicates: true });
  if (trackErr) throw trackErr;

  // Phase 1 of the tracks/track_layouts migration (see
  // supabase/migrations/20260722_shared_tracks_and_acevo_v2_cache.sql).
  // ACC has no layout concept, so layout_key === base_track_key here — no
  // key-format change, no risk to acc_hotlap_leaderboard's existing rows.
  // Never allowed to break the legacy acc_tracks upsert above.
  try {
    await supabase
      .from('tracks')
      .upsert({ base_track_key: track, display_name: track }, { onConflict: 'base_track_key', ignoreDuplicates: true })
      .throwOnError();
    await supabase
      .from('track_layouts')
      .upsert(
        { layout_key: track, base_track_key: track, game: 'ACC', layout_name: null, display_name: track },
        { onConflict: 'layout_key', ignoreDuplicates: true },
      )
      .throwOnError();
  } catch (v2Err) {
    console.error(`ACC tracks/track_layouts dual-write failed for "${track}":`, v2Err);
  }

  const fresh = aggregateAccHotLapLeaderboard([session]);

  const { data: existing, error: readErr } = await supabase
    .from('acc_hotlap_leaderboard')
    .select('steam_id, driver_name, car_model, car_model_id, best_lap_ms, sectors_ms')
    .eq('track_key', track);
  if (readErr) throw readErr;

  // Keyed by (steamId, carModelId) — a driver's fastest lap in each car is
  // tracked independently (see acc_hotlap_leaderboard's composite PK).
  const bestByKey = new Map(
    (existing ?? []).map((r) => [
      `${r.steam_id}:${r.car_model_id}`,
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

  for (const entry of fresh) {
    const key = `${entry.steamId}:${entry.carModel}`;
    const prev = bestByKey.get(key);
    if (!prev || entry.bestLapMs < prev.bestLapMs) {
      bestByKey.set(key, {
        steamId: entry.steamId,
        driverName: entry.driverName,
        carModel: entry.carModelName,
        carModelId: entry.carModel,
        bestLapMs: entry.bestLapMs,
        sectorsMs: entry.sectorsMs,
      });
    }
  }

  const rows = [...bestByKey.values()].map((e) => ({
    track_key: track,
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
    .upsert(rows, { onConflict: 'track_key,steam_id,car_model_id' });
  if (writeErr) throw writeErr;
}

export type AccBackfillResult = {
  results: Array<{ baseUrl: string; replayed: number; total: number; error?: string }>;
  durationMs: number;
};

const BACKFILL_RETRY_ON_429 = 3;
const BACKFILL_RETRY_BACKOFF_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A 5s interval is well above Emperor's documented ~2 req/min sustained
// limit — a 2s interval previously triggered 429s against this same
// infrastructure (see CRON_REQUEST_INTERVAL_MS's history above). Retrying
// with backoff means a rate-limit hit costs time, not the rest of that
// server's backfill.
async function downloadWithRetry(client: EmperorClient, url: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.downloadResult(url);
    } catch (err) {
      const is429 = err instanceof Error && err.message.includes('429');
      if (!is429 || attempt >= BACKFILL_RETRY_ON_429) throw err;
      console.warn(`ACC backfill: rate-limited on ${url}, backing off ${BACKFILL_RETRY_BACKOFF_MS}ms (attempt ${attempt + 1})`);
      await sleep(BACKFILL_RETRY_BACKOFF_MS);
    }
  }
}

// One-time-use recovery: replays every entry on the given results-list page
// (~20 results per server per page; page 0 = most recent) through
// upsertTrackAndLeaderboard regardless of whether it's already in
// acc_processed_sessions — never touches that registry, so this can't affect
// what the normal incremental cron considers "new". Exists because the
// pre-per-car-key leaderboard (before
// supabase/migrations/20260725_acc_hotlap_per_car.sql) silently discarded a
// driver's lap in one car whenever a faster lap in a different car of the
// same class came in — those discarded laps aren't recoverable by the
// normal cron, since it only ever looks at genuinely-new sessions. Re-running
// this (or calling it again with a different page) is always safe (every
// write is the same idempotent upsert as the live cron uses) — callers
// should target a specific not-yet-covered page (e.g. page 1 after page 0's
// already been backfilled) rather than re-requesting page 0 again, since
// each page costs a full round of downloads.
//
// Servers run concurrently — each EmperorClient instance has its own
// independent rate-limit clock, so hitting all of them at once doesn't
// compound wait time the way the old sequential loop did. Not guarded by
// the refresh lock: safe to run alongside the normal incremental cron.
export async function backfillRecentSessions(page = 0): Promise<AccBackfillResult> {
  const startedAt = Date.now();

  const results = await Promise.all(
    EMPEROR_ACC_BASE_URLS.map(async (baseUrl) => {
      const client = new EmperorClient(baseUrl, { minRequestIntervalMs: CRON_REQUEST_INTERVAL_MS });

      let entries;
      try {
        ({ entries } = await client.getResultsList(page));
      } catch (err) {
        return {
          baseUrl,
          replayed: 0,
          total: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      let replayed = 0;
      for (const entry of entries) {
        try {
          const raw = await downloadWithRetry(client, entry.resultsJsonUrl);
          const session = parseAccSession(raw);
          await upsertTrackAndLeaderboard(entry.track, session);
          replayed++;
        } catch (err) {
          console.error(`ACC backfill: failed on ${baseUrl}${entry.resultsJsonUrl}:`, err);
        }
      }
      return { baseUrl, replayed, total: entries.length };
    }),
  );

  return { results, durationMs: Date.now() - startedAt };
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
