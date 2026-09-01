import { accCarModelName, accCarModelIdByName } from '@sra/domain';
import type { EmperorDriverStanding } from '@sra/shared-types';
import { getStandingsKey, type ChampionshipContent } from '@/content/championships';
import { getAcEvoStandings, getAccStandings } from '@/lib/emperor-standings';
import { getRoundPoints } from '@/lib/acevo-hotlaps';
import { readStandings } from '@/lib/standings-store';
import { supabase as adminClient } from '@/lib/supabase';
import { resolveAccCarLogo } from '@/lib/acc/manufacturer-logo';
import { getDriverInfoBySteamIds, driverInfoFor } from '@/lib/driver-lookup';
import { stripSteamIdPrefix } from '@/lib/steam-id';
import {
  EmperorStandingsTable,
  type EnrichedChampionshipStandings,
  type EnrichedDriverStanding,
} from './EmperorStandingsTable';
import { ClassStandingsTabs } from './ClassStandingsTabs';
import { AcEvoRaceResultsTabs } from './AcEvoRaceResultsTabs';

export async function ChampionshipStandingsBody({ champ }: { champ: ChampionshipContent }) {
  if (champ.emperorChampionshipId) return <AcEvoStandingsSection champ={champ} />;
  if (!champ.teaserOnly && getStandingsKey(champ)) return <LocalStandingsSection champ={champ} />;

  return (
    <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
      <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">Coming soon</p>
    </div>
  );
}

