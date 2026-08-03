import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import {
  findLeaderboardTrack,
  getLeaderboardTracks,
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
  getAccTracks,
  getAccTrackLeaderboard,
  toTrackSummary as toAccTrackSummary,
  toTrackTopEntry as toAccTrackTopEntry,
} from '@/lib/acc/tracks';
import { AccTrackLeaderboard } from '@/components/AccTrackLeaderboard';
import { outrightFastest } from '@/lib/track-summary';

// Hot-lap data refreshes via cron (see api/cron/refresh-*-leaderboard), which
// revalidates this exact path on-demand for whichever track(s) it touched —
// this ceiling is just a safety net, not the primary freshness mechanism.
export const revalidate = 300;

// Pre-declared so these paths are genuinely prerendered/ISR-cached rather than
// relying on on-demand generation for a segment with dynamicParams left at
// its default (true) — verified locally that on-demand generation for an
// unenumerated dynamic segment doesn't show up as cached under `next start`,
// and there was no reliable way to confirm from here whether that's just a
// local-server limitation or also true on Vercel. Explicitly listing every
// known track removes that uncertainty; dynamicParams stays true by default,
// so a track added after a deploy still renders (uncached) rather than 404s.
export async function generateStaticParams(): Promise<{ sim: string; track: string }[]> {
  const [accTracks, acevoTracks] = await Promise.all([
    getAccTracks(),
    getLeaderboardTracks('AC Evo'),
  ]);
  return [
    ...accTracks.map((t) => ({ sim: 'acc', track: t.trackKey })),
    ...acevoTracks.map((t) => ({ sim: 'acevo', track: t.slug })),
  ];
}

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

    const leaderboardByCarGroup = await getAccTrackLeaderboard(trackSlugParam);
    const fastest = outrightFastest(leaderboardByCarGroup);

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
          leaderboardByCarGroup={leaderboardByCarGroup}
          trackKey={trackSlugParam}
          variant="lap"
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
