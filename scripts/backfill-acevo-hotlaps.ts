// ONE-TIME BACKFILL SCRIPT — run locally before deploying the cron.
//
// Processes all historical AC Evo sessions from Emperor and populates:
//   - acevo_hotlap_cache      (per-track aggregated leaderboard)
//   - acevo_round_points_cache (per-track race/qualify points)
//   - acevo_processed_sessions (session registry used by the incremental cron)
//
// Run ONCE before enabling the cron job. After that, the cron handles deltas.
// Safe to re-run: already-processed sessions are skipped via ON CONFLICT DO NOTHING.
//
// Prerequisites — run in Supabase SQL editor first:
//
//   CREATE TABLE acevo_processed_sessions (
//     session_url   TEXT         PRIMARY KEY,
//     track         TEXT         NOT NULL,
//     session_type  TEXT         NOT NULL,
//     session_date  TEXT         NOT NULL,
//     processed_at  TIMESTAMPTZ  DEFAULT now() NOT NULL
//   );
//
// Run: pnpm exec tsx scripts/backfill-acevo-hotlaps.ts

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { EmperorClient } from '../packages/emperor-client/src/index.js';
import {
  parseAcEvoSession,
  aggregateHotLapLeaderboard,
  computeRacePositionPoints,
  computePoleSteamId,
} from '../packages/domain/src/index.js';
import type { HotLapEntry, AcEvoSessionResult } from '../packages/shared-types/src/index.js';

const BASE_URL =
  process.env.EMPEROR_ACEVO_BASE_URL ?? 'https://sram1acevo.emperorservers.com';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: ws } });

// Backfill uses a longer interval — it will make many requests across all pages.
// 32s comfortably stays under Emperor's 2 req/min sustained limit for multi-page traversal.
const REQUEST_INTERVAL_MS = 32_000;

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

async function main(): Promise<void> {
  const client = new EmperorClient(BASE_URL, { minRequestIntervalMs: REQUEST_INTERVAL_MS });

  // Fetch all pages of the results list.
  console.log('Fetching results list from Emperor...');
  const first = await client.getResultsList(0);
  const allEntries = [...first.entries];
  for (let p = 1; p < first.numPages; p++) {
    console.log(`  fetching page ${p}/${first.numPages - 1}...`);
    const page = await client.getResultsList(p);
    allEntries.push(...page.entries);
  }
  console.log(`Found ${allEntries.length} total session(s) across ${first.numPages} page(s).\n`);

  // Find which ones are already processed.
  const allUrls = allEntries.map((e) => e.resultsJsonUrl);
  const { data: knownRows, error: knownError } = await supabase
    .from('acevo_processed_sessions')
    .select('session_url')
    .in('session_url', allUrls);
  if (knownError) throw knownError;

  const knownUrls = new Set((knownRows ?? []).map((r) => r.session_url as string));
  const toProcess = allEntries.filter((e) => !knownUrls.has(e.resultsJsonUrl));
  console.log(`Already processed: ${knownUrls.size}. To process: ${toProcess.length}.\n`);

  if (toProcess.length === 0) {
    console.log('Nothing to do — all sessions already in acevo_processed_sessions.');
    return;
  }

  // Process each new session, committing per-session (cursor advances on success).
  let done = 0;
  for (const entry of toProcess) {
    console.log(`[${done + 1}/${toProcess.length}] [${entry.sessionType}] ${entry.track} @ ${entry.date}`);

    const raw = await client.downloadResult(entry.resultsJsonUrl);
    const session = parseAcEvoSession(raw);

    // Update hot-lap cache.
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

    // Update round-points cache if this is a Race or Qualify session.
    const newRace = latestCompletedSession([session], 'Race');
    const newQualify = latestCompletedSession([session], 'Qualify');

    if (newRace || newQualify) {
      const { data: existingPts, error: ptsReadErr } = await supabase
        .from('acevo_round_points_cache')
        .select('race_position_points, fastest_lap_steam_id, pole_steam_id, race_session_date, qualify_session_date')
        .eq('track_key', entry.track)
        .maybeSingle();
      if (ptsReadErr) throw ptsReadErr;

      let racePositionPoints = (existingPts?.race_position_points as Record<string, number> | null) ?? {};
      let fastestLapSteamId: string | null = existingPts?.fastest_lap_steam_id ?? null;
      let raceSessionDate: string | null = existingPts?.race_session_date ?? null;
      let poleSteamId: string | null = existingPts?.pole_steam_id ?? null;
      let qualifySessionDate: string | null = existingPts?.qualify_session_date ?? null;

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

      const { error: ptsWriteErr } = await supabase.from('acevo_round_points_cache').upsert(
        {
          track_key: entry.track,
          race_position_points: racePositionPoints,
          fastest_lap_steam_id: fastestLapSteamId,
          pole_steam_id: poleSteamId,
          race_session_date: raceSessionDate,
          qualify_session_date: qualifySessionDate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'track_key' },
      );
      if (ptsWriteErr) throw ptsWriteErr;
    }

    // Mark this session as processed.
    const { error: markErr } = await supabase
      .from('acevo_processed_sessions')
      .insert({
        session_url: entry.resultsJsonUrl,
        track: entry.track,
        session_type: entry.sessionType,
        session_date: entry.date,
      });
    if (markErr) throw markErr;

    done++;
    console.log(`  ✓ committed (${session.results.length} driver result(s))`);
  }

  console.log(`\nBackfill complete: ${done} session(s) processed.`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
