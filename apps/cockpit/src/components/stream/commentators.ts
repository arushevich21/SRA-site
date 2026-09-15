// Who's in the booth. There is no live source yet — the plan is for SRA-Bot
// to POST Discord voice-channel snapshots (two booth channels, one per
// concurrent broadcast) to a site endpoint and for this to read the roster
// for the active stream, keeping the last good snapshot across OBS refreshes.
// Until then the operator sets the booth on the browser-source URL:
//
//   /overlay/commentators/1?names=Alex Mercer|Lead commentator,Jordan Blake|Analyst
//
// Name and role separated by "|", people by ",". Role is optional.

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
