import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { CHAMPIONSHIPS } from '@/content/championships';

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
    body: 'Show up on race night, compete clean, and climb the standings. Every race counts toward the championship.',
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
  const activeChamps = champs.filter((c) => c.schedule.length > 0);
  const upcomingChamps = champs.filter((c) => c.schedule.length === 0);
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
            {sim.game}
          </span>
          <h1 className="font-display font-black text-[clamp(40px,6vw,72px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-3">
            {sim.displayName}
          </h1>
          <p className="font-sans text-[16px] text-txt-2 leading-relaxed max-w-[520px]">
            {allChamps.length > 0
              ? `${allChamps.length} championship${allChamps.length !== 1 ? 's' : ''} — find your grid and start racing.`
              : 'Championships coming soon — stay tuned.'}
          </p>
        </div>
      </section>

      {/* ── CHAMPIONSHIPS ──────────────────────────────────────────── */}
      {allChamps.length > 0 && (
        <section className="border-t border-line">
          <div className="max-w-[1280px] mx-auto px-7 py-24">
            <span
              className="block font-mono text-[11px] tracking-[.35em] uppercase mb-3"
              style={{ color: simAccent }}
            >
              Championships
            </span>
            <h2 className="font-display font-black text-[clamp(28px,4vw,48px)] uppercase leading-[.92] tracking-[-0.5px] text-txt mb-10">
              Pick Your Series
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {allChamps.map((champ) => {
                const isActive = champ.schedule.length > 0;
                return (
                  <Link
                    key={champ.standingsKey ?? champ.simgridId ?? champ.title}
                    href={`/${slug}/championships`}
                    className="group relative border border-line bg-panel hover:bg-panel-2 transition-all overflow-hidden"
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[3px]"
                      style={{ backgroundColor: simAccent }}
                    />
                    <div className="px-7 py-6 flex gap-6 items-center">
                      {champ.logo && (
                        <Image
                          src={champ.logo}
                          alt={champ.title}
                          width={400}
                          height={400}
                          className="w-[80px] h-[80px] sm:w-[150px] sm:h-[150px] shrink-0 object-contain"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="font-mono text-[11px] tracking-[.25em] uppercase px-2 py-[1px] border"
                            style={{
                              color: simAccent,
                              borderColor: `${simAccent}40`,
                            }}
                          >
                            {champ.classTag}
                          </span>
                          {champ.formatTag && (
                            <span className="font-mono text-[11px] tracking-[.25em] uppercase text-txt-3 px-2 py-[1px] border border-line">
                              {champ.formatTag}
                            </span>
                          )}
                          {isActive && (
                            <span className="flex items-center gap-1 ml-auto">
                              <span className="w-[6px] h-[6px] rounded-full bg-live" style={{ animation: 'live-pulse 1.8s infinite' }} />
                              <span className="font-mono text-[11px] tracking-[.2em] uppercase text-live">Active</span>
                            </span>
                          )}
                        </div>
                        <h3 className="font-display font-bold text-[20px] uppercase leading-tight text-txt mb-2">
                          {champ.title}
                        </h3>
                        <p className="font-mono text-[11px] tracking-[.15em] uppercase text-txt-3">
                          {isActive
                            ? `${champ.schedule.length} Rounds`
                            : 'Coming Soon'}
                        </p>
                      </div>
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
                  {step.body}
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
