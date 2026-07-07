/**
 * One-time seed import: upserts the 2,696 Discord-keyed driver records from
 * drivers_seed.json into the Supabase `drivers` table.
 *
 * Safe to run multiple times (upserts on discord_id). Does NOT overwrite
 * user_id — claimed rows keep their auth linkage between runs.
 *
 * Run: npx tsx scripts/seed-drivers.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
 * apps/cockpit/.env.local (or set as shell env vars).
 */

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load from cockpit's .env.local
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: ws },
});

// ── Types ─────────────────────────────────────────────────────────────────────

type SeedRecord = {
  id: string;
  steam_id: string | null;
  discord_id: string | null;
  discord_username: string | null;
  discord_name: string | null;
  discord_avatar: string | null;
  discord_last_updated: string | null;
  [key: string]: unknown;
};

type DriverRow = {
  discord_id: string;
  display_name: string | null;
  avatar_url: string | null;
  steam_id: string | null;
};

// ── Load source data ──────────────────────────────────────────────────────────

const raw: SeedRecord[] = JSON.parse(
  readFileSync(resolve(__dirname, 'drivers_seed.json'), 'utf8'),
);

console.log(`Loaded ${raw.length} total records from seed file.`);

// ── Filter: only records with a discord_id ────────────────────────────────────

const withDiscord = raw.filter((r) => r.discord_id);
console.log(`Records with discord_id: ${withDiscord.length}`);

// ── Deduplicate by discord_id, keeping most-recently-updated ─────────────────

const byDiscordId = new Map<string, SeedRecord>();

for (const record of withDiscord) {
  const key = record.discord_id!;
  const existing = byDiscordId.get(key);

  if (!existing) {
    byDiscordId.set(key, record);
    continue;
  }

  const existingTs = existing.discord_last_updated
    ? new Date(existing.discord_last_updated).getTime()
    : 0;
  const thisTs = record.discord_last_updated
    ? new Date(record.discord_last_updated).getTime()
    : 0;

  if (thisTs > existingTs) {
    byDiscordId.set(key, record);
  }
}

const dupeCount = withDiscord.length - byDiscordId.size;
if (dupeCount > 0) {
  console.log(`Deduped ${dupeCount} duplicate discord_id(s) — kept most-recently-updated per ID.`);
}
console.log(`Unique records to upsert: ${byDiscordId.size}`);

// ── Build insert rows ─────────────────────────────────────────────────────────

const rows: DriverRow[] = [];
let skippedSteam = 0;

for (const record of byDiscordId.values()) {
  // Strip leading 'S' and validate steam64 format
  let steamId: string | null = null;

  if (record.steam_id) {
    const stripped = record.steam_id.replace(/^S/, '');
    if (/^\d{17}$/.test(stripped)) {
      steamId = stripped;
    } else {
      console.warn(
        `  WARN: invalid steam_id "${record.steam_id}" for discord_id ${record.discord_id} — inserting with steam_id=null`,
      );
      skippedSteam++;
    }
  }

  // Prefer discord_username → discord_name → discord_id (always non-null)
  const displayName =
    record.discord_username ?? record.discord_name ?? record.discord_id!;

  // Construct Discord avatar URL from hash
  const avatarUrl =
    record.discord_id && record.discord_avatar
      ? `https://cdn.discordapp.com/avatars/${record.discord_id}/${record.discord_avatar}.png`
      : null;

  rows.push({
    discord_id: record.discord_id!,
    display_name: displayName,
    avatar_url: avatarUrl,
    steam_id: steamId,
  });
}

if (skippedSteam > 0) {
  console.log(`${skippedSteam} record(s) had invalid steam_ids — inserted with steam_id=null.`);
}

// ── Upsert in batches ─────────────────────────────────────────────────────────
// On conflict (discord_id): updates display_name, avatar_url, steam_id.
// user_id is NOT in the payload — existing claims are never clobbered.

const BATCH_SIZE = 200;
let inserted = 0;
let errors = 0;

for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);

  const { error } = await supabase
    .from('drivers')
    .upsert(batch, { onConflict: 'discord_id' });

  if (error) {
    console.error(`  ERROR on batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
    errors += batch.length;
  } else {
    inserted += batch.length;
    process.stdout.write(`\r  Upserted ${inserted}/${rows.length}...`);
  }
}

console.log(`\nDone. ${inserted} rows upserted, ${errors} errors.`);

if (errors > 0) {
  console.error('Some batches failed — check errors above and re-run to retry.');
  process.exit(1);
}
