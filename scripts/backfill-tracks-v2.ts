// ONE-TIME BACKFILL SCRIPT — Phase 1 of the tracks/track_layouts migration
// (see supabase/migrations/20260722_shared_tracks_and_acevo_v2_cache.sql).
//
// Copies EXISTING data from the legacy tables into the new schema, without
// touching the legacy tables or calling Emperor at all:
//   - acc_tracks + acc_hotlap_leaderboard  -> tracks + track_layouts (ACC:
//     no layout concept, so this is a clean, lossless copy)
//   - acevo_hotlap_cache + acevo_round_points_cache -> tracks + track_layouts
//     + acevo_hotlap_cache_v2 + acevo_round_points_cache_v2 (AC Evo: the
//     legacy cache never recorded which layout an entry came from, so this
//     writes under layout_name=null / "layout unknown" — the cron will
//     supersede each track with a properly layout-scoped row the next time
//     it processes a real session there)
//
// Safe to re-run: every write is an upsert.
//
// Run: pnpm exec tsx scripts/backfill-tracks-v2.ts

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { trackSlug, buildTrackKey } from '../apps/cockpit/src/lib/track-slug.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: ws } });

async function backfillAcc(): Promise<void> {
  console.log('=== ACC ===');
  const { data: accTracks, error } = await supabase.from('acc_tracks').select('*');
  if (error) throw error;

  for (const row of accTracks ?? []) {
    const trackKey = row.track_key as string;
    console.log(`  ${trackKey}`);

    const { error: trackErr } = await supabase.from('tracks').upsert(
      {
        base_track_key: trackKey,
        display_name: row.display_name,
        splash_art_url: row.splash_art_url,
        country: row.country,
        location: row.location,
      },
      { onConflict: 'base_track_key' },
    );
    if (trackErr) throw trackErr;

    const { error: layoutErr } = await supabase.from('track_layouts').upsert(
      {
        layout_key: trackKey,
        base_track_key: trackKey,
        game: 'ACC',
        layout_name: null,
        display_name: row.display_name,
      },
      { onConflict: 'layout_key' },
    );
    if (layoutErr) throw layoutErr;
  }
  console.log(`  done — ${(accTracks ?? []).length} track(s)\n`);
}

async function backfillAcEvo(): Promise<void> {
  console.log('=== AC Evo ===');
  const [hotlapRes, pointsRes] = await Promise.all([
    supabase.from('acevo_hotlap_cache').select('*'),
    supabase.from('acevo_round_points_cache').select('*'),
  ]);
  if (hotlapRes.error) throw hotlapRes.error;
  if (pointsRes.error) throw pointsRes.error;

  const pointsByTrack = new Map((pointsRes.data ?? []).map((r) => [r.track_key as string, r]));
  const allTrackKeys = new Set([
    ...(hotlapRes.data ?? []).map((r) => r.track_key as string),
    ...pointsByTrack.keys(),
  ]);

  for (const rawTrackName of allTrackKeys) {
    const baseTrackKey = trackSlug(rawTrackName);
    // layout_name=null (unknown from the legacy cache) — see file header.
    const layoutKey = buildTrackKey(rawTrackName, null);
    console.log(`  ${rawTrackName}  ->  base="${baseTrackKey}" layout="${layoutKey}"`);

    const { error: trackErr } = await supabase.from('tracks').upsert(
      { base_track_key: baseTrackKey, display_name: rawTrackName },
      { onConflict: 'base_track_key', ignoreDuplicates: true },
    );
    if (trackErr) throw trackErr;

    const { error: layoutErr } = await supabase.from('track_layouts').upsert(
      {
        layout_key: layoutKey,
        base_track_key: baseTrackKey,
        game: 'AC Evo',
        layout_name: null,
        display_name: rawTrackName,
      },
      { onConflict: 'layout_key', ignoreDuplicates: true },
    );
    if (layoutErr) throw layoutErr;

    const hotlapRow = (hotlapRes.data ?? []).find((r) => r.track_key === rawTrackName);
    if (hotlapRow) {
      const { error: cacheErr } = await supabase.from('acevo_hotlap_cache_v2').upsert(
        {
          layout_key: layoutKey,
          entries: hotlapRow.entries,
          last_session_date: hotlapRow.last_session_date,
          updated_at: hotlapRow.updated_at,
        },
        { onConflict: 'layout_key' },
      );
      if (cacheErr) throw cacheErr;
    }

    const pointsRow = pointsByTrack.get(rawTrackName);
    if (pointsRow) {
      const { error: pointsErr } = await supabase.from('acevo_round_points_cache_v2').upsert(
        {
          layout_key: layoutKey,
          race_position_points: pointsRow.race_position_points,
          fastest_lap_steam_id: pointsRow.fastest_lap_steam_id,
          pole_steam_id: pointsRow.pole_steam_id,
          pole_lap_ms: pointsRow.pole_lap_ms,
          race_session_date: pointsRow.race_session_date,
          qualify_session_date: pointsRow.qualify_session_date,
          updated_at: pointsRow.updated_at,
        },
        { onConflict: 'layout_key' },
      );
      if (pointsErr) throw pointsErr;
    }
  }
  console.log(`  done — ${allTrackKeys.size} track(s)\n`);
}

async function main(): Promise<void> {
  await backfillAcc();
  await backfillAcEvo();
  console.log('Backfill complete.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
