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

// Composite identity for a track+layout combination — e.g. "Road Atlanta" +
// "GP" -> "road-atlanta__gp". Different layouts of the same physical track
// aren't comparable leaderboards, so they must never share a key.
//
// This is the SINGLE place that key format is decided — both the write side
// (AC Evo's hot-lap cache, keyed from the real downloaded session's own
// track/trackLayout fields) and the read side (the leaderboards UI, keyed
// from content/championships.ts's authored emperorRawTrackName + the layout
// parsed out of emperorTrack) must call this exact function. If they
// diverge, the read side silently finds nothing rather than erroring.
export function buildTrackKey(track: string, layout?: string | null): string {
  const trackPart = trackSlug(track);
  return layout ? `${trackPart}__${trackSlug(layout)}` : trackPart;
}

// content/championships.ts authors layout info as "TrackName,Layout" in
// emperorTrack (originally for Emperor's own leaderboard ?track= param) —
// this pulls just the layout part out for buildTrackKey(), e.g.
// "Road Atlanta,GP" -> "GP". Returns null when emperorTrack is absent or has
// no comma (single-layout track, e.g. Laguna Seca).
export function parseEmperorTrackLayout(emperorTrack?: string | null): string | null {
  if (!emperorTrack) return null;
  const commaIndex = emperorTrack.indexOf(',');
  if (commaIndex === -1) return null;
  const layout = emperorTrack.slice(commaIndex + 1).trim();
  return layout || null;
}
