import Image from 'next/image';
import { readStandings } from '../../lib/standings-store';
import { GT3TeamStandings } from '../../components/GT3TeamStandings';
export const dynamic = 'force-dynamic';

const DIVISIONS = [1, 2, 3, 4] as const;

export default async function StandingsPage() {
  const divisionEntries = await Promise.all(
    DIVISIONS.map(async (d) => {
      const [drivers, teams] = await Promise.all([
        readStandings(`gt3-s19-d${d}-drivers`),
        readStandings(`gt3-s19-d${d}-teams`),
      ]);
      return [d, { drivers, teams }] as const;
    }),
  );

  const data = Object.fromEntries(divisionEntries);

  return (
    <section className="max-w-[1280px] mx-auto px-7 py-24">
      <span className="block font-mono text-[11px] tracking-[.3em] uppercase text-gold mb-5">
        — Standings
      </span>
      <div className="flex items-center gap-5 mb-10">
        <Image
          src="/badges/gt3_team_series_logo.png"
          alt="GT3 Team Series"
          width={80}
          height={80}
          className="w-[72px] h-[72px] shrink-0 object-contain"
        />
        <div>
          <h1 className="font-display font-black text-[clamp(40px,6vw,72px)] uppercase leading-[.9] tracking-[-1px] text-txt">
            GT3 Team Series
          </h1>
          <p className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-2 mt-3">
            ACC · Season 19
          </p>
        </div>
      </div>

      <GT3TeamStandings data={data} />
    </section>
  );
}
