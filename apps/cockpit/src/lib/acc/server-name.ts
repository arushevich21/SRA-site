// ACCSM server names are "|"-delimited and mix boilerplate (server-manager
// tag, the league's own site URL, hosting/room tags) in with the one or two
// segments that actually distinguish this server (division/season/series) —
// strip the boilerplate segments, keep the rest, case-insensitive since the
// source data isn't consistently cased ("#SRAggTT", "cBOP").
const SERVER_NAME_NOISE = ['sraggtt', 'sragg', 'simracingalliance.com', '#sram', 'cbop'];

export function cleanServerName(serverName: string | null): string | null {
  if (!serverName) return null;
  const kept = serverName
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !SERVER_NAME_NOISE.some((noise) => part.toLowerCase().includes(noise)));
  return kept.length > 0 ? kept.join(' | ') : null;
}
