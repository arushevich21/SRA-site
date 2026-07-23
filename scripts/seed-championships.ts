// ONE-TIME SEED — copies the in-repo CHAMPIONSHIPS content into Supabase.
//
// Phase 1 of the DB-backed events feature. Run AFTER applying
// supabase/migrations/20260721_championships.sql. Safe to re-run: each
// championship is upserted by slug and its rounds are fully replaced.
//
// Run: pnpm exec tsx scripts/seed-championships.ts
//
// After this, the site reads championships from the DB via
// lib/championships-store.ts (which falls back to the in-repo content until
// this seed has run, so nothing breaks in the meantime).

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { CHAMPIONSHIPS } from '../apps/cockpit/src/content/championships.js';

// Keys live in apps/cockpit/.env.local (not a root .env), so load that
// explicitly — resolved from this file's location so CWD doesn't matter.
const scriptDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(scriptDir, '../apps/cockpit/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}
// Node < 22 has no native WebSocket; supabase-js's realtime client needs one.
// Provide `ws` as the transport (same as scripts/backfill-acevo-hotlaps.ts).
const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: ws } });

async function main(): Promise<void> {
  console.log(`Seeding ${CHAMPIONSHIPS.length} championship(s)...\n`);

  for (let i = 0; i < CHAMPIONSHIPS.length; i++) {
    const c = CHAMPIONSHIPS[i];

    const { data: upserted, error: champErr } = await supabase
      .from('championships')
      .upsert(
        {
          slug: c.slug,
          game: c.game,
          title: c.title,
          class_tag: c.classTag,
          format_tag: c.formatTag ?? null,
          event_type: c.eventType ?? 'championship',
          classes: c.classes,
          logo_url: c.logo ?? null,
          race_format: c.raceFormat,
          race_days: c.raceDays ?? null,
          rules_bullets: c.rulesBullets,
          discord_links: c.discordLinks,
          results_url: c.resultsUrl,
          results_label: c.resultsLabel ?? null,
          emperor_championship_id: c.emperorChampionshipId ?? null,
          simgrid_id: c.simgridId,
          standings_key: c.standingsKey ?? null,
          registration_key: c.registrationKey ?? null,
          registration_season: c.registrationSeason ?? null,
          registration_open: c.registrationOpen ?? false,
          max_team_size: c.maxTeamSize ?? null,
          allowed_cars: c.allowedCars ?? null,
          teaser_only: c.teaserOnly ?? false,
          concluded: c.concluded ?? false,
          sort_order: i,
        },
        { onConflict: 'slug' },
      )
      .select('id')
      .single();
    if (champErr) throw champErr;

    const championshipId = upserted.id as string;

    // Replace rounds wholesale so re-runs stay in sync with the content file.
    const { error: delErr } = await supabase
      .from('championship_rounds')
      .delete()
      .eq('championship_id', championshipId);
    if (delErr) throw delErr;

    if (c.schedule.length > 0) {
      const { error: roundsErr } = await supabase.from('championship_rounds').insert(
        c.schedule.map((r) => ({
          championship_id: championshipId,
          round: r.round,
          track: r.track,
          race_length: r.raceLength,
          starts_at: r.date,
          emperor_track: r.emperorTrack ?? null,
          emperor_raw_track_name: r.emperorRawTrackName ?? null,
        })),
      );
      if (roundsErr) throw roundsErr;
    }

    console.log(`  ✓ ${c.slug} (${c.schedule.length} round(s))`);
  }

  console.log(`\nSeed complete: ${CHAMPIONSHIPS.length} championship(s).`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
