import Image from 'next/image';
import pastSeasonsData from '../../../content/seasons_clean.json';

/* ------------------------------------------------------------------ */
/*  CDN accolades data (Seasons 0-9)                                  */
/* ------------------------------------------------------------------ */

const CDN_BASE = 'https://static.simracingalliance.com/assets/images/accolades/';

type CdnSeason = {
  season: number;
  divisions: { label: string; goldUrl: string; silverUrl: string | null; teamUrl: string }[];
  specials: { url: string; alt: string }[];
};

function buildCdnSeasons(): CdnSeason[] {
  const divisionMap: Record<number, string[]> = {
    9: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'],
    8: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'],
    7: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'],
    6: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'],
    5: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'],
    4: ['D1', 'D2', 'D3', 'D4'],
    3: ['D1', 'D2', 'D3'],
    2: ['PRO', 'AM'],
    1: ['PRO', 'AM'],
  };

  const specialImages: Record<number, { url: string; alt: string }[]> = {
    8: [{ url: `${CDN_BASE}S8_SRAliens.webp`, alt: 'Season 8 SRAliens' }],
    5: [{ url: `${CDN_BASE}S5_Endurance_Indianapolis.webp`, alt: 'Season 5 Endurance Indianapolis' }],
    4: [{ url: `${CDN_BASE}S4_Endurance_Suzuka.webp`, alt: 'Season 4 Endurance Suzuka' }],
  };

  const seasons: CdnSeason[] = [];

  // Seasons 9 down to 1
  for (let s = 9; s >= 1; s--) {
    const divs = divisionMap[s] ?? [];
    const isLegacy = s <= 2; // PRO/AM naming

    const divisions = divs.map((d) => {
      if (isLegacy) {
        return {
          label: d,
          goldUrl: `${CDN_BASE}S${s}_Champion_${d}.webp`,
          silverUrl: null,
          teamUrl: `${CDN_BASE}S${s}_Team_Champion_${d}.webp`,
        };
      }
      return {
        label: d,
        goldUrl: `${CDN_BASE}S${s}_Champion_${d}_Gold.webp`,
        silverUrl: `${CDN_BASE}S${s}_Champion_${d}_Silver.webp`,
        teamUrl: `${CDN_BASE}S${s}_Team_Champion_${d}.webp`,
      };
    });

    seasons.push({
      season: s,
      divisions,
      specials: specialImages[s] ?? [],
    });
  }

  // Season 0
  seasons.push({
    season: 0,
    divisions: [],
    specials: [
      {
        url: `${CDN_BASE}S0_World_Champion_1920x1920.webp`,
        alt: 'Season 0 World Champion',
      },
    ],
  });

  return seasons;
}

const cdnSeasons = buildCdnSeasons();

/* ------------------------------------------------------------------ */
/*  Past seasons data (Seasons 10-17)                                 */
/* ------------------------------------------------------------------ */

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

const dataSeasons = (pastSeasonsData as SeasonEntry[])
  .filter((s) => s.season >= 10 && s.season <= 17)
  .sort((a, b) => {
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

const groupedDataSeasons = groupBySeason(dataSeasons);

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function AccoladesPage() {
  return (
    <section className="max-w-[1280px] mx-auto px-7 py-24">
      {/* Header */}
      <span className="block font-mono text-[11px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(40px,6vw,72px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        Accolades
      </h1>

      {/* ============================================================ */}
      {/*  Section B — Seasons 10-17 (CSS cards from data)             */}
      {/* ============================================================ */}
      <div className="flex items-center gap-4 my-16">
        <div className="flex-1 h-px bg-line" />
        <span className="font-mono text-[9px] tracking-[.4em] uppercase text-txt-3">
          Seasons 10–17
        </span>
        <div className="flex-1 h-px bg-line" />
      </div>

      {groupedDataSeasons.map((group) => (
        <div key={group.season}>
          <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
            Season {group.season}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.entries.map((s) => (
              <div
                key={`${s.season}-${s.division}-${s.championshipType}`}
                className="border border-gold/30 bg-carbon-2 p-5"
              >
                <p className="font-mono text-[9px] tracking-[.35em] uppercase text-gold mb-2">
                  Season {s.season} — Division {s.division} Champion
                </p>
                <p className="font-display font-black text-[22px] uppercase leading-tight text-txt">
                  {s.championDriver}
                </p>
                {s.championTeam && (
                  <p className="font-sans text-[13px] text-txt-2 mt-1">{s.championTeam}</p>
                )}
                <p className="font-mono text-[11px] text-txt-3 mt-2">
                  {s.championPoints ? `${s.championPoints} pts` : ''}{s.championPoints && s.championCar ? ' · ' : ''}{s.championCar}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ============================================================ */}
      {/*  Section A — Seasons 9-0 (CDN images)                        */}
      {/* ============================================================ */}
      <div className="flex items-center gap-4 my-16">
        <div className="flex-1 h-px bg-line" />
        <span className="font-mono text-[9px] tracking-[.4em] uppercase text-txt-3">
          Seasons 0–9
        </span>
        <div className="flex-1 h-px bg-line" />
      </div>

      {cdnSeasons.map((s) => (
        <div key={s.season}>
          <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
            Season {s.season}
          </h2>

          {/* Drivers Champions */}
          {s.divisions.length > 0 && (
            <>
              <h3 className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-2 mb-4">
                Drivers Champions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {s.divisions.map((d) => (
                  <div key={`gold-${d.label}`}>
                    <Image
                      src={d.goldUrl}
                      alt={`Season ${s.season} ${d.label} Gold Champion`}
                      width={320}
                      height={320}
                      className="w-full max-w-[320px] rounded"
                      unoptimized
                    />
                  </div>
                ))}
                {s.divisions
                  .filter((d) => d.silverUrl)
                  .map((d) => (
                    <div key={`silver-${d.label}`}>
                      <Image
                        src={d.silverUrl!}
                        alt={`Season ${s.season} ${d.label} Silver Champion`}
                        width={320}
                        height={320}
                        className="w-full max-w-[320px] rounded"
                        unoptimized
                      />
                    </div>
                  ))}
              </div>
            </>
          )}

          {/* Team Champions */}
          {s.divisions.length > 0 && (
            <>
              <h3 className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-2 mb-4">
                Team Champions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {s.divisions.map((d) => (
                  <div key={`team-${d.label}`}>
                    <Image
                      src={d.teamUrl}
                      alt={`Season ${s.season} ${d.label} Team Champion`}
                      width={320}
                      height={320}
                      className="w-full max-w-[320px] rounded"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Special images */}
          {s.specials.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {s.specials.map((sp) => (
                <div key={sp.url}>
                  <Image
                    src={sp.url}
                    alt={sp.alt}
                    width={320}
                    height={320}
                    className="w-full max-w-[320px] rounded"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
