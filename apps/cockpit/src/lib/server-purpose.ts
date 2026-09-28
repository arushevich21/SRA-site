// Parses the advertised (in-game browser) server name into a readable purpose.
//
// The ACCSM healthcheck reports only the manager's internal label ("SRAM1"),
// but the results JSON for a completed session carries the name the server
// actually advertises, which is where SRA encodes what each box is FOR:
//
//   #SRAggTT | TT | GT3_FreePractice | R | SimRacingAlliance.com | SRAM1 | cBOP
//   #SRAggTT |  | #SRAE | GT3_QuickRace_Public | SimRacingAlliance.com | SRAM4 | cBOP
//
// The format token is the underscored segment; a bare "Q" or "R" segment is
// the conditions preset (qualifying vs race track state). Pure string work —
// no network, no DB — so it's cheap to test exhaustively.

const CONDITIONS: Record<string, string> = {
  Q: 'Quali conditions',
  R: 'Race conditions',
};

/** "GT3_FreePractice" -> "GT3 Free Practice"; "GT3_QuickRace_Public" -> "GT3 Quick Race (Public)". */
function prettifyFormat(token: string): string {
  const parts = token.split('_').filter(Boolean);
  const words = parts.map((p) =>
    // Split CamelCase into words, but leave all-caps class tags (GT3, TCX) alone.
    /^[A-Z0-9]+$/.test(p) ? p : p.replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
  );
  // A trailing "Public"/"Private" reads better parenthesised than as a word.
  const last = words[words.length - 1];
  if (words.length > 1 && /^(Public|Private)$/i.test(last)) {
    return `${words.slice(0, -1).join(' ')} (${last})`;
  }
  return words.join(' ');
}

/**
 * Returns a readable purpose, or null when the name carries no usable signal.
 * Never throws — an unrecognised name is a missing label, not an error.
 */
export function parseServerPurpose(advertisedName: string | null | undefined): string | null {
  if (!advertisedName) return null;

  const segments = advertisedName
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  // The format token is the underscored one. Ignore the URL and the #SRA* tags.
  const formatToken = segments.find(
    (s) => s.includes('_') && !s.includes('.') && !s.startsWith('#'),
  );
  // Conditions is a segment that is EXACTLY "Q" or "R" — matching loosely here
  // would pick up the "R" in unrelated words.
  const conditionsToken = segments.find((s) => /^[QR]$/i.test(s));

  const format = formatToken ? prettifyFormat(formatToken) : null;
  const conditions = conditionsToken ? CONDITIONS[conditionsToken.toUpperCase()] : null;

  if (format && conditions) return `${format} · ${conditions}`;
  return format ?? conditions ?? null;
}
