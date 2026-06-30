// ONE-OFF VALIDATION SCRIPT — not production code.
//
// Question: what does the `flags` field on a raw AC Evo lap mean? Specifically,
// which value(s) mark a VALID timed lap vs an INVALID one (off-track/cut/in/out lap)?
//
// Method: Emperor's own leaderboard UI is ground truth — it has a
// `show-invalid-lap-times` toggle that we can diff against the full lap list to
// get an exact valid/invalid label per lap (by driver + session + lap time).
// We then download the matching raw session JSON via EmperorClient, look up the
// `flags` value for each of those labeled laps, and report which flags value(s)
// line up with "valid" vs "invalid" per Emperor's own classification.
//
// Run: pnpm exec tsx scripts/validate-ac-evo-lap-flags.ts
//
// CONFIRMED RESULT (Road Atlanta, 10 sessions spanning qualify/practice/race,
// June 29-30 2026): isValidLap(flags) = (flags & 1) === 0
// Verified 776/776 (100%) against Emperor's ground-truth leaderboard
// classification — every distinct observed flags value (1, 2, 5, 6, 129, 133)
// was a pure valid or pure invalid bucket with zero contradictions; bit 0 alone
// determines validity regardless of any other bit. 12 laps were excluded as
// genuinely ambiguous (two different laps tied on displayed time with differing
// flags) rather than guessed at.

import { EmperorClient } from '../packages/emperor-client/src/index.js';

const BASE_URL = 'https://sram1acevo.emperorservers.com';
const EMPEROR_TRACK = 'Road Atlanta,GP'; // leaderboard ?track= param
const RAW_TRACK_NAME = 'Road Atlanta'; // raw session JSON track_name field
const PAGE_SIZE = 50;
const REQUEST_DELAY_MS = 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type LapRow = {
  driverName: string;
  lapTimeMs: number;
  sessionSlug: string; // e.g. "2026-06-30_01-37-46_QUALIFYING"
};

function lapKey(row: LapRow): string {
  return `${row.driverName}|${row.sessionSlug}|${row.lapTimeMs}`;
}

function parseLapTimeToMs(text: string): number | null {
  const m = text.match(/^(\d{1,2}):(\d{2})\.(\d{3})$/);
  if (!m) return null;
  const [, mm, ss, ms] = m;
  return Number(mm) * 60_000 + Number(ss) * 1000 + Number(ms);
}

function leaderboardUrl(opts: { allLaps: boolean; invalidLaps: boolean; page: number }): string {
  const params = new URLSearchParams({
    session: '-1',
    driver: '-1',
    start: '',
    end: '',
    'preset-id': '',
    server: '-1',
    'championship-id': '',
    'cup-category': '-1',
    track: EMPEROR_TRACK,
    'show-all-lap-times': opts.allLaps ? '1' : '0',
    'show-invalid-lap-times': opts.invalidLaps ? '1' : '0',
    page: String(opts.page),
  });
  return `${BASE_URL}/leaderboards?${params.toString()}`;
}

function parseRows(html: string): LapRow[] {
  const rows: LapRow[] = [];
  const trBlocks = html.split('<tr>').slice(1); // first chunk is pre-first-<tr> content
  for (const block of trBlocks) {
    const driverMatch = block.match(/class="detailed-results" href="\/driver\/\d+">([^<]+)</);
    const timeMatch = block.match(/>(\d{1,2}:\d{2}\.\d{3})</);
    const slugMatch = block.match(/href="\/server\/\d+\/result\/([^"]+)"/);
    if (!driverMatch || !timeMatch || !slugMatch) continue; // header row or malformed block
    const lapTimeMs = parseLapTimeToMs(timeMatch[1]);
    if (lapTimeMs == null) continue;
    rows.push({
      driverName: driverMatch[1].trim(),
      lapTimeMs,
      sessionSlug: slugMatch[1],
    });
  }
  return rows;
}

function parseTotalEntries(html: string): number {
  const m = html.match(/Showing entries \d+-\d+ of (\d+)\./);
  return m ? Number(m[1]) : 0;
}

async function fetchAllLeaderboardRows(opts: { allLaps: boolean; invalidLaps: boolean }): Promise<LapRow[]> {
  const firstPageHtml = await (await fetch(leaderboardUrl({ ...opts, page: 0 }))).text();
  const total = parseTotalEntries(firstPageHtml);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  console.log(
    `  fetching show-all-lap-times=${opts.allLaps ? 1 : 0}&show-invalid-lap-times=${opts.invalidLaps ? 1 : 0}: ${total} entries across ${totalPages} pages`,
  );

  const rows = [...parseRows(firstPageHtml)];
  for (let page = 1; page < totalPages; page++) {
    await sleep(REQUEST_DELAY_MS);
    const html = await (await fetch(leaderboardUrl({ ...opts, page }))).text();
    rows.push(...parseRows(html));
  }
  return rows;
}

