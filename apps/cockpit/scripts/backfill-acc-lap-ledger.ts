// ONE-OFF BACKFILL SCRIPT — not production code.
//
// Replays every historical ACCSM result file (all session types) into the
// lap ledger via Emperor: everything in accsm_survey_manifest (populated by
// survey-accsm-history.ts), plus whatever each host has listed since that
// survey — walked newest-first from page 0 until a page is entirely already
// in the manifest. The cron's ledger hook only sees genuinely new sessions,
// so re-running this after deploying the hook closes the gap in between. Resumable: file_keys already in the ledger are skipped,
// so a stopped run just picks up where it left off — re-run the same command.
// Never touches accsm_survey_manifest's backfill_status (that belongs to
// backfill-acc-sessions.ts), acc_processed_sessions, or the hot-lap boards.
//
// Run (from apps/cockpit):
//   pnpm exec tsx scripts/backfill-acc-lap-ledger.ts [--limit N] [--dry-run]

import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { EmperorClient } from '@sra/emperor-client';
import { accLedgerFileKeyFromEmperorUrl, accLedgerSourceFromBaseUrl } from '@sra/domain';
import {
  buildLapLedgerFile,
  ingestLapLedgerInto,
  ingestQualifyingInto,
  type LapLedgerFile,
} from '@/lib/acc/lap-ledger-store';

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
// Same ws polyfill + cast as backfill-acc-sessions.ts (see the note there).
const supabaseOptions = { realtime: { transport: ws } } as unknown as Parameters<typeof createClient>[2];
const supabase = createClient(supabaseUrl, supabaseKey, supabaseOptions);

// Survey pacing — a full walk of both hosts at 2s ran with only occasional
// 429s, which the backoff below absorbs. Hosts run concurrently; each
// EmperorClient keeps its own pacing clock.
const REQUEST_INTERVAL_MS = 2_000;
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 30_000;
const BATCH_SIZE = 25;
const PROGRESS_INTERVAL = 100;
const PAGE = 1000;

type ManifestRow = { host: string; results_url: string };

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

