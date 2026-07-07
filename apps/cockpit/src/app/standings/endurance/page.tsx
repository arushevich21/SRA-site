import Image from 'next/image';
import { readStandings } from '../../../lib/standings-store';
import { EnduranceStandings } from '../../../components/EnduranceStandings';
export const dynamic = 'force-dynamic';

const STANDINGS_KEY = 'endurance-s3';

export default async function EnduranceStandingsPage() {
  const localStandings = await readStandings(STANDINGS_KEY);

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — Standings
      </span>
      <div className="flex items-center gap-5">
        <Image
          src="/badges/endurance-series_logo.png"
          alt="GT3 Endurance Series"
          width={80}
          height={80}
          className="w-[72px] h-[72px] shrink-0 object-contain"
        />
        <div>
          <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt">
            GT3 Endurance Series
          </h1>
          <p className="font-mono text-[12px] tracking-[.3em] uppercase text-txt-2 mt-3">
            ACC · Season 3 · Open / Silver / Bronze
          </p>
        </div>
      </div>

      <div className="mt-10">
        <EnduranceStandings standings={localStandings ?? []} />
      </div>
    </section>
  );
}
