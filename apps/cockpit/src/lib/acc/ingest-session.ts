import type { SupabaseClient } from '@supabase/supabase-js';
import { computeAccEventKey } from '@sra/domain';
import type { AccSessionResult } from '@sra/shared-types';

// Deliberately does NOT import '../supabase' (which pulls in 'server-only'
// and throws outside the Next.js server runtime) — callers that need the
// production singleton pass it in explicitly (see race-results-store.ts's
// ingestAccRaceSession). This lets a plain tsx script (no Next.js runtime,
// e.g. scripts/backfill-acc-sessions.ts) construct its own client and reuse
// this exact upsert logic instead of duplicating it.
export type AccRaceSessionsTable = 'acc_race_sessions' | 'acc_race_sessions_staging';

// Upserts one parsed session into `table`. sessionKey must be stable and
// unique per session: the cron passes Emperor's resultsJsonUrl; the admin
// upload page (no Emperor URL to key on) passes 'manual:'+track+':'
// +sessionFile; the historical backfill script also passes resultsJsonUrl.
// Also ensures the track exists in both the legacy acc_tracks table and the
// shared tracks/track_layouts v2 schema — same idempotent upserts regardless
// of target table, so getAccTrack()/getAccTracks() (which read
// track_layouts) resolve a display name for every event, including
// staging-only ones.
export async function ingestAccRaceSessionInto(
  supabase: SupabaseClient,
  table: AccRaceSessionsTable,
  session: AccSessionResult,
  sessionKey: string,
): Promise<void> {
  const { error: trackErr } = await supabase
    .from('acc_tracks')
    .upsert({ track_key: session.track, display_name: session.track }, { onConflict: 'track_key', ignoreDuplicates: true });
  if (trackErr) throw trackErr;

  try {
    await supabase
      .from('tracks')
      .upsert({ base_track_key: session.track, display_name: session.track }, { onConflict: 'base_track_key', ignoreDuplicates: true })
      .throwOnError();
    await supabase
      .from('track_layouts')
      .upsert(
        { layout_key: session.track, base_track_key: session.track, game: 'ACC', layout_name: null, display_name: session.track },
        { onConflict: 'layout_key', ignoreDuplicates: true },
      )
      .throwOnError();
  } catch (v2Err) {
    console.error(`ACC tracks/track_layouts dual-write failed for "${session.track}":`, v2Err);
  }

  const { error } = await supabase.from(table).upsert(
    {
      session_key: sessionKey,
      event_key: computeAccEventKey(session),
      session_type: session.sessionType,
      track_key: session.track,
      server_name: session.serverName,
      session_date: session.date ?? new Date().toISOString(),
      session_file: session.sessionFile,
      meta_data: session.metaDataRaw,
      championship_id: session.championshipId,
      season_id: session.seasonId,
      is_wet_session: session.isWetSession,
      best_lap_ms: session.bestLapMs,
      results: session.results,
    },
    { onConflict: 'session_key' },
  );
  if (error) throw error;
}
