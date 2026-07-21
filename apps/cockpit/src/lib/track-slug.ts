// URL-safe slug for a track, derived from Emperor's raw track_name (e.g.
// "Circuit Of The Americas" -> "circuit-of-the-americas"). Used for the
// leaderboards "browse by track" routes.
export function trackSlug(rawTrackName: string): string {
  return rawTrackName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
