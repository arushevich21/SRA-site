// ONE-OFF DIAGNOSTIC SCRIPT — not production code. READ-ONLY: never writes to
// Supabase and never touches acc_processed_sessions.
//
// Walks every ACCSM instance's results list (see EMPEROR_ACC_BASE_URLS) as
// far back as it goes, to determine how much ACC result history actually
// exists per server. Only pulls list metadata (track/session_type/date) —
// individual result JSONs are never downloaded.
//
// Run (from apps/cockpit): pnpm exec tsx scripts/survey-accsm-history.ts

import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EmperorClient } from '@sra/emperor-client';
import { EMPEROR_ACC_BASE_URLS } from '@/lib/emperor';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../.env.local') });

const MAX_PAGES = 3000;
const OUT_DIR = path.resolve(__dirname, 'out');
const OUT_CSV = path.resolve(OUT_DIR, 'accsm-survey.csv');

// A full page confirmed at 25 entries (see toCsv/summary — used to tell "the
// list actually ended here" apart from "we just haven't fetched further").
const PAGE_SIZE = 25;

// 5s was the safe starting point after a 2s pace (the ACC hot-lap cron's
// CRON_REQUEST_INTERVAL_MS) 429'd both accsm1 and accsm2 by page 5 in an
// earlier run. A full ~400-page run at 5s produced zero 429s, so 2s is back
// in play for throughput — the retry/backoff logic above stays regardless,
// in case higher page volume (now up to MAX_PAGES) trips it again.
const SURVEY_REQUEST_INTERVAL_MS = 2_000;

// 429 backoff: wait, retry same page, double the wait, up to this many
// attempts — only give up on the host once these are exhausted.
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 30_000;

type SurveyEntry = {
  host: string;
  resultsJsonUrl: string;
  track: string;
  sessionType: string;
  date: string;
};

