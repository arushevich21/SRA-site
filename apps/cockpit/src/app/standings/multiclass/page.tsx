import Image from 'next/image';
import { readStandings } from '../../../lib/standings-store';
import { ClassStandingsTabs } from '../../../components/ClassStandingsTabs';
export const dynamic = 'force-dynamic';

const STANDINGS_KEY = '22872';

export default async function MulticlassStandingsPage() {
  const localStandings = await readStandings(STANDINGS_KEY);

  return (
    <section className="max-w-[1280px] mx-auto px-7 py-24">
      <span className="block font-mono text-[11px] tracking-[.3em] uppercase text-gold mb-5">
        — Standings
      </span>
      <div className="flex items-center gap-5">
        <Image
          src="/badges/multiclass_mayhem_logo.png"
          alt="Multiclass Mayhem"
          width={80}
          height={80}
          className="w-[72px] h-[72px] shrink-0 object-contain"
        />
        <div>
          <h1 className="font-display font-black text-[clamp(40px,6vw,72px)] uppercase leading-[.9] tracking-[-1px] text-txt">
            Multiclass Mayhem
          </h1>
          <p className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-2 mt-3">
            LMU · Season 3 · Split 1
          </p>
        </div>
      </div>

      {/* Standings with class tabs */}
      {localStandings ? (
        <div className="mt-10">
          <ClassStandingsTabs groups={localStandings} />
        </div>
      ) : (
        <div className="mt-10 border border-gold-deep/30 bg-gold-deep/5 px-5 py-4">
          <p className="font-mono text-[10px] tracking-[.15em] uppercase text-gold-deep">
            No standings data uploaded yet
          </p>
          <p className="font-sans text-[12px] text-txt-3 mt-1">
            Upload standings with key &quot;{STANDINGS_KEY}&quot; via /admin/standings.
          </p>
        </div>
      )}

      {/* Footer link */}
      <div className="mt-8 pt-5 border-t border-line">
        <a
          href="https://www.thesimgrid.com/championships/22872/results"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] tracking-[.15em] uppercase text-gold hover:text-gold-soft transition-colors"
        >
          View on SimGrid →
        </a>
      </div>
    </section>
  );
}
