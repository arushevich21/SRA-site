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
import { getCurrentDriverContext } from '@/lib/current-driver';
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

    const [leaderboardByCarGroup, topEntries, currentDriver] = await Promise.all([
      getAccTrackLeaderboard(trackSlugParam),
      getAccTrackTopTimes(trackSlugParam, 1),
      getCurrentDriverContext(),
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

        <AccTrackLeaderboard
          leaderboardByCarGroup={leaderboardByCarGroup}
          currentSteamId={currentDriver.steamId}
          currentDivision={currentDriver.division}
          trackKey={trackSlugParam}
          variant="lap"
        />
      </section>
    );
  }

  const track = await findLeaderboardTrack(sim.game, trackSlugParam);
  if (!track) notFound();

  const [entries, summary, currentDriver] = await Promise.all([
    getHotLapBoardByLayoutKey(track.layoutKey),
    toTrackSummary(track),
    getCurrentDriverContext(),
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

      <HotLapBoard
        entries={boardEntries}
        currentSteamId={currentDriver.steamId}
        currentDivision={currentDriver.division}
      />
    </section>
  );
}
