// Backfill endurance pre-qualifying laps from a pre-qual server's result
// history — for sessions that finished before the cron's pre-qual hook was
// deployed, or that the cron marked processed before the prequal_events row
// existed (it never revisits a processed session).
//
// Walks the ACCSM results list newest-first, keeps only the event's server,
// stops once it's past the window's opening, and feeds each file through the
// SAME ingest the cron uses (apps/cockpit/src/lib/acc/prequal-ingest.ts).
// Idempotent: re-running records nothing twice.
//
// Run from a home connection, not Vercel (ACCSM: 5 req / 20s per IP, and it
// firewall-bans abusers). Paced at one request per 5s.
//
// Run: pnpm exec tsx scripts/backfill-prequal.ts [event-id]   (default: every event)

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { EmperorClient } from '../packages/emperor-client/src/index.js';
import { ingestPrequalLaps, prequalSessionEndedAt } from '../apps/cockpit/src/lib/acc/prequal-ingest.js';

config({ path: 'apps/cockpit/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (apps/cockpit/.env.local)');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: ws } });

const REQUEST_INTERVAL_MS = 5_000;
const MAX_PAGES = 30; // ~600 results per host — far past any two-week window

async function main() {
  const onlyId = process.argv[2];
  let q = supabase.from('prequal_events').select('id, source, server_id, opens_at, closes_at');
  if (onlyId) q = q.eq('id', onlyId);
  const { data: events, error } = await q;
  if (error) throw new Error(`loading prequal_events: ${error.message}`);
  if (!events?.length) {
    console.log('No prequal_events to backfill.');
    return;
  }

  for (const ev of events) {
    const baseUrl = `https://${ev.source}.simracingalliance.com`;
    const client = new EmperorClient(baseUrl, { minRequestIntervalMs: REQUEST_INTERVAL_MS });
    const opensAt = Date.parse(ev.opens_at);
    const prefix = `/server/${ev.server_id}/`;
    console.log(`[${ev.id}] ${baseUrl} server ${ev.server_id}, window ${ev.opens_at} → ${ev.closes_at}`);

    let files = 0;
    let laps = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const { entries, numPages } = await client.getResultsList(page);
      if (entries.length === 0) break;

      for (const e of entries) {
        if (!e.resultsJsonUrl.startsWith(prefix)) continue;
        const endedAt = prequalSessionEndedAt(e.resultsJsonUrl);
        if (!endedAt || endedAt.getTime() < opensAt) continue;
        const raw = await client.downloadResult(e.resultsJsonUrl);
        const n = await ingestPrequalLaps(supabase, baseUrl, e.resultsJsonUrl, raw);
        files++;
        laps += n;
        console.log(`  ${e.resultsJsonUrl}: +${n} lap(s)`);
      }

      // Newest-first: once the oldest entry on this page predates the window,
      // every later page does too.
      const oldest = entries
        .map((e) => prequalSessionEndedAt(e.resultsJsonUrl)?.getTime() ?? Infinity)
        .reduce((a, b) => Math.min(a, b), Infinity);
      if (oldest < opensAt || page + 1 >= numPages) break;
    }
    console.log(`[${ev.id}] done: ${files} file(s) in window, ${laps} new lap(s)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