async function LocalStandingsSection({ champ }: { champ: ChampionshipContent }) {
  const key = getStandingsKey(champ)!;
  const localStandings = await readStandings(key);

  if (!localStandings) {
    return (
      <div className="border border-gold-deep/30 bg-gold-deep/5 px-5 py-4">
        <p className="font-mono text-[15px] tracking-[.15em] uppercase text-gold-deep">
          No standings data uploaded yet
        </p>
        <p className="font-sans text-[15px] text-txt-3 mt-1">
          Upload standings with key &quot;{key}&quot; via /admin/standings.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ClassStandingsTabs groups={localStandings} />
      {champ.resultsUrl && (
        <div className="mt-8 pt-5 border-t border-line">
          <a
            href={champ.resultsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[12px] tracking-[.15em] uppercase text-gold hover:text-gold-soft transition-colors"
          >
            {champ.resultsLabel ?? 'View results'} →
          </a>
        </div>
      )}
    </div>
  );
}

type RawEntryDriverJoin = {
  driver_id: string;
  drivers: { display_name: string | null; steam_id: string | null } | null;
};
type RawEntryJoin = {
  car_model_id: number | null;
  registration_drivers: RawEntryDriverJoin[] | null;
};

// Before Emperor has any race results, its championship standings endpoint
// returns empty class groups (confirmed live for both LIAW and GT3 Team
// Series S19 — see the ACC-standings-server fix's PR). Rather than a bare
// "no standings yet" message, show the confirmed entry list itself at 0
// points — same registrations/registration_drivers data the register page's
// entry list reads, just reshaped into EmperorStandingsTable's format. Only
// possible for a championship that actually runs through our own
// registration system (registrationKey/registrationSeason set) — an AC Evo
// championship with no registration flow simply keeps the plain message.
async function getEntryListAsZeroStandings(
  championshipKey: string,
  season: string,
  classTag: string,
): Promise<EnrichedChampionshipStandings | null> {
  const { data } = await adminClient
    .from('registrations')
    .select('car_model_id, registration_drivers(driver_id, drivers(display_name, steam_id))')
    .eq('championship_key', championshipKey)
    .eq('season', season)
    .eq('status', 'confirmed');

  const rawEntries = ((data ?? []) as unknown as RawEntryJoin[]).flatMap((r) =>
    (r.registration_drivers ?? []).map((rd) => ({
      driverName: rd.drivers?.display_name ?? 'Unknown Driver',
      // Falls back to the driver's uuid on an unlinked/unverified Steam
      // account — used here only as a React key and a driver-info lookup
      // key that will simply miss, not matched against anything external
      // the way the public leaderboards match against Emperor/bot data.
      steamId: rd.drivers?.steam_id ?? rd.driver_id,
      carModelId: r.car_model_id,
    })),
  );

  if (rawEntries.length === 0) return null;

  // car_model_id is already numeric here (straight from registrations, not
  // Emperor's reported name string), so this skips accCarModelIdByName
  // entirely — same manufacturer resolution as the register page's entry
  // list, division/tier badge same as HotLapBoard/TeamList.
  const driverInfoMap = await getDriverInfoBySteamIds(rawEntries.map((e) => e.steamId));
  const entries: EnrichedDriverStanding[] = rawEntries
    .map((e) => {
      const info = driverInfoFor(driverInfoMap, e.steamId);
      return {
        driverName: e.driverName,
        steamId: e.steamId,
        carModel: e.carModelId != null ? accCarModelName(e.carModelId) : null,
        points: 0,
        pointsPenalty: 0,
        ...resolveAccCarLogo(e.carModelId),
        isSralien: info.isSralien,
        division: info.division,
        tier: info.tier,
      };
    })
    .sort((a, b) => a.driverName.localeCompare(b.driverName))
    .map((e, i) => ({ ...e, position: i + 1 }));

  return {
    driverStandings: { [classTag]: entries },
    teamStandings: {},
  };
}

// Enriches Emperor's raw driverStandings (car names as plain strings, no
// driver identity beyond steamId) with the same manufacturer icon/logo and
// division/tier/SRAlien badge every other ACC board on the site shows —
// resolved here (ACC standings only; AC Evo keeps its plain rendering, see
// EmperorStandingsTable's `enriched` check) since Emperor itself carries
// neither. Emperor's DriverGUID is 'S'-prefixed like every other ACC data
// source (acc_hotlap_leaderboard.player_id, etc.) — stripped only for the
// drivers-table lookup key, never for the steamId kept on the entry itself
// (that stays whatever format rounds/getRoundPoints already key by).
async function enrichAccDriverStandings(
  driverStandings: Record<string, EmperorDriverStanding[]>,
): Promise<Record<string, EnrichedDriverStanding[]>> {
  const allBareSteamIds = Object.values(driverStandings).flatMap((s) =>
    s.map((e) => stripSteamIdPrefix(e.steamId)),
  );
  const driverInfoMap = await getDriverInfoBySteamIds(allBareSteamIds);

  const enriched: Record<string, EnrichedDriverStanding[]> = {};
  for (const [className, standings] of Object.entries(driverStandings)) {
    enriched[className] = standings.map((entry) => {
      const carModelId = accCarModelIdByName(entry.carModel);
      const info = driverInfoFor(driverInfoMap, stripSteamIdPrefix(entry.steamId));
      return {
        ...entry,
        ...resolveAccCarLogo(carModelId),
        isSralien: info.isSralien,
        division: info.division,
        tier: info.tier,
      };
    });
  }
  return enriched;
}

async function AcEvoStandingsSection({ champ }: { champ: ChampionshipContent }) {
  // ACC's emperor_championship_id lives on one of 7 ACCSM instances (there's
  // no single well-known ACC Emperor host the way AC Evo has one) — see
  // lib/emperor-standings.ts's getAccStandings for how that's resolved.
  // Component name is legacy (predates ACC using this same section); not
  // worth a rename churn on its own.
  const result =
    champ.game === 'AC Evo'
      ? await getAcEvoStandings(champ.emperorChampionshipId!)
      : await getAccStandings(champ.emperorChampionshipId!);

  if (!result.ok) {
    return (
      <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
        <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mb-3">
          Standings temporarily unavailable
        </p>
        <p className="font-sans text-[15px] text-txt-3">
          Emperor&apos;s live data couldn&apos;t be reached. Try again shortly.
        </p>
      </div>
    );
  }

  const isEmpty = Object.values(result.data.driverStandings).every((s) => s.length === 0);
  if (isEmpty) {
    const entryListStandings =
      champ.registrationKey && champ.registrationSeason
        ? await getEntryListAsZeroStandings(champ.registrationKey, champ.registrationSeason, champ.classTag)
        : null;

    if (entryListStandings) {
      return (
        <div>
          <p className="font-mono text-[12px] tracking-[.1em] uppercase text-txt-3 italic mb-4">
            No races scored yet — showing the confirmed entry list at 0 points.
          </p>
          <EmperorStandingsTable data={entryListStandings} />
        </div>
      );
    }

    return (
      <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
        <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
          No standings posted yet
        </p>
      </div>
    );
  }

  const roundsWithTrack = champ.schedule.filter((r) => r.emperorRawTrackName);
  const [rounds, enrichedDriverStandings] = await Promise.all([
    Promise.all(
      roundsWithTrack.map(async (r) => ({
        round: r.round,
        track: r.track,
        points: await getRoundPoints(r.emperorRawTrackName!, r.emperorTrack),
      })),
    ),
    // Enrichment (manufacturer icon, division/tier badge) is ACC-only —
    // Emperor's AC Evo data keeps rendering exactly as before.
    champ.game === 'AC Evo'
      ? Promise.resolve(result.data.driverStandings as Record<string, EnrichedDriverStanding[]>)
      : enrichAccDriverStandings(result.data.driverStandings),
  ]);
  const enrichedData: EnrichedChampionshipStandings = {
    driverStandings: enrichedDriverStandings,
    teamStandings: result.data.teamStandings,
  };

  return (
    <div>
      <EmperorStandingsTable data={enrichedData} rounds={rounds} />
      {roundsWithTrack.length > 0 && (
        <AcEvoRaceResultsTabs
          rounds={roundsWithTrack.map((r) => ({
            round: r.round,
            track: r.track,
            trackKey: r.emperorRawTrackName!,
          }))}
        />
      )}
    </div>
  );
}
