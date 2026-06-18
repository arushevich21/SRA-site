import { GridOSClient } from '@sra/simgrid-client';
import { GridOSError } from '@sra/shared-types';
import { readStandings } from '../../../lib/standings-store';
import { ClassGroupTable } from '../../../components/ClassGroupTable';

const CHAMPIONSHIP_ID = 22872;

export default async function MulticlassStandingsPage() {
  const [localStandings, champResult] = await Promise.all([
    readStandings(CHAMPIONSHIP_ID),
    fetchChampionship(CHAMPIONSHIP_ID),
  ]);

  return (
    <section className="max-w-[1280px] mx-auto px-7 py-24">
      <span className="block font-mono text-[11px] tracking-[.3em] uppercase text-gold mb-5">
        — Standings
      </span>
      <h1 className="font-display font-black text-[clamp(40px,6vw,72px)] uppercase leading-[.9] tracking-[-1px] text-txt">
        Multiclass Mayhem
      </h1>
      <p className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-2 mt-3">
        LMU · Season 3 · Split 1
      </p>

      {/* Championship metadata from SimGrid */}
      {champResult && (
        <div className="mt-8 border border-line bg-panel p-6">
          <p className="font-mono text-[10px] tracking-[.35em] uppercase text-txt-3 mb-3">
            Schedule
          </p>
          <div className="flex flex-col">
            {champResult.races.map((race, i) => {
              const ended = race.ended;
              const hasResults = race.resultsAvailable;
              return (
                <div
                  key={race.id}
                  className={[
                    'flex items-center gap-5 py-[9px]',
                    i < champResult.races.length - 1 ? 'border-b border-line/50' : '',
                  ].join(' ')}
                >
                  <span className="font-mono text-[11px] tracking-[.2em] uppercase text-gold w-10 shrink-0">
                    R{i + 1}
                  </span>
                  <span className="font-display font-bold text-[15px] uppercase leading-none text-txt-2 flex-1 min-w-0 truncate">
                    {race.track.name}
                  </span>
                  <span className="font-mono text-[10px] tracking-[.15em] uppercase text-txt-3 shrink-0 w-20 text-right">
                    {new Date(race.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span
                    className={[
                      'font-mono text-[9px] tracking-[.2em] uppercase shrink-0 w-28 text-right',
                      hasResults ? 'text-gold' : ended ? 'text-txt-3' : 'text-live',
                    ].join(' ')}
                  >
                    {hasResults ? 'Results' : ended ? 'Pending' : 'Upcoming'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Standings tables */}
      {localStandings ? (
        <div className="mt-10 flex flex-col gap-10">
          {localStandings.map((group) => (
            <ClassGroupTable key={group.carClass} group={group} />
          ))}
        </div>
      ) : (
        <div className="mt-10 border border-gold-deep/30 bg-gold-deep/5 px-5 py-4">
          <p className="font-mono text-[10px] tracking-[.15em] uppercase text-gold-deep">
            No standings data uploaded yet
          </p>
          <p className="font-sans text-[12px] text-txt-3 mt-1">
            Upload standings for championship {CHAMPIONSHIP_ID} via /admin/standings.
          </p>
        </div>
      )}

      {/* Footer link */}
      {champResult && (
        <div className="mt-8 pt-5 border-t border-line">
          <a
            href={champResult.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] tracking-[.15em] uppercase text-gold hover:text-gold-soft transition-colors"
          >
            View on SimGrid →
          </a>
        </div>
      )}
    </section>
  );
}

async function fetchChampionship(id: number) {
  const baseUrl = process.env.GRIDOS_BASE_URL ?? 'https://www.thesimgrid.com/api/v1';
  const apiKey = process.env.GRIDOS_API_KEY ?? '';
  if (!apiKey) return null;

  const client = new GridOSClient(baseUrl, apiKey);
  try {
    return await client.getChampionship(id);
  } catch (err) {
    if (err instanceof GridOSError) {
      console.error(`Failed to fetch championship ${id}:`, err.status, err.message);
      return null;
    }
    throw err;
  }
}
