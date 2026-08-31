import { getStandingsKey, type ChampionshipContent } from '@/content/championships';
import { getAcEvoStandings, getAccStandings } from '@/lib/emperor-standings';
import { getRoundPoints } from '@/lib/acevo-hotlaps';
import { readStandings } from '@/lib/standings-store';
import { EmperorStandingsTable } from './EmperorStandingsTable';
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
    return (
      <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
        <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
          No standings posted yet
        </p>
      </div>
    );
  }

  const roundsWithTrack = champ.schedule.filter((r) => r.emperorRawTrackName);
  const rounds = await Promise.all(
    roundsWithTrack.map(async (r) => ({
      round: r.round,
      track: r.track,
      points: await getRoundPoints(r.emperorRawTrackName!, r.emperorTrack),
    })),
  );

  return (
    <div>
      <EmperorStandingsTable data={result.data} rounds={rounds} />
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
