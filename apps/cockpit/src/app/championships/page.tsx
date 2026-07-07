import pastSeasonsData from '../../content/seasons_clean.json';
import { CHAMPIONSHIPS } from '../../content/championships';
import { DivisionGroup } from './division-group';
import { RealChampionshipBlock } from './RealChampionshipBlock';
import { SectionLabel } from './shared';

// ── past seasons data ────────────────────────────────────────────────────────

type PastSeason = {
  championshipType: string;
  division: number;
  season: number;
  roundCount: number;
  tracks: string[];
  championDriver: string;
  championCar: string;
  championTeam: string | null;
  championPoints: string;
};

const pastSeasons = pastSeasonsData as PastSeason[];

const divisionGroups = Object.entries(
  pastSeasons.reduce<Record<number, PastSeason[]>>((acc, s) => {
    (acc[s.division] ??= []).push(s);
    return acc;
  }, {}),
)
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(
    ([div, seasons]) =>
      [Number(div), seasons.sort((a, b) => b.season - a.season)] as const,
  );

// ── page ──────────────────────────────────────────────────────────────────────

export default function ChampionshipsPage() {
  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      {/* Page header */}
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — Championships
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Championships
      </h1>

      {/* Active championships */}
      {CHAMPIONSHIPS.filter((c) => c.schedule.length > 0).length > 0 && (
        <div className="mb-20">
          <SectionLabel>Active Championships</SectionLabel>
          <div className="flex flex-col gap-6">
            {CHAMPIONSHIPS.filter((c) => c.schedule.length > 0).map((content) => (
              <RealChampionshipBlock key={content.standingsKey ?? content.simgridId ?? content.title} content={content} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming championships */}
      {CHAMPIONSHIPS.filter((c) => c.schedule.length === 0).length > 0 && (
        <div className="mb-20">
          <SectionLabel muted>Upcoming Championships</SectionLabel>
          <div className="flex flex-col gap-6">
            {CHAMPIONSHIPS.filter((c) => c.schedule.length === 0).map((content) => (
              <RealChampionshipBlock key={content.standingsKey ?? content.simgridId ?? content.title} content={content} />
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-4 mb-16">
        <div className="flex-1 h-px bg-line" />
        <span className="font-mono text-[11px] tracking-[.4em] uppercase text-txt-3 shrink-0">
          Past Seasons
        </span>
        <div className="flex-1 h-px bg-line" />
      </div>

      {/* Completed — historical archive */}
      <div>
        <SectionLabel muted>Completed Championships</SectionLabel>
        {divisionGroups.map(([division, seasons]) => (
          <DivisionGroup key={division} division={division} seasons={seasons} />
        ))}
      </div>
    </section>
  );
}
