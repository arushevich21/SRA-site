import 'server-only';
import { supabase } from '@/lib/supabase';
import type { DriverTier } from '@/lib/driver-tier-badge';

// The public face of one drivers row — shared by /drivers/[id] and the
// head-to-head pages under it.

export type DriverProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  photo_url: string | null;
  country: string | null;
  driver_number: number | null;
  steam_id: string | null;
  division_id: number | null;
  tier: DriverTier | null;
  is_sralien: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getDriverProfile(id: string): Promise<DriverProfileRow | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await supabase
    .from('drivers')
    .select('id, display_name, avatar_url, photo_url, country, driver_number, steam_id, division_id, tier, is_sralien')
    .eq('id', id)
    .maybeSingle();
  if (error) console.error('driver profile lookup failed:', error);
  return (data as DriverProfileRow | null) ?? null;
}

// drivers rows for a set of S-prefixed player ids (e.g. a rivals list).
export async function getDriversByPlayerIds(
  playerIds: string[],
): Promise<Map<string, Pick<DriverProfileRow, 'id' | 'display_name' | 'driver_number'>>> {
  const bare = playerIds.map((p) => (p.startsWith('S') ? p.slice(1) : p));
  if (bare.length === 0) return new Map();
  const { data, error } = await supabase.from('drivers').select('id, display_name, driver_number, steam_id').in('steam_id', bare);
  if (error) console.error('drivers by player id failed:', error);
  return new Map(
    (data ?? []).map((d) => [
      `S${d.steam_id as string}`,
      { id: d.id as string, display_name: d.display_name as string, driver_number: d.driver_number as number | null },
    ]),
  );
}
