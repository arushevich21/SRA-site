import { notFound } from 'next/navigation';
import { accCarManufacturerIconName, msToLaptime } from '@sra/domain';
import { getSimBySlug } from '@/content/sims';
import { LeaderboardTabs } from '@/components/LeaderboardTabs';
import { GameLabel } from '@/components/GameLabel';
import { HotLapBoard, type HotLapBoardEntry } from '@/components/HotLapBoard';
import { TrackHeader } from '@/components/TrackHeader';
import { SraqServerStatus } from '@/components/SraqServerStatus';
import { ClassificationSignupNotice } from '@/components/ClassificationSignupNotice';
import { HotStintDeadlineCountdown } from '@/components/HotStintDeadlineCountdown';
import type { TrackSummary, TrackTopEntry } from '@/lib/track-summary';
import { accCarManufacturerLogoUrl } from '@/lib/acc/manufacturer-logo';
import { getAccTrack, toTrackSummary } from '@/lib/acc/tracks';
import { getSraqServerStatus } from '@/lib/acc/server-status';
import { getDriverInfoBySteamIds, driverInfoFor } from '@/lib/driver-lookup';
import { classifyLapTier, getReferenceLegend } from '@/lib/acc/reference-times';
import { hasSeasonalContent, hasEnduranceReleased } from '@/lib/seasonal-leaderboard';
import {
  getCurrentClassificationScope,
  getPublicHotStintLeaderboard,
  hasJagoffContent,
  type PublicHotStintRow,
} from '@/lib/acc/hot-stint-store';
import { getCalendarEventBySlug } from '@/lib/calendar-events-store';
import { HOT_STINT_QUALIFYING_DEADLINE_SLUG } from '@/lib/acc/hot-stint-deadline';

// Data is written by an external bot on its own schedule, not a cron in this
// app (see lib/acc/hot-stint-store.ts) — revalidate, not force-dynamic, same
// reasoning as every other leaderboard page here: this is read traffic
// against data nobody in this codebase controls the write cadence of, and
// force-dynamic disables caching entirely for no benefit.
export const revalidate = 300;

// Hot Stint Qualifying reuses HotLapBoard, same as every other Hot Stint
// board — full visual parity, not just the same component shell:
//   - steam_id is public here (see 20260825_classification_status_car_
//     model.sql: confirmed 2026-08-25 that the actual hard requirement was
//     only ever "lap counts stay hidden", not steamId), so the component's
//     row keying and "My Laps" filter work unmodified.
//   - sectors_ms is the per-sector average across the winning 5-lap stint
//     (acc_hotstint_leaderboard already stores this, same meaning as
//     hotstint_ms being the overall average) — carried straight through.
//   - lapTier is computed per row via classifyLapTier, same gate
//     (carGroup === 'GT3' && dry) and the same 'stint' variant
//     lib/acc/hotstint.ts uses for the other Hot Stint boards.
// num_laps remains permanently admin-only — see
// app/admin/hot-stint-qualifying/page.tsx.
//
// One row per (driver, car) qualifying stint, same as the Hot Stint
// (Seasonal) board — NOT collapsed to each driver's single best. A driver
// who set qualifying stints in three different cars shows three rows here
// by default; HotLapBoard's own "Unique Drivers" toggle is what collapses
// that to their single best regardless of car (see hot-stint-store.ts's
// getPublicHotStintLeaderboard and 20260825b_classification_public_all_
// stints.sql — an earlier version of this baked that collapse into the SQL
// itself, which was wrong). #Jagoff (its own tab, see app/[sim]/
// leaderboards/jagoff/page.tsx) is a Jaguar-only view of the same
// underlying stints, useful for a focused ranking rather than because
// Jaguar attempts are otherwise hidden here — they aren't, anymore.
function toHotLapEntry(
  entry: PublicHotStintRow,
  driverInfo: ReturnType<typeof driverInfoFor>,
): HotLapBoardEntry {
  const iconName = entry.carModel != null ? accCarManufacturerIconName(entry.carModel) : null;
  const lapTier =
    entry.carGroup === 'GT3' && entry.trackKey != null
      ? classifyLapTier(entry.hotstintMs, entry.trackKey, 'stint')
      : null;
  return {
    rank: entry.position,
    steamId: entry.steamId,
    driverName: entry.driverName,
    carModel: entry.carModelName,
    bestLapMs: entry.hotstintMs,
    bestLap: msToLaptime(entry.hotstintMs) ?? '—',
    sectorsMs: entry.sectorsMs,
    manufacturerIconName: iconName,
    manufacturerLogoUrl:
      !iconName && entry.carModel != null ? accCarManufacturerLogoUrl(entry.carModel) : null,
    driverNumber: driverInfo.driverNumber,
    country: driverInfo.country,
    isSralien: driverInfo.isSralien,
    division: driverInfo.division,
    tier: driverInfo.tier,
    lapTier,
  };
}

