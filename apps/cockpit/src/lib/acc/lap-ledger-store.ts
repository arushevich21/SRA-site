import type { SupabaseClient } from '@supabase/supabase-js';
import {
  extractAccDriverLaps,
  accLedgerFileKeyFromEmperorUrl,
  accLedgerSourceFromBaseUrl,
  accSessionAtFromFileName,
} from '@sra/domain';

// Writes ACC sessions into the lap ledger (acc_lap_ledger_files +
// acc_lap_ledger, via the acc_lap_ledger_ingest RPC — see
// supabase/migrations/20261012_acc_lap_ledger_and_site_stats.sql).
//
// Takes the client as a parameter rather than importing '../supabase'
// (which pulls in 'server-only') so the backfill script can use it too —
// same pattern as ingest-session.ts.
//
// SRA-Bot records the same ACCSM sessions from disk under the same canonical
// file_key, so whichever writer sees a session first records it and the
// other's insert is a no-op.

export type LapLedgerFile = {
  file_key: string;
  source: 'accsm1' | 'accsm2';
  session_type: string;
  track_key: string;
  session_at: string;
  drivers: Array<{ steam_id: string; car_model_id: number; driver_name: string; laps: number; valid_laps: number }>;
};

// null when the session can't be keyed (a host the ledger has no source for,
// or a URL that isn't a results download) — the caller just skips it.
export function buildLapLedgerFile(baseUrl: string, resultsJsonUrl: string, raw: unknown): LapLedgerFile | null {
  const source = accLedgerSourceFromBaseUrl(baseUrl);
  if (!source) return null;
  const fileKey = accLedgerFileKeyFromEmperorUrl(source, resultsJsonUrl);
  if (!fileKey) return null;
  const stem = fileKey.slice(fileKey.lastIndexOf('/') + 1);
  const sessionAt = accSessionAtFromFileName(stem);
  if (!sessionAt) return null;

  const session = (raw ?? {}) as { sessionType?: string; trackName?: string };
  return {
    file_key: fileKey,
    source,
    session_type: String(session.sessionType ?? '?'),
    track_key: String(session.trackName ?? '?').trim(),
    session_at: sessionAt.toISOString(),
    drivers: extractAccDriverLaps(raw).map((d) => ({
      steam_id: d.steamId,
      car_model_id: d.carModelId,
      driver_name: d.driverName,
      laps: d.laps,
      valid_laps: d.validLaps,
    })),
  };
}

// One transaction per call; already-recorded file_keys are skipped. Returns
// how many files were newly recorded.
export async function ingestLapLedgerInto(client: SupabaseClient, files: LapLedgerFile[]): Promise<number> {
  if (files.length === 0) return 0;
  const { data, error } = await client.rpc('acc_lap_ledger_ingest', { p_files: files });
  if (error) throw new Error(`acc_lap_ledger_ingest failed: ${error.message}`);
  return Number(data ?? 0);
}
