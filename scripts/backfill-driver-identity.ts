/**
 * Backfill bot-facing identity fields on the `drivers` table from the SRA-Bot
 * user snapshot. Populates first_name, last_name, driver_number, is_sralien so
 * the bot's nickname/number/SRAlien sync has data once SRA_BACKEND=supabase is
 * live. (These columns are added by migration 20260725d_bot_identity_fields.sql,
 * which MUST be run first.)
 *
 * Matches existing rows by discord_id, falling back to steam_id. UPDATE-only —
 * never inserts, never touches division_id/tier (those are managed in the
 * cockpit admin UI and by the bot going forward, so we don't clobber them).
 *
 * The snapshot is the bot's frozen users dump — a JSON array of the legacy
 * user objects. It lives in the bot repo's gitignored data/ dir (e.g.
 * data/full_data_20260615_202400.json); get it from Dae Hee / the bot server.
 *
 * Run: npx tsx scripts/backfill-driver-identity.ts <path-to-snapshot.json>
 *      npx tsx scripts/backfill-driver-identity.ts <path> --dry-run
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
 * apps/cockpit/.env.local (or as shell env vars).
 */

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

loadEnv({ path: resolve(__dirname, '../apps/cockpit/.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
    '\nSet them in apps/cockpit/.env.local or as environment variables.',
  );
  process.exit(1);
}

// ── Args ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const snapshotPath = args.find((a) => !a.startsWith('--'));

if (!snapshotPath) {
  console.error(
    'Usage: npx tsx scripts/backfill-driver-identity.ts <path-to-snapshot.json> [--dry-run]',
  );
  process.exit(1);
}

// ── Types ─────────────────────────────────────────────────────────────────────

// Only the fields we consume; the snapshot carries many more.
type SnapshotUser = {
  discord_id: string | number | null;
  steam_id: string | number | null;
  first_name: string | null;
  last_name: string | null;
  driver_number: number | string | null;
  is_sralien: number | string | boolean | null;
  [key: string]: unknown;
};

type IdentityUpdate = {
  first_name: string | null;
  last_name: string | null;
  driver_number: number | null;
  is_sralien: boolean;
};

// ── Load snapshot ─────────────────────────────────────────────────────────────

const raw: SnapshotUser[] = JSON.parse(readFileSync(resolve(snapshotPath), 'utf8'));
console.log(`Loaded ${raw.length} records from ${snapshotPath}`);
if (dryRun) console.log('DRY RUN — no writes will be made.\n');

// ── Normalizers ───────────────────────────────────────────────────────────────

function normSteam(v: string | number | null): string | null {
  if (v === null || v === undefined) return null;
  const stripped = String(v).replace(/^S/, '');
  return /^\d{17}$/.test(stripped) ? stripped : null;
}

function normNumber(v: number | string | null): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

// Snapshot stores is_sralien inconsistently (1/0, "1"/"0", true/false).
function normSralien(v: number | string | boolean | null): boolean {
  return v === 1 || v === '1' || v === true;
}

// ── Fetch existing drivers to resolve the update target ──────────────────────
// We only update rows that already exist; build discord_id + steam_id indexes.

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: ws },
});

console.log('Fetching existing drivers...');

// PostgREST caps a select at 1000 rows — page through all of them.
type DriverKey = { id: string; discord_id: string | null; steam_id: string | null };
const drivers: DriverKey[] = [];
const PAGE = 1000;
for (let from = 0; ; from += PAGE) {
  const { data, error } = await supabase
    .from('drivers')
    .select('id, discord_id, steam_id')
    .range(from, from + PAGE - 1);
  if (error) {
    console.error('Failed to fetch drivers:', error.message);
    process.exit(1);
  }
  if (!data?.length) break;
  drivers.push(...(data as DriverKey[]));
  if (data.length < PAGE) break;
}

const byDiscord = new Map<string, string>(); // discord_id -> driver id
const bySteam = new Map<string, string>(); // steam_id  -> driver id
for (const d of drivers) {
  if (d.discord_id) byDiscord.set(String(d.discord_id), d.id);
  if (d.steam_id) bySteam.set(String(d.steam_id), d.id);
}
console.log(`${drivers.length} driver rows in DB.\n`);

// ── Build the update set ──────────────────────────────────────────────────────

type Task = { driverId: string; update: IdentityUpdate };
const tasks: Task[] = [];
let unmatched = 0;
const seenNumbers = new Map<number, string>(); // driver_number -> discord/steam key (dupe guard)

for (const u of raw) {
  const discordId = u.discord_id != null ? String(u.discord_id) : null;
  const steamId = normSteam(u.steam_id);

  const driverId =
    (discordId && byDiscord.get(discordId)) ||
    (steamId && bySteam.get(steamId)) ||
    null;

  if (!driverId) {
    unmatched++;
    continue;
  }

  const driverNumber = normNumber(u.driver_number);

  // driver_number is UNIQUE in the DB — warn on snapshot-internal dupes so the
  // operator knows why one of them will fail its update.
  if (driverNumber !== null) {
    const key = discordId ?? steamId ?? driverId;
    const prior = seenNumbers.get(driverNumber);
    if (prior) {
      console.warn(
        `  WARN: driver_number ${driverNumber} appears twice in snapshot (${prior} and ${key}) — second update will conflict.`,
      );
    } else {
      seenNumbers.set(driverNumber, key);
    }
  }

  tasks.push({
    driverId,
    update: {
      first_name: (u.first_name ?? null) || null,
      last_name: (u.last_name ?? null) || null,
      driver_number: driverNumber,
      is_sralien: normSralien(u.is_sralien),
    },
  });
}

console.log(`Matched ${tasks.length} rows to update. ${unmatched} snapshot record(s) had no matching driver (skipped).\n`);

if (dryRun) {
  console.log('Sample of first 5 updates:');
  for (const t of tasks.slice(0, 5)) {
    console.log(`  driver ${t.driverId}:`, JSON.stringify(t.update));
  }
  console.log('\nDRY RUN complete — no changes written.');
  process.exit(0);
}

// ── Apply ─────────────────────────────────────────────────────────────────────

let updated = 0;
let errors = 0;

for (const { driverId, update } of tasks) {
  const { error } = await supabase.from('drivers').update(update).eq('id', driverId);
  if (error) {
    // 23505 = unique_violation on driver_number
    const dupe = error.code === '23505' ? ' (driver_number already taken)' : '';
    console.error(`  ERROR updating ${driverId}${dupe}: ${error.message}`);
    errors++;
  } else {
    updated++;
    process.stdout.write(`\r  Updated ${updated}/${tasks.length}...`);
  }
}

console.log(`\nDone. ${updated} rows updated, ${errors} errors.`);
if (errors > 0) {
  console.error('Some updates failed — see errors above. Safe to re-run (idempotent).');
  process.exit(1);
}
