import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getSimBySlug } from '@/content/sims';
import { CHAMPIONSHIPS, formatScheduleDate } from '@/content/championships';

export default async function SimCalendarPage({
  params,
}: {
  params: Promise<{ sim: string }>;
}) {
  const { sim: slug } = await params;
  const sim = getSimBySlug(slug);
  if (!sim) notFound();

  const champs = CHAMPIONSHIPS.filter(
    (c) => c.game === sim.game && c.schedule.length > 0,
  );

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span
        className="block font-mono text-[15px] tracking-[.3em] uppercase mb-5"
        style={{ color: 'var(--sim-accent)' }}
      >
        — {sim.game} Calendar
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Race Calendar
      </h1>

      {champs.length > 0 ? (
        champs.map((champ) => (
          <div key={champ.standingsKey ?? champ.simgridId ?? champ.title} className="mb-14">
            <div className="flex items-center gap-4 mb-6">
              {champ.logo && (
                <Image
                  src={champ.logo}
                  alt={champ.title}
                  width={96}
                  height={96}
                  className="w-[80px] h-[80px] shrink-0 object-contain"
                />
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-block font-mono text-[11px] tracking-[.35em] uppercase px-2 py-[3px] border text-gold border-gold/40">
                  {champ.classTag}
                </span>
                <h2 className="font-display font-bold text-[20px] uppercase leading-none text-txt">
                  {champ.title}
                </h2>
              </div>
            </div>

            <p className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 mb-5">
              {champ.raceFormat}
            </p>

            <div className="border border-line bg-panel">
              {champ.schedule.map((round, i) => (
                <div
                  key={round.round}
                  className={[
                    'flex items-center gap-5 px-6 py-[11px]',
                    i < champ.schedule.length - 1
                      ? 'border-b border-line/50'
                      : '',
                  ].join(' ')}
                >
                  <span className="font-mono text-[12px] tracking-[.2em] uppercase text-gold w-10 shrink-0">
                    R{round.round}
                  </span>
                  <span className="font-display font-bold text-[16px] uppercase leading-none text-txt-2 flex-1 min-w-0 truncate">
                    {round.track}
                  </span>
                  <span className="font-mono text-[11px] tracking-[.15em] text-txt-3 shrink-0 text-right">
                    {formatScheduleDate(round.date)}
                  </span>
                  <span className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3 shrink-0 w-16 text-right">
                    {round.raceLength}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
          <p className="font-mono text-[12px] tracking-[.2em] uppercase text-txt-3">
            No scheduled events yet — coming soon
          </p>
        </div>
      )}
    </section>
  );
}
