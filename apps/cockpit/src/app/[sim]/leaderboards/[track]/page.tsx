import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import {
  findLeaderboardTrack,
  toTrackSummary,
  toTrackTopEntry,
  acEvoManufacturerIconName,
} from '@/lib/leaderboard-tracks';
import { getHotLapBoard } from '@/lib/acevo-hotlaps';
import { HotLapBoard } from '@/components/HotLapBoard';
import { TrackHeader } from '@/components/TrackHeader';
import {
  getAccTrack,
  getAccTrackLeaderboard,
  getAccTrackTopTimes,
  toTrackSummary as toAccTrackSummary,
  toTrackTopEntry as toAccTrackTopEntry,
} from '@/lib/acc/tracks';
import { AccTrackLeaderboard } from '@/components/AccTrackLeaderboard';

export const dynamic = 'force-dynamic';

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
    const track = await getAccTrack(trackSlugParam);
    if (!track) notFound();

    const [leaderboardByCarGroup, topEntries] = await Promise.all([
      getAccTrackLeaderboard(trackSlugParam),
      getAccTrackTopTimes(trackSlugParam, 1),
    ]);

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
          fastestLap={topEntries[0] ? toAccTrackTopEntry(topEntries[0]) : null}
        />

        <AccTrackLeaderboard leaderboardByCarGroup={leaderboardByCarGroup} />
      </section>
    );
  }

  const track = findLeaderboardTrack(sim.game, trackSlugParam);
  if (!track) notFound();

  const [entries, summary] = await Promise.all([
    getHotLapBoard(track.rawTrackName, track.emperorTrack),
    toTrackSummary(track),
  ]);
  const boardEntries = entries.map((entry) => ({
    ...entry,
    manufacturerIconName: acEvoManufacturerIconName(entry.carModel),
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
