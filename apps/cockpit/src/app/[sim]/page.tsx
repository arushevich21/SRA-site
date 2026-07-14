import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { CHAMPIONSHIPS } from '@/content/championships';
import { getChampionshipStatus, CHAMPIONSHIP_STATUS_LABELS } from '@/lib/championship-status';
import { GameLabel } from '@/components/GameLabel';

const STATUS_DOT_CLASS: Record<string, string> = {
  concluded: 'bg-concluded',
  'coming-soon': 'bg-txt-3/40',
  upcoming: 'bg-txt-3/40',
  'active-open': 'bg-live',
  'active-closed': 'bg-active-closed',
};

const STATUS_TEXT_CLASS: Record<string, string> = {
  concluded: 'text-concluded',
  'coming-soon': 'text-txt-3/50',
  upcoming: 'text-txt-3/50',
  'active-open': 'text-live',
  'active-closed': 'text-active-closed',
};

const ROADMAP_STEPS = [
  {
    step: '01',
    title: 'Join Discord',
    body: 'Our Discord server is where everything happens — announcements, sign-ups, race briefings, and community chat.',
    cta: { label: 'Join Discord', href: 'https://discord.gg/SimRacingAlliance', external: true },
  },
  {
    step: '02',
    title: 'Register',
    body: 'Sign up for the championship you want to race in. Check the requirements, pick your class, and get on the entry list.',
    cta: { label: 'Register', href: '/register', external: false },
  },
  {
    step: '03',
    title: 'Qualify',
    body: 'Meet the qualifying requirements for your series — hot laps, stint times, or pre-qualification events depending on the championship.',
    cta: null,
  },
  {
    step: '04',
    title: 'Race',
    body: 'Show up on race night, attend the drivers briefing, compete clean and climb the standings. Every race counts toward the championship.',
    cta: null,
  },
];