// raw session JSON shapes (mirrors packages/domain/src/ac-evo-parser.ts — duplicated here
// since this is a throwaway script, not worth wiring up the shared parser for one field)
type GuidPair = { a: string; b: string };
type RawDriver = { guid: GuidPair; first_name?: string; last_name?: string; nickname?: string };
type RawLap = { driver_key: GuidPair; time: number; flags?: number };
type RawSession = {
  track_name?: string;
  track_layout_name?: string;
  drivers?: RawDriver[];
  laps?: RawLap[];
};

function gkey(g: GuidPair): string {
  return `${g.a}:${g.b}`;
}

// Emperor's leaderboard/standings UI displays drivers by real name (first + last),
// not the raw session file's `nickname` field — confirmed empirically (e.g. raw
// first_name="El ", last_name="Arct", nickname="AAA"; leaderboard shows "El Arct").
// NOTE: this differs from packages/domain/src/ac-evo-parser.ts's `nickname || first+last`
// precedence — worth flagging separately, not fixing here (out of scope for this script).
function driverNameCandidates(d: RawDriver | undefined): string[] {
  if (!d) return ['Unknown'];
  // first_name/last_name sometimes carry stray internal whitespace (e.g. "El " + "Arct"),
  // so trim each part individually before joining, not just the final string.
  const fullName = [d.first_name, d.last_name]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' ');
  const candidates = [fullName, d.nickname?.trim()].filter((n): n is string => Boolean(n));
  return candidates.length > 0 ? candidates : ['Unknown'];
}

