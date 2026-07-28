// Single source of truth for computing drivers.display_name — used by both
// the places that write it (profile save, Discord re-login) so a champion's
// #1 badge (is_champion) and a driver's structured name/number stay
// consistent everywhere, instead of each write path deriving its own string.
export function computeDriverDisplayName(input: {
  firstName: string | null;
  lastName: string | null;
  driverNumber: number | null;
  isChampion: boolean;
  // Used only when no structured name is on file yet (e.g. a brand-new
  // driver who hasn't filled out the profile form) — Discord's global_name.
  fallback: string;
}): string {
  const full = [input.firstName, input.lastName].filter(Boolean).join(' ').trim();
  if (!full) return input.fallback;

  // The reigning champion always displays #1, regardless of the real number
  // on file (driver_number stays their permanent number for standings/
  // registration — see supabase/migrations/20260730_driver_schema_cleanup.sql).
  //
  // No space anywhere around ┊ — matches the Discord bot's own convention
  // exactly (confirmed against every bot-written display_name in the table,
  // e.g. "Elyazid Boulahia┊877"). Adding a space here would only diverge from
  // what the bot writes on its own next nickname sync.
  const number = input.isChampion ? 1 : input.driverNumber;
  return number != null ? `${full}┊${number}` : full;
}
