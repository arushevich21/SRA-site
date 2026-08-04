'use server';

import { getAccTrackLeaderboard, type PaginatedLeaderboard, type EnrichedAccHotLapEntry } from '@/lib/acc/tracks';
import { getAccTrackHotStint, type EnrichedStintEntry } from '@/lib/acc/hotstint';

// Client-side fetch target for AccTrackLeaderboard's page/class controls —
// same pattern as AcEvoRaceResultsTabs' round-tab fetching in
// app/[sim]/standings/actions.ts: click triggers a server action instead of a
// full navigation, so switching page/class feels instant without shipping
// every row up front. board is passed through as plain fields (not the
// AccBoard/AccStintBoard object types) since server action arguments must be
// JSON-serializable and this keeps the call site simple for both variants.
export async function fetchAccLeaderboardPage(params: {
  trackKey: string;
  variant: 'lap' | 'stint';
  scope: 'persistent' | 'seasonal';
  season: string;
  qualifying?: boolean; // stint only, ignored for 'lap'
  page: number;
  classFilter?: string;
}): Promise<PaginatedLeaderboard<EnrichedAccHotLapEntry | EnrichedStintEntry>> {
  const { trackKey, variant, scope, season, page, classFilter } = params;
  if (variant === 'lap') {
    return getAccTrackLeaderboard(trackKey, { scope, season }, { page, classFilter });
  }
  return getAccTrackHotStint(
    trackKey,
    { scope, season, qualifying: params.qualifying ?? false },
    { page, classFilter },
  );
}
