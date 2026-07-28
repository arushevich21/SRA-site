// Pure, no DB access — safe to import from client components (unlike
// lib/driver-lookup.ts, which is marked 'server-only' because it queries the
// drivers table). acc_hotlap_leaderboard/acc_hotstint_leaderboard store
// SteamID64 with a leading "S"; drivers.steam_id and AC Evo's leaderboard
// tables store it bare. A real SteamID64 is purely numeric (always starts
// with "7"), so stripping a leading "S" is unambiguous.
export function stripSteamIdPrefix(steamId: string): string {
  return steamId.startsWith('S') ? steamId.slice(1) : steamId;
}