export default async function SimOverviewPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();

  const champs = CHAMPIONSHIPS.filter((c) => c.game === sim.game);
  const activeChamps = champs.filter((c) => c.schedule.length > 0 && !c.teaserOnly);
  const upcomingChamps = champs.filter((c) => c.schedule.length === 0 || c.teaserOnly);
  const allChamps = [...activeChamps, ...upcomingChamps];
  const simAccent = sim.accentColor;

  return (
    <>
      {/* ── HERO VIDEO ─────────────────────────────────────────────── */}
      <section className="relative w-full h-[70vh] min-h-[400px] max-h-[700px] overflow-hidden">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={`/videos/${slug}_hero.mov`}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-carbon via-carbon/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-carbon/60 to-transparent" />

        <div className="relative z-10 h-full flex flex-col justify-end max-w-[1280px] mx-auto px-7 pb-12">
          <span
            className="font-mono text-[12px] tracking-[.3em] uppercase mb-3"
            style={{ color: simAccent }}
          >
            <GameLabel game={sim.game} />
          </span>
          <h1 className="font-display font-black text-[clamp(40px,6vw,72px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-3">
            <GameLabel game={sim.displayName} />
          </h1>
          <p className="font-sans text-[16px] text-txt-2 leading-relaxed whitespace-nowrap">
            {sim.tagline}
          </p>
        </div>
      </section>

      {/* ── EVENTS ─────────────────────────────────────────────────── */}
      {allChamps.length > 0 && (
        <section className="border-t border-line">
          <div className="max-w-[1280px] mx-auto px-7 py-24">
            <span
              className="block font-mono text-[11px] tracking-[.35em] uppercase mb-3"
              style={{ color: simAccent }}
            >
              Events
            </span>
            <h2 className="font-display font-black text-[clamp(28px,4vw,48px)] uppercase leading-[.92] tracking-[-0.5px] text-txt mb-10">
              Select Your Event
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {allChamps.map((champ) => {
                const status = getChampionshipStatus(champ);
                return (
                  <Link
                    key={champ.slug}
                    href={`/${slug}/championships/${champ.slug}`}
                    className="group relative flex flex-col overflow-hidden border border-line bg-panel transition-all hover:border-gold/60 hover:bg-panel-2"
                    style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 14px 100%, 0 calc(100% - 14px))' }}
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[3px] transition-all group-hover:w-[5px]"
                      style={{ backgroundColor: simAccent }}
                    />
                    <div className="px-7 py-6 flex gap-6 items-center flex-1">
                      {champ.logo && (
                        <Image
                          src={champ.logo}
                          alt={champ.title}
                          width={400}
                          height={400}
                          className="w-[70px] h-[70px] sm:w-[120px] sm:h-[120px] shrink-0 object-contain"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-display font-bold text-[20px] uppercase leading-tight text-txt min-w-0 flex-1 truncate">
                            {champ.title}
                          </h3>
                          <span
                            className="font-mono text-[11px] tracking-[.25em] uppercase px-2 py-[1px] border whitespace-nowrap shrink-0"
                            style={{
                              color: simAccent,
                              borderColor: `${simAccent}40`,
                            }}
                          >
                            {champ.classTag}
                          </span>
                          {champ.formatTag && (
                            <span className="font-mono text-[11px] tracking-[.25em] uppercase text-txt-3 px-2 py-[1px] border border-line whitespace-nowrap shrink-0">
                              {champ.formatTag}
                            </span>
                          )}
                          {champ.eventType === 'exhibition' && (
                            <span className="font-mono text-[11px] tracking-[.25em] uppercase text-txt-3 px-2 py-[1px] border border-line whitespace-nowrap shrink-0">
                              Exhibition
                            </span>
                          )}
                          <span className="flex items-center gap-1 ml-auto whitespace-nowrap shrink-0">
                            <span
                              className={['w-[6px] h-[6px] rounded-full', STATUS_DOT_CLASS[status]].join(' ')}
                              style={status === 'active-open' ? { animation: 'live-pulse 1.8s infinite' } : undefined}
                            />
                            <span className={['font-mono text-[11px] tracking-[.2em] uppercase', STATUS_TEXT_CLASS[status]].join(' ')}>
                              {CHAMPIONSHIP_STATUS_LABELS[status]}
                            </span>
                          </span>
                        </div>
                        <p className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3">
                          {status === 'coming-soon'
                            ? 'Coming Soon'
                            : `${champ.schedule.length} Rounds`}
                        </p>
                      </div>
                    </div>
                    <div className="px-7 py-3 border-t border-line/60 flex items-center justify-end">
                      <span className="font-mono text-[11px] tracking-[.2em] uppercase text-gold group-hover:text-gold-soft transition-colors flex items-center gap-2">
                        View Event →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── HOW TO RACE ROADMAP ────────────────────────────────────── */}
      <section className="border-t border-line">
        <div className="max-w-[1280px] mx-auto px-7 py-24">
          <span
            className="block font-mono text-[11px] tracking-[.35em] uppercase mb-3"
            style={{ color: simAccent }}
          >
            Getting Started
          </span>
          <h2 className="font-display font-black text-[clamp(28px,4vw,48px)] uppercase leading-[.92] tracking-[-0.5px] text-txt mb-12">
            How Do I Race?
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ROADMAP_STEPS.map((step, i) => (
              <div
                key={step.step}
                className="relative border border-line bg-panel px-6 py-6"
              >
                <span
                  className="block font-mono text-[28px] font-bold leading-none mb-4"
                  style={{ color: simAccent }}
                >
                  {step.step}
                </span>
                <h3 className="font-display font-bold text-[18px] uppercase leading-none mb-3 text-txt">
                  {step.title}
                </h3>
                <p className="font-sans text-[14px] text-txt leading-relaxed mb-4">
                  {step.step === '04' ? (
                    <>
                      Show up on race night, attend the drivers briefing, compete{' '}
                      <span className="shake" style={{ color: simAccent }}>clean</span>{' '}
                      and climb the standings. Every race counts toward the championship.
                    </>
                  ) : (
                    step.body
                  )}
                </p>
                {step.cta && (
                  step.cta.external ? (
                    <a
                      href={step.cta.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] tracking-[.15em] uppercase transition-colors hover:text-txt"
                      style={{ color: simAccent }}
                    >
                      {step.cta.label} →
                    </a>
                  ) : (
                    <Link
                      href={`/${slug}${step.cta.href}`}
                      className="font-mono text-[11px] tracking-[.15em] uppercase transition-colors hover:text-txt"
                      style={{ color: simAccent }}
                    >
                      {step.cta.label} →
                    </Link>
                  )
                )}

                {i < ROADMAP_STEPS.length - 1 && (
                  <span className="hidden lg:block absolute top-1/2 -right-[14px] text-line-2 text-[18px] -translate-y-1/2 select-none">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
