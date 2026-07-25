// ONE-OFF BACKFILL SCRIPT — pulls the N most recent Race sessions (and their
// paired Qualifying sessions only — no Practice) from a single ACCSM server
// into acc_race_sessions, for the /results feature.
//
// Deliberately narrow: does NOT touch acc_hotlap_leaderboard or
// acc_processed_sessions. The live cron (/api/cron/refresh-acc-leaderboard,
// apps/cockpit/src/lib/acc/hotlaps.ts) owns those independently and will see
// these same sessions on page 0 on its own next run regardless of what this
// script does — this only needs to backfill the race-results table sooner.
//
// Run: pnpm exec tsx scripts/backfill-acc-results.ts <accsm-base-url> [raceCount]
// Example: pnpm exec tsx scripts/backfill-acc-results.ts https://accsm2.simracingalliance.com 2

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { EmperorClient } from '../packages/emperor-client/src/index.js';
import { parseAccSession, computeAccEventKey } from '../packages/domain/src/index.js';
import type { AccSessionResult } from '../packages/shared-types/src/index.js';
import type { EmperorResultListEntry } from '../packages/shared-types/src/index.js';

const BASE_URL = process.argv[2];
const RACE_COUNT = Number(process.argv[3] ?? 2);

if (!BASE_URL) {
  console.error('Usage: pnpm exec tsx scripts/backfill-acc-results.ts <accsm-base-url> [raceCount]');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: ws } });

// Default client throttling (31s/request) already matches Emperor's ~2 req/min
// documented sustained limit — this is a handful of requests, no override needed.
const client = new EmperorClient(BASE_URL);

const RETRY_ON_429 = 3;
const RETRY_BACKOFF_MS = 15_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mirrors hotlaps.ts's downloadWithRetry — 429s are a known occasional
// reality against this infrastructure even under conservative spacing.
async function downloadWithRetry(url: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.downloadResult(url);
    } catch (err) {
      const is429 = err instanceof Error && err.message.includes('429');
      if (!is429 || attempt >= RETRY_ON_429) throw err;
      console.warn(`  rate-limited, backing off ${RETRY_BACKOFF_MS}ms (attempt ${attempt + 1})`);
      await sleep(RETRY_BACKOFF_MS);
    }
  }
}

async function ensureTrack(track: string): Promise<void> {
  await supabase
    .from('acc_tracks')
    .upsert({ track_key: track, display_name: track }, { onConflict: 'track_key', ignoreDuplicates: true })
    .throwOnError();
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
}

async function ingest(session: AccSessionResult, sessionKey: string): Promise<void> {
  await ensureTrack(session.track);
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

async function main(): Promise<void> {
  console.log(`Fetching results list (page 0) from ${BASE_URL}...`);
  const { entries } = await client.getResultsList(0); // newest-first

  const raceEntries = entries.filter((e) => e.sessionType === 'R').slice(0, RACE_COUNT);
  if (raceEntries.length === 0) {
    console.log('No Race sessions found on page 0 — nothing to do.');
    return;
  }
  console.log(`Selected ${raceEntries.length} most recent race(s):`);
  for (const e of raceEntries) console.log(`  [R] ${e.track} @ ${e.date}`);

  // Download the selected races first so we know their event keys — that's
  // what determines which Qualifying entries actually belong to them.
  const raceEventKeys = new Set<string>();
  for (const entry of raceEntries) {
    console.log(`Downloading race: ${entry.track} @ ${entry.date}...`);
    const raw = await downloadWithRetry(entry.resultsJsonUrl);
    const session = parseAccSession(raw);
    await ingest(session, entry.resultsJsonUrl);
    raceEventKeys.add(computeAccEventKey(session));
    console.log(`  ✓ ingested (${session.results.length} driver result(s))`);
  }

  // Candidate qualifying entries: same track as one of the selected races.
  // Bounded to whatever's on this one page (~20 entries) — download and
  // check each against the actual race event keys rather than guessing from
  // list metadata alone, since that's the only reliable way to confirm a Q
  // session belongs to one of these specific races and not an older one at
  // the same track.
  const qualiCandidates: EmperorResultListEntry[] = entries.filter(
    (e) => e.sessionType === 'Q' && raceEntries.some((r) => r.track === e.track),
  );

  let qualiIngested = 0;
  for (const entry of qualiCandidates) {
    console.log(`Checking candidate qualifying: ${entry.track} @ ${entry.date}...`);
    const raw = await downloadWithRetry(entry.resultsJsonUrl);
    const session = parseAccSession(raw);
    if (!raceEventKeys.has(computeAccEventKey(session))) {
      console.log('  — different event, skipping');
      continue;
    }
    await ingest(session, entry.resultsJsonUrl);
    qualiIngested++;
    console.log(`  ✓ ingested (${session.results.length} driver result(s))`);
  }

  console.log(`\nDone: ${raceEntries.length} race(s), ${qualiIngested} qualifying session(s) ingested.`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
