// ONE-OFF DIAGNOSTIC SCRIPT — not production code.
//
// Determines whether Emperor's results list is ordered newest-first (page 0)
// or oldest-first (page N-1). The incremental cron logic depends on this.
//
// Run: pnpm exec tsx scripts/check-emperor-page-order.ts

import { EmperorClient } from '../packages/emperor-client/src/index.js';

const BASE_URL =
  process.env.EMPEROR_ACEVO_BASE_URL ?? 'https://sram1acevo.emperorservers.com';

function summarizePage(
  label: string,
  entries: { track: string; sessionType: string; date: string }[],
): void {
  if (entries.length === 0) {
    console.log(`${label}: (empty)`);
    return;
  }
  const dates = entries.map((e) => e.date).sort();
  const earliest = dates[0];
  const latest = dates[dates.length - 1];
  console.log(`${label} (${entries.length} entries):`);
  console.log(`  earliest date : ${earliest}`);
  console.log(`  latest date   : ${latest}`);
  console.log(`  first entry   : [${entries[0].sessionType}] ${entries[0].track} @ ${entries[0].date}`);
  console.log(`  last entry    : [${entries[entries.length - 1].sessionType}] ${entries[entries.length - 1].track} @ ${entries[entries.length - 1].date}`);
}

async function main(): Promise<void> {
  // No rate limiting needed — only 2 requests total.
  const client = new EmperorClient(BASE_URL, { minRequestIntervalMs: 0 });

  console.log(`Fetching page 0 from ${BASE_URL} ...\n`);
  const page0 = await client.getResultsList(0);

  console.log(`Total pages: ${page0.numPages}`);
  console.log(`Entries per page: ${page0.entries.length}\n`);

  summarizePage('Page 0', page0.entries);

  if (page0.numPages > 1) {
    const lastPageIndex = page0.numPages - 1;
    console.log(`\nFetching last page (page ${lastPageIndex}) ...\n`);
    const lastPage = await client.getResultsList(lastPageIndex);
    summarizePage(`Page ${lastPageIndex} (last)`, lastPage.entries);

    console.log('\n--- VERDICT ---');
    const page0Latest = page0.entries.map((e) => e.date).sort().at(-1)!;
    const lastPageLatest = lastPage.entries.map((e) => e.date).sort().at(-1)!;
    if (page0Latest > lastPageLatest) {
      console.log('Page 0 has NEWER dates than the last page → newest-first ordering confirmed.');
      console.log('Cron can safely scan only page 0 to find new sessions.');
    } else if (lastPageLatest > page0Latest) {
      console.log('Last page has NEWER dates than page 0 → oldest-first ordering.');
      console.log('Cron must scan from the last page backward, not from page 0.');
    } else {
      console.log('Pages have the same latest date — inconclusive (may need to check middle pages).');
    }
  } else {
    console.log('\nOnly one page — ordering is moot.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
