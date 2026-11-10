// ONE-OFF BACKFILL SCRIPT — not production code.
//
// Fills acc_qualifying_results (the Pole Positions board) for history: the
// qualifying files paired with a GT3 race (gt3_race_qualifying — ~720 files,
// see supabase/migrations/20261110_site_stats_km_poles_tracks_cars.sql).
// Those files are already in the lap ledger, which keeps lap counts only, so
// each is re-downloaded from Emperor for its leaderboard. New Q sessions are
// handled by the cockpit cron, so this only needs running once.
//
// Resumable: the target list excludes files that already have rows, so a
// stopped run just picks up where it left off — re-run the same command.
// Run AFTER the nightly refresh has built race_participation (it has).
//
// Run (from apps/cockpit):
//   pnpm exec tsx scripts/backfill-acc-qualifying.ts [--dry-run]

import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { EmperorClient } from '@sra/emperor-client';
import { buildLapLedgerFile, ingestQualifyingInto, type LapLedgerFile } from '@/lib/acc/lap-ledger-store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../.env.local') });

const dryRun = process.argv.includes('--dry-run');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}
// Same ws polyfill + cast as backfill-acc-sessions.ts (see the note there).
const supabaseOptions = { realtime: { transport: ws } } as unknown as Parameters<typeof createClient>[2];
const supabase = createClient(supabaseUrl, supabaseKey, supabaseOptions);

// Same pacing/backoff as backfill-acc-lap-ledger.ts.
const REQUEST_INTERVAL_MS = 2_000;
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 30_000;
const BATCH_SIZE = 25;

// 'accsm1:server_0/261109_213207_Q' → host + Emperor download URL.
const FILE_KEY = /^(accsm\d+):server_(\d+)\/(\d{6}_\d{6}_[A-Za-z0-9]+)$/;
function toEmperor(fileKey: string): { host: string; url: string } | null {
  const m = FILE_KEY.exec(fileKey);
  if (!m) return null;
  return { host: `https://${m[1]}.simracingalliance.com`, url: `/server/${m[2]}/results/download/${m[3]}.json` };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function downloadWithRetry(client: EmperorClient, url: string): Promise<unknown> {
  let backoff = INITIAL_BACKOFF_MS;
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.downloadResult(url);
    } catch (err) {
      if (errorMessage(err).includes('429') && attempt < MAX_RETRIES) {
        console.warn(`  429 on ${url}, backing off ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(backoff);
        backoff *= 2;
        continue;
      }
      throw err;
    }
  }
}

type Totals = { attempted: number; written: number; empty: number; failed: number; total: number };

async function runHost(host: string, urls: string[], totals: Totals): Promise<void> {
  const client = new EmperorClient(host, { minRequestIntervalMs: REQUEST_INTERVAL_MS });
  let batch: LapLedgerFile[] = [];
  const flush = async () => {
    if (batch.length === 0 || dryRun) {
      batch = [];
      return;
    }
    try {
      totals.written += await ingestQualifyingInto(supabase, batch);
    } catch (err) {
      totals.failed += batch.length;
      console.error(`  [${host}] batch write failed (${batch.length} files): ${errorMessage(err)}`);
    }
    batch = [];
  };

  for (const url of urls) {
    totals.attempted++;
    try {
      const file = buildLapLedgerFile(host, url, await downloadWithRetry(client, url));
      if (!file || file.qualifying.length === 0) {
        totals.empty++;
        console.warn(`  [${host}] no qualifying leaderboard in ${url}`);
      } else {
        batch.push(file);
        if (batch.length >= BATCH_SIZE) await flush();
      }
    } catch (err) {
      totals.failed++;
      console.error(`  FAILED [${host}] ${url}: ${errorMessage(err)}`);
    }
    if (totals.attempted % 50 === 0) {
      console.log(`progress: ${totals.attempted}/${totals.total} — written=${totals.written} failed=${totals.failed}`);
    }
  }
  await flush();
}

async function main(): Promise<void> {
  console.log(`Backfilling ACC qualifying results for GT3 poles${dryRun ? ' (DRY RUN — no writes)' : ''}`);

  const { data, error } = await supabase.rpc('acc_qualifying_backfill_targets');
  if (error) throw new Error(`acc_qualifying_backfill_targets failed: ${error.message}`);
  const keys = ((data ?? []) as Array<{ file_key: string }>).map((r) => r.file_key);

  const byHost = new Map<string, string[]>();
  let unmappable = 0;
  for (const key of keys) {
    const target = toEmperor(key);
    if (!target) {
      unmappable++;
      continue;
    }
    const list = byHost.get(target.host) ?? [];
    list.push(target.url);
    byHost.set(target.host, list);
  }

  const total = keys.length - unmappable;
  console.log(
    `targets=${keys.length} unmappable=${unmappable} ` +
      `(${[...byHost].map(([h, l]) => `${new URL(h).hostname.split('.')[0]}:${l.length}`).join(', ')})\n`,
  );
  if (total === 0) return;

  const totals: Totals = { attempted: 0, written: 0, empty: 0, failed: 0, total };
  const startedAt = Date.now();
  await Promise.all([...byHost].map(([host, urls]) => runHost(host, urls, totals)));

  console.log('\n--- SUMMARY ---');
  console.log(`Attempted: ${totals.attempted}`);
  console.log(`Written:   ${totals.written}${dryRun ? ' (dry run)' : ''}`);
  console.log(`No board:  ${totals.empty}`);
  console.log(`Failed:    ${totals.failed}`);
  console.log(`Duration:  ${Math.round((Date.now() - startedAt) / 60_000)}m`);
  if (totals.failed > 0) console.log('Re-run the same command to retry failures — completed files are skipped.');
  console.log('Poles appear after the next nightly refresh (or: select public.refresh_site_stats();).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
