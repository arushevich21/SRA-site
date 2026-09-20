import 'server-only';
import { unstable_cache } from 'next/cache';
import { fetchHotlapSeasons, hasEnduranceReleased } from '../seasonal-leaderboard';
import { getHotStintSeasons } from './hotstint';
import { hasHotStintQualifyingContent, hasJagoffContent } from './hot-stint-store';
import { getAccTrack, type AccTrack } from './tracks';

// The static "shell" of the ACC seasonal leaderboard pages — everything that
// is NOT lap-time data: the season lists behind the <SeasonSelect>s, the
// LeaderboardTabs visibility flags, and a track's display metadata. None of
// this changes more than a few times a season, so it's cached under one entry
// and the page renders its chrome with zero Supabase round trips; the
// lap-time data is handled separately by each page (streamed uncached for
// the live season, rendered once and cached indefinitely for frozen ones —
// see isFrozenSeason in acc/seasons.ts).
//
// Two lifetimes for the same data:
//   live   (1h)   — the current season's pages are rendered per request and
//                   pick up a new season / flipped tab within the hour.
//   frozen (∞)    — a finished season's page is rendered ONCE and cached
//                   indefinitely, and any finite-revalidate cache touched in
//                   that render would cap the route's own lifetime to match.
//                   So frozen pages read a `revalidate: false` copy instead.
//                   Both copies carry the tags, so a revalidateTag refreshes
//                   frozen pages too (and a deploy clears everything anyway).
//
// Admin writes that change what the shell shows should bust
// ACC_LEADERBOARD_SHELL_TAG — saveChampionship/deleteChampionship
// (admin/events/actions.ts) do, since a round's hotlapReleased flag drives the
// Endurance tab. The hot-stint qualifying / jagoff tab flags follow the
// classification scope, which has no tag call site, so they can lag by up to
// the hour on live pages; both tabs still link to pages that render correctly
// regardless.
export const ACC_LEADERBOARD_SHELL_TAG = 'acc-leaderboard-shell';
export const ACC_TRACK_META_TAG = 'acc-tracks';

const LIVE_TTL_SECONDS = 3600;

export type AccLeaderboardShell = {
  seasons: string[]; // hot-lap seasonal seasons, newest first
  stintSeasons: string[]; // hot-stint seasonal seasons, newest first
  showEndurance: boolean;
  showHotStintQualifying: boolean;
  showJagoff: boolean;
};

// Deliberately calls the UNCACHED season scans (fetchHotlapSeasons, not
// getHotlapSeasons): a nested 1h unstable_cache executing inside the frozen
// copy's miss would propagate its 1h to the frozen route.
async function fetchAccLeaderboardShell(): Promise<AccLeaderboardShell> {
  const [seasons, stintSeasons, showEndurance, showHotStintQualifying, showJagoff] = await Promise.all([
    fetchHotlapSeasons(),
    getHotStintSeasons(),
    hasEnduranceReleased(),
    hasHotStintQualifyingContent(),
    hasJagoffContent(),
  ]);
  return { seasons, stintSeasons, showEndurance, showHotStintQualifying, showJagoff };
}

const shellTags = [ACC_LEADERBOARD_SHELL_TAG, 'acc-hotlap-seasons'];

export function getAccLeaderboardShell(opts: { frozen?: boolean } = {}): Promise<AccLeaderboardShell> {
  return opts.frozen
    ? unstable_cache(fetchAccLeaderboardShell, ['acc-leaderboard-shell', 'frozen'], {
        revalidate: false,
        tags: shellTags,
      })()
    : unstable_cache(fetchAccLeaderboardShell, ['acc-leaderboard-shell'], {
        revalidate: LIVE_TTL_SECONDS,
        tags: shellTags,
      })();
}

// Track display metadata (name, art, location) for the per-track page's
// header — the acc_tracks table is effectively static, so it belongs to the
// shell rather than to the lap fetch. Same live/frozen split as above.
export function getAccTrackMeta(trackKey: string, opts: { frozen?: boolean } = {}): Promise<AccTrack | null> {
  return opts.frozen
    ? unstable_cache(getAccTrack, ['acc-track-meta', 'frozen'], {
        revalidate: false,
        tags: [ACC_TRACK_META_TAG],
      })(trackKey)
    : unstable_cache(getAccTrack, ['acc-track-meta'], {
        revalidate: LIVE_TTL_SECONDS,
        tags: [ACC_TRACK_META_TAG],
      })(trackKey);
}
