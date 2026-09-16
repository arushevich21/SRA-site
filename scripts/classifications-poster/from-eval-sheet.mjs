// Converts an export of the "SRA Driver Eval Sheet" (new_classification tab)
// into the flat name,division,tier CSV that build.mjs consumes.
//
// That sheet is a working document, not a data feed: the left half is the
// eligibility/pace workings, and the classification actually lives in a ranked
// block partway across, keyed off a "Rank" header. A driver's final placement
// is the "Div/Split Override" pair when an admin has filled it in, and the
// computed "Auto Div"/"Auto Split" otherwise.
//
//   node from-eval-sheet.mjs "<path to export.csv>" [--out data/season-19.csv]

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;
const src = process.argv[2];
if (!src) {
  console.error('usage: node from-eval-sheet.mjs <eval-sheet-export.csv> [--out data/out.csv]');
  process.exit(1);
}
const outIdx = process.argv.indexOf('--out');
const OUT = path.resolve(HERE, outIdx > 0 ? process.argv[outIdx + 1] : 'data/season.csv');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const toCsvField = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

const rows = parseCsv(readFileSync(src, 'utf8'));
const header = rows[0].map((h) => h.trim());

// Anchor on "Rank" rather than a fixed column index — the sheet's left-hand
// workings change width between seasons, which shifts the whole block.
const iRank = header.indexOf('Rank');
if (iRank < 0) throw new Error('No "Rank" column — is this the new_classification tab?');

const at = (label, from) => {
  const i = header.indexOf(label, from);
  if (i < 0) throw new Error(`Missing "${label}" column`);
  return i;
};
const iName = at('Name', iRank);
const iAutoDiv = at('Auto Div', iRank);
const iAutoSplit = at('Auto Split', iRank);

// The override is a two-cell pair (division, then split) under one merged
// header, so the split sits in the column immediately after it.
const iOvrDiv = header.findIndex((h, i) => i > iRank && /Div\/Split\s*Override/i.test(h));
if (iOvrDiv < 0) throw new Error('Missing "Div/Split Override" column');
const iOvrSplit = iOvrDiv + 1;

const tierOf = (s) => {
  const v = (s ?? '').trim().toLowerCase();
  if (v.startsWith('g')) return 'gold';
  if (v.startsWith('s')) return 'silver';
  return null;
};

const drivers = [];
const skipped = [];
for (const r of rows.slice(1)) {
  if (!/^\d+$/.test((r[iRank] ?? '').trim())) continue; // spacer / notes rows
  const name = (r[iName] ?? '').trim();
  if (!name) continue;

  const ovrDiv = (r[iOvrDiv] ?? '').trim();
  const ovrTier = tierOf(r[iOvrSplit]);
  const useOverride = ovrDiv !== '' && ovrTier !== null;

  const division = Number((useOverride ? ovrDiv : (r[iAutoDiv] ?? '')).replace(/\D/g, ''));
  const tier = useOverride ? ovrTier : tierOf(r[iAutoSplit]);

  if (!division || !tier) {
    skipped.push(`${name} (div=${r[iAutoDiv]} split=${r[iAutoSplit]})`);
    continue;
  }
  drivers.push({ name, division, tier, overridden: useOverride });
}

// Within a column, alphabetical by the name as displayed — the order the
// league has always published these in, and the only order that lets someone
// find themselves quickly on the image.
const collator = new Intl.Collator('en', { sensitivity: 'base' });
drivers.sort(
  (a, b) =>
    a.division - b.division ||
    (a.tier === 'gold' ? 0 : 1) - (b.tier === 'gold' ? 0 : 1) ||
    collator.compare(a.name, b.name),
);

writeFileSync(
  OUT,
  'name,division,tier\n' +
    drivers.map((d) => `${toCsvField(d.name)},${d.division},${d.tier}\n`).join(''),
  'utf8',
);

const counts = new Map();
for (const d of drivers) {
  const k = `D${d.division} ${d.tier}`;
  counts.set(k, (counts.get(k) ?? 0) + 1);
}
console.log(`${OUT}\n  ${drivers.length} drivers`);
for (const k of [...counts.keys()].sort()) console.log(`  ${k}: ${counts.get(k)}`);
const overrides = drivers.filter((d) => d.overridden);
console.log(`  ${overrides.length} manual overrides applied`);
if (skipped.length) {
  console.log(`  ${skipped.length} rows skipped (no division/split):`);
  for (const s of skipped) console.log(`    - ${s}`);
}
