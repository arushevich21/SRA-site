import pastSeasonsData from '../../content/seasons_clean.json';

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

// TODO: replace CHAMPIONSHIPS with real content + SimGrid data (id, races[], standings)

type UpcomingRound = {
  date: string;
  track: string;
};

type DiscordLink = {
  emoji: string;
  label: string;
  href: string;
};

type Championship = {
  id: string;
  status: 'active' | 'completed';
  category: string;
  title: string;
  season: number;
  rounds: number;
  raceDuration: string;
  schedule: string;
  rules: string[];
  upcomingRounds?: UpcomingRound[];
  discordLinks: DiscordLink[];
  ctaLabel: string;
  ctaHref: string;
};

const CHAMPIONSHIPS: Championship[] = [
  {
    id: 'gt3-team-s18',
    status: 'active',
    category: 'GT3',
    title: 'GT3 Team Series',
    season: 18,
    rounds: 8,
    raceDuration: '60m',
    schedule: 'Tuesday & Wednesday nights at 9:00 PM EDT beginning April 21st',
    rules: [
      'Full grid qualifying required before each race',
      'Mandatory pit window between lap 12 and lap 20',
      'BOP applied per SRA bulletin — check Discord before race day',
      'Teams of 2 drivers; both must complete at least 20% of race distance',
    ],
    upcomingRounds: [
      { date: 'Apr 21', track: 'Monza' },
      { date: 'Apr 28', track: 'Spa-Francorchamps' },
      { date: 'May 5',  track: 'Nürburgring GP' },
      { date: 'May 12', track: 'Silverstone' },
    ],
    discordLinks: [
      { emoji: '📅', label: 'Schedule', href: '#' },
      { emoji: '📜', label: 'Rules', href: '#' },
      { emoji: '🏆', label: 'Standings', href: '#' },
    ],
    ctaLabel: 'View Standings',
    ctaHref: '/standings',
  },
  {
    id: 'multiclass-s7',
    status: 'active',
    category: 'GT2 + TCX',
    title: 'Multiclass Mayhem',
    season: 7,
    rounds: 6,
    raceDuration: '90m',
    schedule: 'Saturday nights at 8:00 PM EDT beginning April 26th',
    rules: [
      'GT2 and TCX classes run concurrently — blue flag rules apply',
      'Single mandatory pit stop; window opens at the 30-minute mark',
      'No BoP — run what you brung within class eligibility list',
      'Overall and per-class standings tracked separately',
    ],
    upcomingRounds: [
      { date: 'Apr 26', track: 'Paul Ricard' },
      { date: 'May 3',  track: 'Zandvoort' },
    ],
    discordLinks: [
      { emoji: '📅', label: 'Schedule', href: '#' },
      { emoji: '📜', label: 'Rules', href: '#' },
    ],
    ctaLabel: 'View Standings',
    ctaHref: '/standings',
  },
  {
    id: 'litw-s12',
    status: 'active',
    category: 'GT3 + GT4 + TCX',
    title: 'League in a Week',
    season: 12,
    rounds: 3,
    raceDuration: '45m',
    schedule: 'Mon / Wed / Fri at 9:00 PM EDT — one week sprint format',
    rules: [
      'Three races across one week, new track each night',
      'Points from all three races; no drops',
      'Open registration until 6 hours before round 1',
      'Incident review panel active for all sessions',
    ],
    discordLinks: [
      { emoji: '📅', label: 'Schedule', href: '#' },
      { emoji: '📜', label: 'Rules', href: '#' },
      { emoji: '💬', label: 'Discussion', href: '#' },
    ],
    ctaLabel: 'View Results',
    ctaHref: '/results',
  },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function SectionLabel({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <p
      className={[
        'font-mono text-[11px] tracking-[.35em] uppercase mb-6',
        muted ? 'text-txt-3' : 'text-gold',
      ].join(' ')}
    >
      {children}
    </p>
  );
}

function CategoryTag({
  label,
  muted = false,
}: {
  label: string;
  muted?: boolean;
}) {
  return (
    <span
      className={[
        'inline-block font-mono text-[10px] tracking-[.35em] uppercase px-2 py-[3px] border',
        muted ? 'text-txt-3 border-txt-3/30' : 'text-gold border-gold/40',
      ].join(' ')}
    >
      {label}
    </span>
  );
}

function LogoPlaceholder() {
  return (
    <div className="w-[148px] h-[148px] shrink-0 bg-line/40 border border-line flex items-center justify-center self-start">
      <span className="font-mono text-[9px] tracking-[.3em] uppercase text-txt-3">
        Logo
      </span>
    </div>
  );
}

function ChampionshipBlock({ c }: { c: Championship }) {
  const isCompleted = c.status === 'completed';

  return (
    <article
      className={[
        'border p-8',
        isCompleted ? 'border-line/50 bg-carbon-2' : 'border-line bg-panel',
      ].join(' ')}
    >
      {/* Category tag */}
      <div className="mb-5">
        <CategoryTag label={c.category} muted={isCompleted} />
      </div>

      {/* Logo + primary info */}
      <div className="flex gap-7 flex-col sm:flex-row">
        <LogoPlaceholder />

        <div className="min-w-0 flex-1">
          {/* Title */}
          <h2
            className={[
              'font-display font-black text-[clamp(28px,4vw,40px)] uppercase leading-none tracking-[-0.5px]',
              isCompleted ? 'text-txt-2' : 'text-txt',
            ].join(' ')}
          >
            {c.title}
            <span className={isCompleted ? 'text-txt-3' : 'text-gold'}>
              {' '}· Season {c.season}
            </span>
          </h2>

          {/* Format subtitle */}
          <p className="font-mono text-[11px] tracking-[.3em] uppercase text-txt-2 mt-3">
            {c.rounds} Rounds · {c.raceDuration} Race
          </p>

          {/* Schedule */}
          <p className="font-sans text-sm text-txt-2 mt-3 leading-relaxed">
            {c.schedule}
          </p>

          {/* Rules list */}
          {c.rules.length > 0 && (
            <ul className="mt-4 space-y-[6px]">
              {c.rules.map((rule) => (
                <li key={rule} className="flex gap-3 font-sans text-sm text-txt-2 leading-snug">
                  <span className={['shrink-0 mt-px select-none', isCompleted ? 'text-txt-3' : 'text-gold'].join(' ')}>
                    —
                  </span>
                  {rule}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Upcoming rounds */}
      {c.upcomingRounds && c.upcomingRounds.length > 0 && (
        <div className="mt-7 border-t border-line pt-5">
          <p className="font-mono text-[10px] tracking-[.35em] uppercase text-txt-3 mb-3">
            Upcoming Rounds
          </p>
          <div className="flex flex-col">
            {c.upcomingRounds.map((r, i) => (
              <div
                key={r.date}
                className={[
                  'flex items-center gap-5 py-[9px]',
                  i < c.upcomingRounds!.length - 1 ? 'border-b border-line/50' : '',
                ].join(' ')}
              >
                <span className="font-mono text-[11px] tracking-[.2em] uppercase text-gold w-16 shrink-0">
                  {r.date}
                </span>
                <span className="font-display font-bold text-[16px] uppercase leading-none text-txt-2">
                  {r.track}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom bar: Discord links + CTA */}
      <div className="mt-7 pt-5 border-t border-line flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5 flex-wrap">
          {c.discordLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="flex items-center gap-[6px] font-mono text-[10px] tracking-[.2em] uppercase text-txt-3 hover:text-gold transition-colors"
            >
              <span>{link.emoji}</span>
              {link.label}
            </a>
          ))}
        </div>
        <a
          href={c.ctaHref}
          className="font-mono text-[11px] tracking-[.15em] uppercase text-gold hover:text-gold-soft transition-colors flex items-center gap-2 shrink-0"
        >
          {c.ctaLabel} →
        </a>
      </div>
    </article>
  );
}

function PastSeasonEntry({ s }: { s: PastSeason }) {
  return (
    <div className="border border-line/30 bg-carbon-2 px-4 py-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-mono text-[11px] tracking-[.2em] text-gold">
          S{s.season}
        </span>
        <span className="font-mono text-[11px] tracking-[.1em] text-gold-soft">
          {s.championPoints} pts
        </span>
      </div>
      <p className="font-display font-bold text-[14px] uppercase leading-tight text-txt truncate">
        {s.championDriver}
      </p>
      {s.championTeam && (
        <p className="font-sans text-[12px] text-txt-3 truncate mt-0.5">
          {s.championTeam}
        </p>
      )}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function ChampionshipsPage() {
  const active = CHAMPIONSHIPS.filter((c) => c.status === 'active');

  return (
    <section className="max-w-[1280px] mx-auto px-7 py-24">

      {/* Page header */}
      <span className="block font-mono text-[11px] tracking-[.3em] uppercase text-gold mb-5">
        — Championships
      </span>
      <h1 className="font-display font-black text-[clamp(52px,7vw,96px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Championships
      </h1>

      {/* Active */}
      {active.length > 0 && (
        <div className="mb-20">
          <SectionLabel>Active Championships</SectionLabel>
          <div className="flex flex-col gap-6">
            {active.map((c) => (
              <ChampionshipBlock key={c.id} c={c} />
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-4 mb-16">
        <div className="flex-1 h-px bg-line" />
        <span className="font-mono text-[9px] tracking-[.4em] uppercase text-txt-3 shrink-0">
          Past Seasons
        </span>
        <div className="flex-1 h-px bg-line" />
      </div>

      {/* Completed — historical archive */}
      <div>
        <SectionLabel muted>Completed Championships</SectionLabel>
        {divisionGroups.map(([division, seasons]) => (
          <div key={division} className="mb-8">
            <p className="font-mono text-[10px] tracking-[.35em] uppercase text-txt-3 mb-3 flex items-center gap-3">
              <span className="h-px w-4 bg-line" />
              Division {division}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {seasons.map((s) => (
                <PastSeasonEntry key={`d${s.division}-s${s.season}`} s={s} />
              ))}
            </div>
          </div>
        ))}
      </div>

    </section>
  );
}
