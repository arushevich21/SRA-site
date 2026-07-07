import pastSeasonsData from '../../../content/seasons_clean.json';

type SeasonEntry = {
  championshipType: string;
  division: number;
  season: number;
  roundCount: number;
  tracks: string[];
  championDriver: string;
  championCar: string;
  championTeam: string | null;
  championPoints: string | null;
};

const allSeasons = (pastSeasonsData as SeasonEntry[]).sort((a, b) => {
  if (b.season !== a.season) return b.season - a.season;
  return a.division - b.division;
});

function groupBySeason(entries: SeasonEntry[]): { season: number; entries: SeasonEntry[] }[] {
  const map = new Map<number, SeasonEntry[]>();
  for (const e of entries) {
    const arr = map.get(e.season) ?? [];
    arr.push(e);
    map.set(e.season, arr);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b - a)
    .map(([season, entries]) => ({ season, entries }));
}

const grouped = groupBySeason(allSeasons);

export default function AccoladesPage() {
  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Accolades
      </h1>

      {grouped.map((group) => (
        <div key={group.season} className="mb-14">
          <h2 className="font-display font-bold text-[28px] uppercase text-txt mb-6">
            Season {group.season}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.entries.map((s) => (
              <div
                key={`${s.season}-${s.division}-${s.championshipType}`}
                className="border border-gold/30 bg-carbon-2 p-5"
              >
                <p className="font-mono text-[13px] tracking-[.35em] uppercase text-gold mb-2">
                  Division {s.division} Champion
                </p>
                <p className="font-display font-black text-[22px] uppercase leading-tight text-txt">
                  {s.championDriver}
                </p>
                {s.championTeam && (
                  <p className="font-sans text-[14px] text-txt-2 mt-1">{s.championTeam}</p>
                )}
                <p className="font-mono text-[13px] text-txt-3 mt-2">
                  {s.championPoints ? `${s.championPoints} pts` : ''}{s.championPoints && s.championCar ? ' · ' : ''}{s.championCar}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}