// ONE-OFF BACKFILL SCRIPT — not production code.
//
// Replays historical ACC Race/Qualifying results into acc_race_sessions_staging
// (see supabase/migrations/20260811_acc_race_sessions_staging.sql — run that
// migration in the Supabase SQL editor before using this script), driven by
// accsm_survey_manifest (populated from survey-accsm-history.ts's CSV output).
//
// Deliberately writes to the staging table, never acc_race_sessions —
// promoting staged rows is a separate, later step. Does NOT touch the cron,
// hotlaps.ts, or acc_processed_sessions.
//
// Run (from apps/cockpit):
//   pnpm exec tsx scripts/backfill-acc-sessions.ts [--limit N] [--dry-run]

import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { EmperorClient } from '@sra/emperor-client';
import { parseAccSession } from '@sra/domain';
import { ingestAccRaceSessionInto } from '@/lib/acc/ingest-session';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../.env.local') });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit'));
let limit: number | undefined;
if (limitArg) {
  const value = limitArg.includes('=') ? limitArg.split('=')[1] : args[args.indexOf(limitArg) + 1];
  limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) {
    console.error(`Invalid --limit value: ${value}`);
    process.exit(1);
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}
// Node 20 has no native WebSocket global usable by supabase-js's realtime
// client, hence the 'ws' polyfill — but apps/cockpit's tsconfig includes the
// 'dom' lib (for the Next.js app), whose ambient WebSocket type doesn't
// structurally match 'ws' package's. Not an actual type-safety concern: we
// never use realtime, this only exists so the client can construct without
// throwing (see the same pattern in scripts/backfill-acc-results.ts, which
// isn't under this tsconfig's stricter 'dom' lib and needs no cast).
const supabaseOptions = { realtime: { transport: ws } } as unknown as Parameters<typeof createClient>[2];
const supabase = createClient(supabaseUrl, supabaseKey, supabaseOptions);

// Same pacing as the survey walk (see survey-accsm-history.ts) — a sustained
// walk at this rate produced zero 429s at similar volume; the retry/backoff
// below stays in place in case download volume trips it anyway.
const REQUEST_INTERVAL_MS = 2_000;
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 30_000;
const PROGRESS_INTERVAL = 25;

type ManifestRow = {
  host: string;
  session_date: string;
  session_type: string;
  track: string;
  results_url: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function is429(err: unknown): boolean {
  return err instanceof Error && err.message.includes('429');
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Mirrors survey-accsm-history.ts's fetchPageWithRetry: wait, retry, double
// the wait, up to MAX_RETRIES — this infrastructure 429s under sustained
// load and always has, so giving up on the first hit would poison the
// manifest row with a transient error instead of the real result.
async function downloadWithRetry(client: EmperorClient, url: string): Promise<unknown> {
  let backoff = INITIAL_BACKOFF_MS;

  for (let attempt = 0; ; attempt++) {
    try {
      return await client.downloadResult(url);
    } catch (err) {
      if (is429(err) && attempt < MAX_RETRIES) {
        console.warn(`  429, backing off ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(backoff);
        backoff *= 2;
        continue;
      }
      throw err;
    }
  }
}

async function markManifestRow(
  row: ManifestRow,
  status: 'ok' | 'error',
  errorText: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('accsm_survey_manifest')
    .update({
      backfill_status: status,
      backfill_error: errorText,
      backfilled_at: new Date().toISOString(),
    })
    .eq('host', row.host)
    .eq('results_url', row.results_url);
  if (error) {
    // Don't let a manifest-write failure abort the run — the session itself
    // (if status is 'ok') is already staged; the row just stays retryable.
    console.error(`  manifest update failed for ${row.host}${row.results_url}: ${error.message}`);
  }
}

async function main(): Promise<void> {
  console.log(
    `Backfilling ACC Race/Qualifying sessions into acc_race_sessions_staging` +
      (dryRun ? ' (DRY RUN — no writes)' : '') +
      (limit ? ` (limit ${limit})` : ''),
  );

  let query = supabase
    .from('accsm_survey_manifest')
    .select('host, session_date, session_type, track, results_url')
    .in('session_type', ['Race', 'Qualifying'])
    .is('backfill_status', null)
    .order('session_date', { ascending: true });
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    console.error(`Failed to read accsm_survey_manifest: ${error.message}`);
    console.error('Has the migration in supabase/migrations/20260811_acc_race_sessions_staging.sql been run, and does accsm_survey_manifest exist?');
    process.exit(1);
  }

  const rows = (data ?? []) as ManifestRow[];
  console.log(`${rows.length} session(s) to process\n`);
  if (rows.length === 0) return;

  const clients = new Map<string, EmperorClient>();
  function clientFor(host: string): EmperorClient {
    let client = clients.get(host);
    if (!client) {
      client = new EmperorClient(host, { minRequestIntervalMs: REQUEST_INTERVAL_MS });
      clients.set(host, client);
    }
    return client;
  }

  const startedAt = Date.now();
  let attempted = 0;
  let ok = 0;
  let errorCount = 0;
  const errorFrequency = new Map<string, number>();

  for (const row of rows) {
    attempted++;
    try {
      const client = clientFor(row.host);
      const raw = await downloadWithRetry(client, row.results_url);
      const session = parseAccSession(raw);

      if (!dryRun) {
        await ingestAccRaceSessionInto(supabase, 'acc_race_sessions_staging', session, row.results_url);
        await markManifestRow(row, 'ok', null);
      }
      ok++;
    } catch (err) {
      const message = errorMessage(err);
      errorCount++;
      errorFrequency.set(message, (errorFrequency.get(message) ?? 0) + 1);
      console.error(`  FAILED [${row.host}] ${row.track} @ ${row.session_date}: ${message}`);
      if (!dryRun) {
        await markManifestRow(row, 'error', message);
      }
    }

    if (attempted % PROGRESS_INTERVAL === 0 || attempted === rows.length) {
      const elapsedS = Math.round((Date.now() - startedAt) / 1000);
      console.log(
        `progress: ${attempted}/${rows.length} attempted — ok=${ok} error=${errorCount} — ${elapsedS}s elapsed`,
      );
    }
  }

  console.log('\n--- SUMMARY ---');
  console.log(`Attempted: ${attempted}`);
  console.log(`OK:        ${ok}`);
  console.log(`Errors:    ${errorCount}`);
  if (errorFrequency.size > 0) {
    console.log('\nError breakdown (most frequent first):');
    const sorted = [...errorFrequency.entries()].sort((a, b) => b[1] - a[1]);
    for (const [message, count] of sorted) {
      console.log(`  ${count}x  ${message}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
