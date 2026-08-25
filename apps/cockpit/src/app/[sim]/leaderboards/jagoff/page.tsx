import { notFound } from 'next/navigation';
import { accCarManufacturerIconName, accCarModelName, msToLaptime } from '@sra/domain';
import { getSimBySlug } from '@/content/sims';
import { LeaderboardTabs } from '@/components/LeaderboardTabs';
import { GameLabel } from '@/components/GameLabel';
import { HotLapBoard, type HotLapBoardEntry } from '@/components/HotLapBoard';
import { TrackHeader } from '@/components/TrackHeader';
import { SraqServerStatus } from '@/components/SraqServerStatus';
import type { TrackSummary, TrackTopEntry } from '@/lib/track-summary';
import { accCarManufacturerLogoUrl } from '@/lib/acc/manufacturer-logo';
import { getAccTrack, toTrackSummary } from '@/lib/acc/tracks';
import { getSraqServerStatus } from '@/lib/acc/server-status';
import { getDriverInfoBySteamIds, driverInfoFor, stripSteamIdPrefix } from '@/lib/driver-lookup';
import { classifyLapTier, getReferenceLegend } from '@/lib/acc/reference-times';
import { hasSeasonalContent, hasEnduranceReleased } from '@/lib/seasonal-leaderboard';
import {
  getCurrentClassificationScope,
  getJagoffBoard,
  hasHotStintQualifyingContent,
  type JagoffRow,
} from '@/lib/acc/hot-stint-store';

// Same id getJagoffBoard filters on — see hot-stint-store.ts for why it's
// hardcoded rather than imported from the content-layer car-name map.
const JAGUAR_CAR_MODEL_ID = 14;

export const revalidate = 300;

// #Jagoff: in-house side competition, fastest qualifying-window Hot Stint
// average in the Jaguar G3 only — separate from, and additive to, the main
// Hot Stint Qualifying board (that board already keeps a driver's Jaguar
// stint if it happens to be their overall best car; this one exists for
// everyone else's Jaguar attempt, which the car-agnostic board never
// surfaces). Fixed to one car, so carModel/manufacturer icon are constant
// rather than per-row. GT3-gated unconditionally for the reference-tier
// badge since Jaguar G3 is GT3 (see packages/domain/src/acc/acc-constants.ts).
function toJagoffEntry(
  entry: JagoffRow,
  driverInfo: ReturnType<typeof driverInfoFor>,
): HotLapBoardEntry {
  const iconName = accCarManufacturerIconName(JAGUAR_CAR_MODEL_ID);
  const lapTier = entry.trackKey != null ? classifyLapTier(entry.hotstintMs, entry.trackKey, 'stint') : null;
  return {
    rank: entry.position,
    steamId: stripSteamIdPrefix(entry.steamId),
    driverName: entry.driverName,
    carModel: accCarModelName(JAGUAR_CAR_MODEL_ID),
    bestLapMs: entry.hotstintMs,
    bestLap: msToLaptime(entry.hotstintMs) ?? '—',
    sectorsMs: entry.sectorsMs,
    manufacturerIconName: iconName,
    manufacturerLogoUrl: !iconName ? accCarManufacturerLogoUrl(JAGUAR_CAR_MODEL_ID) : null,
    driverNumber: driverInfo.driverNumber,
    country: driverInfo.country,
    isSralien: driverInfo.isSralien,
    division: driverInfo.division,
    tier: driverInfo.tier,
    lapTier,
  };
}

function toTrackTopEntry(
  entry: JagoffRow,
  driverInfo: ReturnType<typeof driverInfoFor>,
): TrackTopEntry {
  const iconName = accCarManufacturerIconName(JAGUAR_CAR_MODEL_ID);
  return {
    rank: entry.position,
    steamId: stripSteamIdPrefix(entry.steamId),
    driverName: entry.driverName,
    carLabel: accCarModelName(JAGUAR_CAR_MODEL_ID),
    manufacturerIconName: iconName,
    manufacturerLogoUrl: !iconName ? accCarManufacturerLogoUrl(JAGUAR_CAR_MODEL_ID) : null,
    bestLap: msToLaptime(entry.hotstintMs) ?? '—',
    driverNumber: driverInfo.driverNumber,
    country: driverInfo.country,
  };
}

export default async function JagoffPage({ params }: { params: Promise<{ sim: string }> }) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();
  if (sim.game !== 'ACC') notFound();

  const scope = await getCurrentClassificationScope();
  const jagoffRows = scope ? await getJagoffBoard(scope) : [];

  const [showSeasonal, showEndurance, showHotStintQualifying, driverInfoMap, sraqStatus] =
    await Promise.all([
      hasSeasonalContent(),
      hasEnduranceReleased(),
      hasHotStintQualifyingContent(),
      getDriverInfoBySteamIds(jagoffRows.map((r) => stripSteamIdPrefix(r.steamId))),
      getSraqServerStatus(),
    ]);

  const entries = jagoffRows.map((r) =>
    toJagoffEntry(r, driverInfoFor(driverInfoMap, stripSteamIdPrefix(r.steamId))),
  );
  const trackKey = jagoffRows[0]?.trackKey ?? null;
  const referenceLegend = trackKey ? getReferenceLegend(trackKey, 'stint') : null;

  const accTrack = trackKey ? await getAccTrack(trackKey) : null;
  const trackSummary: TrackSummary | null = accTrack ? toTrackSummary(accTrack) : null;
  const fastestStint =
    jagoffRows.length > 0
      ? toTrackTopEntry(jagoffRows[0], driverInfoFor(driverInfoMap, stripSteamIdPrefix(jagoffRows[0].steamId)))
      : null;

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
        showHotStintQualifying={showHotStintQualifying}
        showJagoff
      />

      <p className="font-sans text-[15px] text-txt-2 leading-relaxed max-w-[640px] mb-4">
        <span className="text-txt">In-house side competition:</span> fastest Hot Stint average of
        the season, Jaguar G3 only.
      </p>

      <SraqServerStatus servers={sraqStatus} />

      {trackSummary && (
        <TrackHeader track={trackSummary} fastestLap={fastestStint} label="Fastest stint" />
      )}

      {entries.length === 0 ? (
        <div className="border border-line/50 bg-carbon-2 px-8 py-16 text-center">
          <p className="font-sans text-[15px] text-txt-2 leading-relaxed max-w-[560px] mx-auto">
            No Jaguar times yet this season — check back once someone braves the G3.
          </p>
        </div>
      ) : (
        <HotLapBoard entries={entries} timeLabel="Stint Avg" referenceLegend={referenceLegend} />
      )}
    </section>
  );
}