type HostResult = {
  host: string;
  entries: SurveyEntry[];
  // True only when the walk reached a genuinely empty page — i.e. this is
  // the actual floor of the host's history, not just where we stopped.
  completed: boolean;
  lastPageFetched: number;
  stopReason: 'empty-page' | 'max-pages-cap' | 'retries-exhausted' | 'error' | 'none';
  error?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function is429(err: unknown): boolean {
  return err instanceof Error && err.message.includes('429');
}

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function entriesToCsvLines(rows: SurveyEntry[]): string {
  return rows
    .map((r) => [r.host, r.date, r.sessionType, r.track, r.resultsJsonUrl].map(csvField).join(','))
    .join('\n');
}

// Serializes checkpoint writes so concurrent host tasks never interleave
// mid-append — appendFileSync itself is synchronous/blocking, so calls from
// different in-flight promises never overlap, but chaining through this
// queue keeps the ordering deterministic and makes the intent explicit.
let writeQueue: Promise<void> = Promise.resolve();
function appendCsvRows(rows: SurveyEntry[]): void {
  if (rows.length === 0) return;
  writeQueue = writeQueue.then(() => {
    fs.appendFileSync(OUT_CSV, entriesToCsvLines(rows) + '\n', 'utf8');
  });
}

async function fetchPageWithRetry(
  client: EmperorClient,
  baseUrl: string,
  page: number,
): Promise<{ entries: SurveyEntry[]; giveUp: boolean; giveUpReason: 'retries-exhausted' | 'error' | 'none' }> {
  let backoff = INITIAL_BACKOFF_MS;

  for (let attempt = 0; ; attempt++) {
    try {
      const result = await client.getResultsList(page);
      return {
        entries: result.entries.map((e) => ({
          host: baseUrl,
          resultsJsonUrl: e.resultsJsonUrl,
          track: e.track,
          sessionType: e.sessionType,
          date: e.date,
        })),
        giveUp: false,
        giveUpReason: 'none',
      };
    } catch (err) {
      if (is429(err) && attempt < MAX_RETRIES) {
        console.warn(
          `[${baseUrl}] page ${page}: 429, backing off ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
        );
        await sleep(backoff);
        backoff *= 2;
        continue;
      }

      console.error(
        `[${baseUrl}] page ${page} failed: ${err instanceof Error ? err.message : String(err)}` +
          (is429(err) ? ' — retries exhausted' : '') +
          ' — stopping',
      );
      return {
        entries: [],
        giveUp: true,
        giveUpReason: is429(err) ? 'retries-exhausted' : 'error',
      };
    }
  }
}

async function surveyHost(baseUrl: string): Promise<HostResult> {
  const client = new EmperorClient(baseUrl, {
    minRequestIntervalMs: SURVEY_REQUEST_INTERVAL_MS,
    resultsListTimeoutMs: 5_000,
  });
  const entries: SurveyEntry[] = [];
  let lastPageFetched = -1;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { entries: pageEntries, giveUp, giveUpReason } = await fetchPageWithRetry(client, baseUrl, page);

    if (giveUp) {
      return {
        host: baseUrl,
        entries,
        completed: false,
        lastPageFetched,
        stopReason: giveUpReason === 'retries-exhausted' ? 'retries-exhausted' : 'error',
      };
    }

    if (pageEntries.length === 0) {
      console.log(`[${baseUrl}] page ${page}: empty — stopping`);
      return { host: baseUrl, entries, completed: true, lastPageFetched, stopReason: 'empty-page' };
    }

    console.log(`[${baseUrl}] page ${page}: ${pageEntries.length} entries`);
    entries.push(...pageEntries);
    appendCsvRows(pageEntries);
    lastPageFetched = page;

    if (page === MAX_PAGES - 1) {
      console.log(`[${baseUrl}] hit MAX_PAGES (${MAX_PAGES}) safety cap — stopping`);
      return {
        host: baseUrl,
        entries,
        completed: false,
        lastPageFetched,
        stopReason: 'max-pages-cap',
      };
    }
  }

  // Unreachable — the loop above always returns.
  return { host: baseUrl, entries, completed: false, lastPageFetched, stopReason: 'none' };
}

async function main(): Promise<void> {
  console.log(
    `Surveying ${EMPEROR_ACC_BASE_URLS.length} ACCSM host(s): ${EMPEROR_ACC_BASE_URLS.join(', ')}\n`,
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_CSV, 'host,session_date,session_type,track,results_url\n', 'utf8');

  const settled = await Promise.allSettled(
    EMPEROR_ACC_BASE_URLS.map((baseUrl) => surveyHost(baseUrl)),
  );

  // Flush the checkpoint queue before reading the file back / reporting done.
  await writeQueue;

  let totalEntries = 0;
  const summary: {
    host: string;
    count: number;
    earliest: string | null;
    latest: string | null;
    completed: boolean;
    lastPageFetched: number;
    lastPageWasFull: boolean;
    stopReason: HostResult['stopReason'];
    error?: string;
  }[] = [];

  settled.forEach((result, i) => {
    const host = EMPEROR_ACC_BASE_URLS[i];
    if (result.status === 'rejected') {
      summary.push({
        host,
        count: 0,
        earliest: null,
        latest: null,
        completed: false,
        lastPageFetched: -1,
        lastPageWasFull: false,
        stopReason: 'error',
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
      return;
    }

    const { entries, completed, lastPageFetched, stopReason } = result.value;
    totalEntries += entries.length;
    const dates = entries.map((e) => e.date).sort();
    const lastPageCount = entries.length % PAGE_SIZE === 0 && entries.length > 0 ? PAGE_SIZE : entries.length % PAGE_SIZE;
    summary.push({
      host,
      count: entries.length,
      earliest: dates[0] ?? null,
      latest: dates[dates.length - 1] ?? null,
      completed,
      lastPageFetched,
      lastPageWasFull: !completed && lastPageCount === PAGE_SIZE,
      stopReason,
    });
  });

  console.log(`\nWrote ${totalEntries} entries to ${OUT_CSV}\n`);

  console.log('--- SUMMARY ---');
  for (const s of summary) {
    if (s.error) {
      console.log(`${s.host}: FAILED — ${s.error}`);
    } else if (s.count === 0) {
      console.log(`${s.host}: no results`);
    } else if (s.completed) {
      console.log(`${s.host}: COMPLETE — ${s.count} entries, ${s.earliest} → ${s.latest} (true floor)`);
    } else {
      const note = s.lastPageWasFull
        ? `NOT fully surveyed — last page (${s.lastPageFetched}) was full, more history likely exists (${s.stopReason})`
        : `stopped at page ${s.lastPageFetched} (${s.stopReason})`;
      console.log(
        `${s.host}: PARTIAL — ${s.count} entries, ${s.earliest} → ${s.latest} — ${note} (do not treat ${s.earliest} as the floor)`,
      );
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