// The legend strip shown above the board (and the TrackHeader below) need
// one trackKey to build cutoff times / hero art against. Almost every
// season classifies on a single fixed track (see the migration header), so
// the top-ranked entry's track is the representative choice — same track
// every other entry's own per-row badge (above) was computed against, in
// the overwhelmingly common case where they all share one.
function representativeTrackKey(rows: PublicHotStintRow[]): string | null {
  return rows[0]?.trackKey ?? null;
}

// Mirrors lib/acc/tracks.ts's toAccTrackTopEntry — same shape, built from
// the classification leaderboard's #1 row instead of a per-track hot-lap/
// hot-stint board query. rows is already sorted by hotstint_ms ascending
// (see getPublicHotStintLeaderboard), so rows[0] is the outright quickest.
function toTrackTopEntry(
  entry: PublicHotStintRow,
  driverInfo: ReturnType<typeof driverInfoFor>,
): TrackTopEntry {
  const iconName = entry.carModel != null ? accCarManufacturerIconName(entry.carModel) : null;
  return {
    rank: entry.position,
    steamId: entry.steamId,
    driverName: entry.driverName,
    carLabel: entry.carModelName,
    manufacturerIconName: iconName,
    manufacturerLogoUrl:
      !iconName && entry.carModel != null ? accCarManufacturerLogoUrl(entry.carModel) : null,
    bestLap: msToLaptime(entry.hotstintMs) ?? '—',
    driverNumber: driverInfo.driverNumber,
    country: driverInfo.country,
  };
}

export default async function HotStintQualifyingPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();
  if (sim.game !== 'ACC') notFound();

  // showSeasonal/showEndurance/showJagoff/sraqStatus don't depend on the
  // classification scope or its rows — fire them alongside scope instead of
  // waiting until after rows resolves.
  const [scope, showSeasonal, showEndurance, showJagoff, sraqStatus, deadlineEvent] =
    await Promise.all([
      getCurrentClassificationScope(),
      hasSeasonalContent(),
      hasEnduranceReleased(),
      hasJagoffContent(),
      getSraqServerStatus(),
      getCalendarEventBySlug(HOT_STINT_QUALIFYING_DEADLINE_SLUG),
    ]);
  const rows = scope ? await getPublicHotStintLeaderboard(scope.series, scope.season) : [];
  const trackKey = representativeTrackKey(rows);

  // driverInfoMap and accTrack both depend only on rows/trackKey, not on each
  // other — run them together rather than one after the other.
  // toAccTrack (lib/acc/tracks.ts) already resolves splashArtUrl to the
  // recovered hero photo, same as every other track page.
  const [driverInfoMap, accTrack] = await Promise.all([
    getDriverInfoBySteamIds(rows.map((r) => r.steamId)),
    trackKey ? getAccTrack(trackKey) : Promise.resolve(null),
  ]);

  const entries = rows.map((r) => toHotLapEntry(r, driverInfoFor(driverInfoMap, r.steamId)));
  const referenceLegend = trackKey ? getReferenceLegend(trackKey, 'stint') : null;

  // TrackHeader, same as the other Hot Stint boards' [track] pages — built
  // from the classification track (see representativeTrackKey above).
  const trackSummary: TrackSummary | null = accTrack ? toTrackSummary(accTrack) : null;
  const fastestStint =
    rows.length > 0 ? toTrackTopEntry(rows[0], driverInfoFor(driverInfoMap, rows[0].steamId)) : null;

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
        showSeasonal={showSeasonal}
        showEndurance={showEndurance}
        showHotStintQualifying
        showJagoff={showJagoff}
      />

      <p className="font-sans text-[15px] text-txt-2 leading-relaxed max-w-[640px] mb-4">
        Hot Stint Qualifying ranks each driver by the{' '}
        <span className="text-txt">average of their best 5 consecutive valid laps</span> set
        during the pre-season classification window — used to assign divisions before the
        season begins.
      </p>

      {deadlineEvent && (
        <HotStintDeadlineCountdown
          deadlineIso={deadlineEvent.eventDate}
          opensIso={deadlineEvent.opensAt}
        />
      )}

      <ClassificationSignupNotice />

      <SraqServerStatus servers={sraqStatus} />

      {trackSummary && (
        <TrackHeader track={trackSummary} fastestLap={fastestStint} label="Fastest stint" />
      )}

      {entries.length === 0 ? (
        <div className="border border-line/50 bg-carbon-2 px-8 py-16 text-center">
          <p className="font-sans text-[15px] text-txt-2 leading-relaxed max-w-[560px] mx-auto">
            {scope
              ? 'No qualifying times yet — check back once drivers start setting times on the classification server.'
              : 'Hot Stint Qualifying is not currently running.'}
          </p>
        </div>
      ) : (
        <HotLapBoard entries={entries} timeLabel="Stint Avg" referenceLegend={referenceLegend} />
      )}
    </section>
  );
}
