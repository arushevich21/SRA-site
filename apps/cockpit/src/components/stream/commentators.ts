// Who's in the booth comes from the division's commentary voice channel
// (lib/stream/booths.ts, written by SRA-Bot). This parser is the explicit
// override for when the operator wants to name the booth on the
// browser-source URL instead — a pre-produced segment, a guest who isn't on
// Discord:
//
//   /overlay/commentators/1?names=Alex Mercer|Lead commentator,Jordan Blake|Analyst
//
// Name and role separated by "|", people by ",". Role is optional. Absent
// ?names= means the voice channel, never a typed fallback.

export type Commentator = { name: string; role: string | null };

export function parseCommentators(raw: string | undefined): Commentator[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, role] = entry.split('|').map((s) => s.trim());
      return { name, role: role || null };
    })
    .filter((c) => c.name);
}
