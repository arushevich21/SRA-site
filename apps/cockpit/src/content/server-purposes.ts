// Hand-curated purpose labels, keyed by server tag (SRAM1..SRAM7) per game.
//
// These OVERRIDE whatever is parsed from the advertised server name. Use one
// when the auto-parsed label reads badly, or when a server has no recent
// sessions for the parser to read (a championship-only box can sit idle for
// weeks). Leave a server out entirely and it falls back to the parsed name,
// which is the right default — an entry here is a promise to keep it updated
// by hand, so only make that promise where it earns its keep.
export const CURATED_SERVER_PURPOSES: Record<string, Record<string, string>> = {
  ACC: {
    // e.g. SRAM7: 'League In A Week — championship server',
  },
  'AC Evo': {},
};

export function curatedPurpose(game: string, serverName: string): string | null {
  return CURATED_SERVER_PURPOSES[game]?.[serverName.toUpperCase()] ?? null;
}
