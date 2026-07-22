// ONE-TIME CORRECTION SCRIPT — fixes a key mismatch left by
// scripts/backfill-tracks-v2.ts.
//
// That backfill wrote every AC Evo track under layout=null (the legacy
// cache never recorded layout), but content/championships.ts already knows
// the real layout for some tracks via emperorTrack ("TrackName,Layout").
// Once the read side (acevo-hotlaps.ts) was cut over to derive keys from
// that same content, tracks with a known layout diverged from where the
// backfill put their data — e.g. "Road Atlanta,GP" reads from
// "road-atlanta__gp" but the backfill wrote "road-atlanta".
//
// This moves each affected track's v2 cache rows from the old (no-layout)
// key to the correct (layout-aware) key. Tracks with no emperorTrack entry
// (e.g. Laguna Seca) are genuinely layout-unknown and already correct — left
// untouched.
//
// Safe to re-run: no-ops once the correct key already has the data.
//
// Run: pnpm exec tsx -r dotenv/config scripts/fix-acevo-v2-layout-keys.ts
//      (with DOTENV_CONFIG_PATH=apps/cockpit/.env.local)

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { CHAMPIONSHIPS } from '../apps/cockpit/src/content/championships.js';
import { trackSlug, buildTrackKey, parseEmperorTrackLayout } from '../apps/cockpit/src/lib/track-slug.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: ws } });

// Mirrors getLeaderboardTracks('AC Evo') from lib/leaderboard-tracks.ts —
// duplicated here rather than imported, since that module pulls in the
// '@/' path alias and a 'server-only' Supabase client that only resolve
// inside the Next.js build, not a standalone tsx script.
type TrackRef = { rawTrackName: string; displayName: string; emperorTrack?: string };

function getAcEvoTracks(): TrackRef[] {
  const seen = new Map<string, TrackRef>();
  for (const champ of CHAMPIONSHIPS) {
    if (champ.game !== 'AC Evo') continue;
    for (const round of champ.schedule) {
      if (!round.emperorRawTrackName || seen.has(round.emperorRawTrackName)) continue;
      seen.set(round.emperorRawTrackName, {
        rawTrackName: round.emperorRawTrackName,
        displayName: round.track,
        emperorTrack: round.emperorTrack,
      });
    }
  }
  return [...seen.values()];
}

async function main(): Promise<void> {
  const tracks = getAcEvoTracks();

  for (const track of tracks) {
    const oldKey = buildTrackKey(track.rawTrackName, null); // what the backfill wrote
    const layout = parseEmperorTrackLayout(track.emperorTrack);
    const correctKey = buildTrackKey(track.rawTrackName, layout);

    if (oldKey === correctKey) {
      console.log(`  ${track.rawTrackName}: no layout known, key unchanged (${oldKey})`);
      continue;
    }

    console.log(`  ${track.rawTrackName}: moving "${oldKey}" -> "${correctKey}" (layout "${layout}")`);
    const baseTrackKey = trackSlug(track.rawTrackName);

    const { error: layoutErr } = await supabase.from('track_layouts').upsert(
      {
        layout_key: correctKey,
        base_track_key: baseTrackKey,
        game: 'AC Evo',
        layout_name: layout,
        display_name: track.displayName,
      },
      { onConflict: 'layout_key' },
    );
    if (layoutErr) throw layoutErr;

    const { data: hotlapRow, error: hotlapReadErr } = await supabase
      .from('acevo_hotlap_cache_v2')
      .select('*')
      .eq('layout_key', oldKey)
      .maybeSingle();
    if (hotlapReadErr) throw hotlapReadErr;
    if (hotlapRow) {
      const { error: writeErr } = await supabase
        .from('acevo_hotlap_cache_v2')
        .upsert({ ...hotlapRow, layout_key: correctKey }, { onConflict: 'layout_key' });
      if (writeErr) throw writeErr;
    }

    const { data: pointsRow, error: pointsReadErr } = await supabase
      .from('acevo_round_points_cache_v2')
      .select('*')
      .eq('layout_key', oldKey)
      .maybeSingle();
    if (pointsReadErr) throw pointsReadErr;
    if (pointsRow) {
      const { error: writeErr } = await supabase
        .from('acevo_round_points_cache_v2')
        .upsert({ ...pointsRow, layout_key: correctKey }, { onConflict: 'layout_key' });
      if (writeErr) throw writeErr;
    }

    // Remove the old rows only after the new ones are confirmed written —
    // cache rows first (they reference track_layouts via FK), then the old
    // track_layouts row itself.
    if (hotlapRow) {
      const { error } = await supabase.from('acevo_hotlap_cache_v2').delete().eq('layout_key', oldKey);
      if (error) throw error;
    }
    if (pointsRow) {
      const { error } = await supabase.from('acevo_round_points_cache_v2').delete().eq('layout_key', oldKey);
      if (error) throw error;
    }
    const { error: deleteLayoutErr } = await supabase
      .from('track_layouts')
      .delete()
      .eq('layout_key', oldKey);
    if (deleteLayoutErr) throw deleteLayoutErr;
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
