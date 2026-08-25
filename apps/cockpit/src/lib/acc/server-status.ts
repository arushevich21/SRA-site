import 'server-only';
import { supabase } from '../supabase';

// #SRAQ1-5 qualifying-server status (Task F, 2026-08-25). This is a
// FRESHNESS signal, not a live query — SRA-Bot writes this table from the
// loop that already reads each server's results directory every 5 minutes
// (update_leaderboards.py), not from any live server query cockpit could
// make itself (there's no public healthcheck API for these 5 servers the
// way there is for the general SRAM1-7 fleet — see AccServerStatus.tsx for
// that one, a genuinely different mechanism). If the bot's cron stops
// running, this table just goes stale; render that honestly (age of
// updated_at/last_seen_at), never a green/red dot implying a live check
// that isn't happening.
export type SraqServerStatus = {
  serverKey: string;
  label: string;
  lastSeenAt: string | null; // ISO — newest session the bot has actually seen
  trackKey: string | null;
  updatedAt: string; // ISO — when the bot's loop last checked this server at all
};

export async function getSraqServerStatus(): Promise<SraqServerStatus[]> {
  const { data, error } = await supabase
    .from('server_status')
    .select('server_key, label, last_seen_at, track_key, updated_at')
    .like('server_key', 'sraq%')
    .order('server_key', { ascending: true });

  if (error) {
    console.error('SRAQ server status lookup failed:', error);
    return [];
  }

  return (data ?? []).map((r) => ({
    serverKey: r.server_key as string,
    label: r.label as string,
    lastSeenAt: r.last_seen_at as string | null,
    trackKey: r.track_key as string | null,
    updatedAt: r.updated_at as string,
  }));
}