// Paged past PostgREST's 1000-row cap with an ORDER BY over a unique key —
// an unpaged read silently returns only the first 1000 rows.
async function readAll<T>(table: string, columns: string, order: string[]): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select(columns);
    for (const col of order) q = q.order(col, { ascending: true });
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw new Error(`read ${table} failed: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

// Results-list entries newer than the manifest snapshot. Pages are
// newest-first; stop at the first page whose entries are all already known.
async function listSinceSurvey(client: EmperorClient, host: string, manifestUrls: Set<string>): Promise<ManifestRow[]> {
  const out: ManifestRow[] = [];
  for (let page = 0; ; page++) {
    let entries;
    for (let attempt = 0; ; attempt++) {
      try {
        ({ entries } = await client.getResultsList(page));
        break;
      } catch (err) {
        if (errorMessage(err).includes('429') && attempt < MAX_RETRIES) {
          await sleep(INITIAL_BACKOFF_MS * 2 ** attempt);
          continue;
        }
        throw err;
      }
    }
    const fresh = entries.filter((e) => !manifestUrls.has(e.resultsJsonUrl));
    out.push(...fresh.map((e) => ({ host, results_url: e.resultsJsonUrl })));
    if (entries.length === 0 || fresh.length === 0) return out;
  }
}

async function runHost(
  client: EmperorClient,
  host: string,
  rows: ManifestRow[],
  totals: { attempted: number; written: number; failed: number; laps: number; total: number },
  startedAt: number,
): Promise<void> {
  let batch: LapLedgerFile[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    if (!dryRun) {
      try {
        totals.written += await ingestLapLedgerInto(supabase, batch);
        // Q files also fill acc_qualifying_results (Pole Positions).
        await ingestQualifyingInto(supabase, batch);
      } catch (err) {
        // Nothing in the batch was written (one transaction); its keys stay
        // unrecorded, so a re-run of the script retries them.
        totals.failed += batch.length;
        console.error(`  [${host}] batch write failed (${batch.length} files): ${errorMessage(err)}`);
      }
    }
    batch = [];
  };

  for (const row of rows) {
    totals.attempted++;
    try {
      const raw = await downloadWithRetry(client, row.results_url);
      const file = buildLapLedgerFile(host, row.results_url, raw);
      if (file) {
        totals.laps += file.drivers.reduce((n, d) => n + d.laps, 0);
        batch.push(file);
        if (batch.length >= BATCH_SIZE) await flush();
      }
    } catch (err) {
      totals.failed++;
      console.error(`  FAILED [${host}] ${row.results_url}: ${errorMessage(err)}`);
    }

    if (totals.attempted % PROGRESS_INTERVAL === 0) {
      const elapsedMin = (Date.now() - startedAt) / 60_000;
      const rate = totals.attempted / Math.max(elapsedMin, 0.01);
      const etaMin = Math.round((totals.total - totals.attempted) / rate);
      console.log(
        `progress: ${totals.attempted}/${totals.total} — written=${totals.written} failed=${totals.failed} ` +
          `laps=${totals.laps.toLocaleString()} — ${Math.round(elapsedMin)}m elapsed, ~${etaMin}m left`,
      );
    }
  }
  await flush();
}

async function main(): Promise<void> {
  console.log(`Backfilling the ACC lap ledger from ACCSM via Emperor${dryRun ? ' (DRY RUN — no writes)' : ''}`);

  const [manifest, known] = await Promise.all([
    readAll<ManifestRow>('accsm_survey_manifest', 'host, results_url', ['host', 'results_url']),
    readAll<{ file_key: string }>('acc_lap_ledger_files', 'file_key', ['file_key']),
  ]);
  const knownKeys = new Set(known.map((r) => r.file_key));

  const clients = new Map<string, EmperorClient>();
  for (const host of new Set(manifest.map((r) => r.host))) {
    clients.set(host, new EmperorClient(host, { minRequestIntervalMs: REQUEST_INTERVAL_MS }));
  }
  const manifestUrls = new Map<string, Set<string>>();
  for (const r of manifest) {
    const set = manifestUrls.get(r.host) ?? new Set<string>();
    set.add(r.results_url);
    manifestUrls.set(r.host, set);
  }
  const recent = (
    await Promise.all(
      [...clients].map(async ([host, client]) => {
        try {
          return await listSinceSurvey(client, host, manifestUrls.get(host)!);
        } catch (err) {
          console.error(`  [${host}] couldn't list sessions since the survey: ${errorMessage(err)}`);
          return [];
        }
      }),
    )
  ).flat();
  console.log(`since-survey entries (not in manifest): ${recent.length}`);

  const byHost = new Map<string, ManifestRow[]>();
  let skippedKnown = 0;
  let unkeyable = 0;
  for (const row of [...manifest, ...recent]) {
    const source = accLedgerSourceFromBaseUrl(row.host);
    const key = source ? accLedgerFileKeyFromEmperorUrl(source, row.results_url) : null;
    if (!key) {
      unkeyable++;
      continue;
    }
    if (knownKeys.has(key)) {
      skippedKnown++;
      continue;
    }
    knownKeys.add(key); // a duplicated manifest row is only fetched once
    const list = byHost.get(row.host) ?? [];
    list.push(row);
    byHost.set(row.host, list);
  }

  // Oldest-first per host; result names sort chronologically within a server.
  for (const list of byHost.values()) {
    list.sort((a, b) => a.results_url.split('/').pop()!.localeCompare(b.results_url.split('/').pop()!));
  }
  if (limit) {
    let left = limit;
    for (const [host, list] of byHost) {
      byHost.set(host, list.slice(0, left));
      left = Math.max(0, left - list.length);
    }
  }

  const total = [...byHost.values()].reduce((n, l) => n + l.length, 0);
  console.log(
    `manifest=${manifest.length} already-recorded=${skippedKnown} unkeyable=${unkeyable} to-fetch=${total} ` +
      `(${[...byHost].map(([h, l]) => `${new URL(h).hostname.split('.')[0]}:${l.length}`).join(', ')})\n`,
  );
  if (total === 0) return;

  const totals = { attempted: 0, written: 0, failed: 0, laps: 0, total };
  const startedAt = Date.now();
  await Promise.all([...byHost].map(([host, rows]) => runHost(clients.get(host)!, host, rows, totals, startedAt)));

  console.log('\n--- SUMMARY ---');
  console.log(`Attempted: ${totals.attempted}`);
  console.log(`Written:   ${totals.written}${dryRun ? ' (dry run)' : ''}`);
  console.log(`Failed:    ${totals.failed}`);
  console.log(`Laps seen: ${totals.laps.toLocaleString()}`);
  console.log(`Duration:  ${Math.round((Date.now() - startedAt) / 60_000)}m`);
  if (totals.failed > 0) console.log('Re-run the same command to retry failures — recorded files are skipped.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
