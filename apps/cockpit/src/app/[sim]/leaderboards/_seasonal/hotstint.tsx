import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LeaderboardTabs } from '@/components/LeaderboardTabs';
import { TrackList } from '@/components/TrackList';
import { SeasonSelect } from '@/components/SeasonSelect';
import { GameLabel } from '@/components/GameLabel';
import { TrackHeader } from '@/components/TrackHeader';
import { AccTrackLeaderboard } from '@/components/AccTrackLeaderboard';
import type { SimConfig as Sim } from '@/content/sims';
import { getAccLeaderboardShell, getAccTrackMeta } from '@/lib/acc/leaderboard-shell';
import { toTrackSummary as toAccTrackSummary, toTrackTopEntry as toAccTrackTopEntry } from '@/lib/acc/tracks';
import { getAccTrackHotStint, getSeasonStintTrackList, type AccStintBoard } from '@/lib/acc/hotstint';
import { hasWetSessionRows } from '@/lib/seasonal-leaderboard';
import type { TrackSummary } from '@/lib/track-summary';
import { BoardSkeleton, TrackListSkeleton } from './skeletons';

// Page bodies for the Hot Stint (Seasonal) routes — the stint twin of
// ./hotlap.tsx; see its header comment for the live/archive route split and
// why it exists. Pinned to the dry, non-qualifying stint board.

export async function StintSeasonBody({ sim, season, frozen }: { sim: Sim; season: string; frozen: boolean }) {
  const shell = await getAccLeaderboardShell({ frozen });
  if (!shell.stintSeasons.includes(season)) notFound();

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — <GameLabel game={sim.game} /> Leaderboards
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Leaderboards
      </h1>

      <LeaderboardTabs
        simSlug={sim.slug}
        showSeasonal={shell.stintSeasons.length > 0}
        showEndurance={shell.showEndurance}
        showHotStintQualifying={shell.showHotStintQualifying}
        showJagoff={shell.showJagoff}
      />

      <div className="mb-8">
        <SeasonSelect
          seasons={shell.stintSeasons}
          selected={season}
          basePath={`/${sim.slug}/leaderboards/hotstint/seasonal`}
        />
      </div>

      {frozen ? (
        <SeasonTrackList season={season} simSlug={sim.slug} frozen />
      ) : (
        <Suspense fallback={<TrackListSkeleton />}>
          <SeasonTrackList season={season} simSlug={sim.slug} frozen={false} />
        </Suspense>
      )}
    </section>
  );
}

async function SeasonTrackList({ season, simSlug, frozen }: { season: string; simSlug: string; frozen: boolean }) {
  const tracks = await getSeasonStintTrackList(season, { uncached: frozen });

  if (tracks.length === 0) {
    return (
      <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
        <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
          No rounds released for {season} yet
        </p>
      </div>
    );
  }

  return (
    <TrackList tracks={tracks} simSlug={simSlug} basePath={`/${simSlug}/leaderboards/hotstint/seasonal/${season}`} />
  );
}

export async function StintTrackBody({
  sim,
  season,
  trackKey,
  frozen,
}: {
  sim: Sim;
  season: string;
  trackKey: string;
  frozen: boolean;
}) {
  const [shell, track] = await Promise.all([getAccLeaderboardShell({ frozen }), getAccTrackMeta(trackKey, { frozen })]);
  if (!track) notFound();
  if (!shell.stintSeasons.includes(season)) notFound();
  const trackSummary = toAccTrackSummary(track);

  const board = <TrackBoard trackKey={trackKey} season={season} trackSummary={trackSummary} frozen={frozen} />;

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <Link
        href={`/${sim.slug}/leaderboards/hotstint/seasonal/${season}`}
        className="inline-block font-mono text-[13px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-8"
      >
        ← {season} Tracks
      </Link>

      {frozen ? (
        board
      ) : (
        <Suspense
          fallback={
            <>
              <TrackHeader track={trackSummary} fastestLap={null} label="Fastest stint" />
              <BoardSkeleton label="Loading stint times" />
            </>
          }
        >
          {board}
        </Suspense>
      )}
    </section>
  );
}

// entries[0] is already the outright fastest stint across every class (page
// 1, no class filter, sorted ascending) — no separate getAccTrackTopStints.
async function TrackBoard({
  trackKey,
  season,
  trackSummary,
  frozen,
}: {
  trackKey: string;
  season: string;
  trackSummary: TrackSummary;
  frozen: boolean;
}) {
  const board: AccStintBoard = { scope: 'seasonal', season, qualifying: false };
  const [leaderboardByCarGroup, isWet] = await Promise.all([
    getAccTrackHotStint(trackKey, board, { fresh: true }),
    hasWetSessionRows('acc_hotstint_leaderboard', trackKey, season, { qualifying: false }, { uncached: frozen }),
  ]);
  const fastest = leaderboardByCarGroup.entries[0];

  return (
    <>
      <TrackHeader
        track={isWet ? { ...trackSummary, displayName: `${trackSummary.displayName} (Wet)` } : trackSummary}
        fastestLap={fastest ? toAccTrackTopEntry(fastest) : null}
        label="Fastest stint"
      />

      <AccTrackLeaderboard
        initialEntries={leaderboardByCarGroup.entries}
        initialTotalCount={leaderboardByCarGroup.totalCount}
        timeLabel="Stint Avg"
        trackKey={trackKey}
        variant="stint"
        scope="seasonal"
        season={season}
        qualifying={false}
      />
    </>
  );
}
