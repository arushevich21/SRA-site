import { supabase } from './supabase';
import type { StandingsExport } from './standings-types';

const VALID_KEY = /^[a-z0-9][a-z0-9-]*$/;

export function isValidStandingsKey(key: string): boolean {
  return VALID_KEY.test(key) && !key.includes('..');
}

export async function writeStandings(
  key: string,
  data: StandingsExport,
): Promise<void> {
  const { error } = await supabase
    .from('standings')
    .upsert(
      { standings_key: key, data, updated_at: new Date().toISOString() },
      { onConflict: 'standings_key' },
    );
  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
}

export async function readStandings(
  key: string,
): Promise<StandingsExport | null> {
  const { data, error } = await supabase
    .from('standings')
    .select('data')
    .eq('standings_key', key)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Supabase read failed: ${error.message}`);
  }

  return data.data as StandingsExport;
}
