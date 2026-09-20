// Pure — no Supabase / server-only imports, so ingest-session.ts (which plain
// tsx scripts also run) can share it with tracks.ts.
import { accTrackDisplayName } from '@/content/sim-catalog';

// A usable display name for a track_key. The ingest (ingest-session.ts) used
// to seed acc_tracks / track_layouts rows for a never-seen track with
// display_name = track_key, and since track_layouts wins over acc_tracks here,
// a raw "brands_hatch" in track_layouts masked a perfectly good "Brands Hatch"
// in acc_tracks. So: first non-empty candidate that isn't just the key itself,
// else the sim catalog's name, else the key humanized ("oulton_park" →
// "Oulton Park") — never the underscore key.
export function resolveAccTrackName(trackKey: string, ...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    const name = c?.trim();
    if (name && name !== trackKey) return name;
  }
  return (
    accTrackDisplayName(trackKey) ??
    trackKey.split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
  );
}
