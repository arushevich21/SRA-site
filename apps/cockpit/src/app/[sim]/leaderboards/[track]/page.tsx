import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import {
  findLeaderboardTrack,
  toTrackSummary,
  toTrackTopEntry,
  acEvoManufacturerIconName,
  acEvoManufacturerLogoUrl,
} from '@/lib/leaderboard-tracks';
import { getHotLapBoardByLayoutKey } from '@/lib/acevo-hotlaps';
import { HotLapBoard } from '@/components/HotLapBoard';
import { TrackHeader } from '@/components/TrackHeader';
import {
  getAccTrack,
  getAccTrackLeaderboard,
  toTrackSummary as toAccTrackSummary,
  toTrackTopEntry as toAccTrackTopEntry,
} from '@/lib/acc/tracks';
import { AccTrackLeaderboard } from '@/components/AccTrackLeaderboard';

// Was force-dynamic: caching this route (ISR + generateStaticParams) once
// required capping entries per class to stay under Vercel's ISR page-size
// limit (a busy track's full history serialized way past 19.07MB — see git
// history for the numbers). That cause is gone — the board is now
// query-level paginated (see getAccTrackLeaderboard) rather than capped, so
// full history is still reachable at 300 rows a page, keeping each render
// well under the size limit. Restored to ISR (2026-08-25) to cut Fast Origin
// Transfer / Fluid CPU usage against Vercel's Hobby-plan quotas.
export const revalidate = 300;

export default async function TrackLeaderboardPage({
  params,
}: {
  params: Promise<{ sim: string; track: string }>;
}) {
  const { sim: simSlug, track: trackSlugParam } = await params;
  const sim = getSimBySlug(simSlug);
  if (!sim) notFound();

  // ACC has its own data model (Supabase-backed acc_tracks/acc_hotlap_leaderboard,
  // per-class breakdown, manufacturer logos) — genuinely different from the
  // schedule-driven AC Evo path below. Both adapt into the same TrackHeader
  // component via the shared TrackSummary/TrackTopEntry shapes; only the
  // per-track full board (class-grouped for ACC, flat for AC Evo) differs.
  if (sim.game === 'ACC') {
    // Independent queries (both keyed only on trackSlugParam) — parallelized
    // rather than run one after the other.
    const [track, board] = await Promise.all([
      getAccTrack(trackSlugParam),
      // Page 1, all classes — sorted best_lap_ms ascending, so entries[0] is
      // already the outright fastest across every class combined (no separate
      // query needed, unlike the old getAccTrackTopTimes call this replaced).
      getAccTrackLeaderboard(trackSlugParam),
    ]);
    if (!track) notFound();
    const fastest = board.entries[0];

    return (
      <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
        <Link
          href={`/${sim.slug}/leaderboards`}
          className="inline-block font-mono text-[13px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-8"
        >
          ← All Tracks
        </Link>

        <TrackHeader
          track={toAccTrackSummary(track)}
          fastestLap={fastest ? toAccTrackTopEntry(fastest) : null}
        />

        <AccTrackLeaderboard
          initialEntries={board.entries}
          initialTotalCount={board.totalCount}
          trackKey={trackSlugParam}
          variant="lap"
          scope="persistent"
          season=""
        />
      </section>
    );
  }

  const track = await findLeaderboardTrack(sim.game, trackSlugParam);
  if (!track) notFound();

  const [entries, summary] = await Promise.all([
    getHotLapBoardByLayoutKey(track.layoutKey),
    toTrackSummary(track),
  ]);
  const boardEntries = entries.map((entry) => ({
    ...entry,
    manufacturerIconName: acEvoManufacturerIconName(entry.carModel),
    manufacturerLogoUrl: acEvoManufacturerLogoUrl(entry.carModel),
  }));

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <Link
        href={`/${sim.slug}/leaderboards`}
        className="inline-block font-mono text-[13px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors mb-8"
      >
        ← All Tracks
      </Link>

      <TrackHeader
        track={summary}
        fastestLap={entries[0] ? toTrackTopEntry(entries[0]) : null}
      />

      <HotLapBoard entries={boardEntries} />
    </section>
  );
}