async function main() {
  console.log(`Validating AC Evo lap \`flags\` semantics for track: ${RAW_TRACK_NAME}\n`);

  // 1. Ground truth from Emperor's own leaderboard: valid-only vs all (valid+invalid)
  console.log('Step 1: scraping Emperor leaderboard (ground truth)...');
  const validRows = await fetchAllLeaderboardRows({ allLaps: true, invalidLaps: false });
  await sleep(REQUEST_DELAY_MS);
  const allRows = await fetchAllLeaderboardRows({ allLaps: true, invalidLaps: true });

  const validKeys = new Set(validRows.map(lapKey));
  const labeled = allRows.map((row) => ({ ...row, valid: validKeys.has(lapKey(row)) }));
  const invalidCount = labeled.filter((r) => !r.valid).length;
  console.log(
    `  -> ${labeled.length} total laps, ${labeled.length - invalidCount} valid, ${invalidCount} invalid (per Emperor)\n`,
  );

  if (invalidCount === 0) {
    console.log('No invalid laps found in Emperor\'s data for this track — cannot determine the invalid-flag value empirically. Try a track/session with more laps or known cuts.');
    return;
  }

  // 2. Find which raw session files we need, via EmperorClient
  console.log('Step 2: fetching results list via EmperorClient...');
  const client = new EmperorClient(BASE_URL);
  // (Emperor's results list API is 0-indexed — getResultsList()/getAllResultsList()
  // used to default to page=1 and silently return nothing; fixed in client.ts.)
  const firstPage = await client.getResultsList(0);
  const allResults = [...firstPage.entries];
  for (let p = 1; p < firstPage.numPages; p++) {
    allResults.push(...(await client.getResultsList(p)).entries);
  }

  const neededSlugs = new Set(labeled.map((r) => r.sessionSlug));
  const slugToResultsUrl = new Map<string, string>();
  // Leaderboard slugs look like "2026-06-30_01-37-46_QUALIFYING"; results-list entries have
  // an ISO `date` field — match each slug's embedded timestamp against the entry's date prefix.
  for (const slug of neededSlugs) {
    const m = slug.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})_/);
    if (!m) continue;
    const iso = `${m[1]}T${m[2]}:${m[3]}:${m[4]}`;
    const match = allResults.find((e) => e.track === RAW_TRACK_NAME && e.date.startsWith(iso));
    if (match) slugToResultsUrl.set(slug, match.resultsJsonUrl);
  }

  const missing = [...neededSlugs].filter((s) => !slugToResultsUrl.has(s));
  if (missing.length > 0) {
    console.log(`  WARNING: could not match ${missing.length}/${neededSlugs.size} session slugs to a results-list entry:`);
    for (const s of missing) console.log(`    - ${s}`);
  }
  console.log(`  -> matched ${slugToResultsUrl.size}/${neededSlugs.size} needed sessions\n`);

  // 3. Download raw session JSON for each needed session, build flags lookup
  console.log('Step 3: downloading raw session results...');
  type Confusion = { valid: number; invalid: number };
  const flagsConfusion = new Map<number, Confusion>();
  const unmatched: typeof labeled = [];
  const ambiguous: typeof labeled = [];

  let totalRawLaps = 0;
  for (const [slug, resultsJsonUrl] of slugToResultsUrl) {
    await sleep(REQUEST_DELAY_MS);
    const raw = (await client.downloadResult(resultsJsonUrl)) as RawSession;
    const drivers = new Map<string, RawDriver>();
    for (const d of raw.drivers ?? []) drivers.set(gkey(d.guid), d);
    totalRawLaps += (raw.laps ?? []).length;

    // index raw laps by every name candidate (full name + nickname) for this session,
    // time matched with tolerance below
    const rawLapsByName = new Map<string, RawLap[]>();
    for (const lap of raw.laps ?? []) {
      const names = driverNameCandidates(drivers.get(gkey(lap.driver_key)));
      for (const name of names) {
        const arr = rawLapsByName.get(name) ?? [];
        arr.push(lap);
        rawLapsByName.set(name, arr);
      }
    }

    for (const row of labeled.filter((r) => r.sessionSlug === slug)) {
      const candidates = rawLapsByName.get(row.driverName) ?? [];
      // allow +/-1ms tolerance in case of any rounding on display
      const matches = candidates.filter((l) => Math.abs(l.time - row.lapTimeMs) <= 1);
      if (matches.length === 0) {
        unmatched.push(row);
        continue;
      }
      const distinctFlags = new Set(matches.map((m) => m.flags ?? -1));
      if (distinctFlags.size > 1) {
        // Two genuinely different laps tied on displayed time (to 3 decimals) with
        // different flags values — can't reliably attribute this leaderboard row to
        // one or the other, so exclude it from the confusion matrix entirely rather
        // than guess (guessing wrong silently corrupts the evidence).
        ambiguous.push(row);
        console.log(
          `  AMBIGUOUS (excluded): driver="${row.driverName}" time=${row.lapTimeMs}ms session=${slug} -> tied candidates with flags [${[...distinctFlags].join(', ')}]`,
        );
        continue;
      }
      const flags = matches[0].flags ?? -1; // -1 sentinel for "field absent"
      const c = flagsConfusion.get(flags) ?? { valid: 0, invalid: 0 };
      if (row.valid) c.valid++;
      else c.invalid++;
      flagsConfusion.set(flags, c);
    }
  }

  console.log(`  -> downloaded ${slugToResultsUrl.size} sessions totaling ${totalRawLaps} raw laps`);
  if (unmatched.length > 0) {
    console.log(`  WARNING: ${unmatched.length}/${labeled.length} leaderboard laps had no matching raw lap and were excluded.`);
    console.log('  sample of unmatched rows (first 5):');
    for (const row of unmatched.slice(0, 5)) {
      console.log(`    - driver="${row.driverName}" time=${row.lapTimeMs}ms session=${row.sessionSlug} valid=${row.valid}`);
    }
  }
  if (ambiguous.length > 0) {
    console.log(`  ${ambiguous.length}/${labeled.length} rows excluded as ambiguous (tied time, differing flags) — see above.`);
  }
  console.log();

  // 4. Report: per-flags-value confusion matrix
  console.log('=== Per-flags-value confusion matrix (ground truth: Emperor leaderboard) ===');
  const sortedFlags = [...flagsConfusion.keys()].sort((a, b) => a - b);
  for (const flags of sortedFlags) {
    const c = flagsConfusion.get(flags)!;
    const total = c.valid + c.invalid;
    const verdict =
      c.invalid === 0 ? 'PURE VALID' : c.valid === 0 ? 'PURE INVALID' : 'MIXED (not a clean predictor alone)';
    console.log(`  flags=${flags}: valid=${c.valid} invalid=${c.invalid} (n=${total}) -> ${verdict}`);
  }

  // 5. Test candidate hypotheses for a `isValidLap(flags)` predicate
  console.log('\n=== Candidate hypothesis accuracy ===');
  const allLabeledFlagRows: { flags: number; valid: boolean }[] = [];
  for (const [flags, c] of flagsConfusion) {
    for (let i = 0; i < c.valid; i++) allLabeledFlagRows.push({ flags, valid: true });
    for (let i = 0; i < c.invalid; i++) allLabeledFlagRows.push({ flags, valid: false });
  }
  const n = allLabeledFlagRows.length;

  const hypotheses: { name: string; predict: (flags: number) => boolean }[] = [
    { name: 'flags === 1', predict: (f) => f === 1 },
    { name: 'flags === 0 (absence of any flag)', predict: (f) => f === 0 },
    { name: 'bit0 set (flags & 1) => valid', predict: (f) => (f & 1) !== 0 },
    { name: 'bit0 clear (flags & 1 === 0) => valid', predict: (f) => (f & 1) === 0 },
    { name: 'bit1 clear (flags & 2 === 0) => valid', predict: (f) => (f & 2) === 0 },
    { name: 'bit2 clear (flags & 4 === 0) => valid', predict: (f) => (f & 4) === 0 },
    { name: 'flags <= 2 => valid', predict: (f) => f <= 2 },
    { name: 'flags !== 2 && flags !== 6 => valid (exact membership guess)', predict: (f) => f !== 2 && f !== 6 },
  ];

  for (const h of hypotheses) {
    const correct = allLabeledFlagRows.filter((r) => h.predict(r.flags) === r.valid).length;
    const pct = n > 0 ? ((correct / n) * 100).toFixed(1) : 'n/a';
    console.log(`  ${h.name}: ${correct}/${n} (${pct}%)`);
  }

  console.log(`\nTotal labeled raw laps analyzed: ${n}`);
}

main().catch((err) => {
  console.error('Validation script failed:', err);
  process.exitCode = 1;
});
