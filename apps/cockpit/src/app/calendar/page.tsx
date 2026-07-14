import { Fragment } from 'react';
import Image from 'next/image';
import { CHAMPIONSHIPS, formatScheduleDateTime } from '../../content/championships';
import { SIMS } from '@/content/sims';
import { CalendarGrid, type CalendarGridEvent } from '@/components/CalendarGrid';
import { GameLabel } from '@/components/GameLabel';
import { LocalScheduleDate, LocalScheduleTime } from '@/components/LocalScheduleDateTime';

export default function CalendarPage() {
  const teasedChamps = CHAMPIONSHIPS.filter((c) => c.teaserOnly);
  const realChamps = CHAMPIONSHIPS.filter((c) => c.schedule.length > 0 && !c.teaserOnly);

  const gridEvents: CalendarGridEvent[] = realChamps.flatMap((champ) => {
    const sim = SIMS.find((s) => s.game === champ.game);
    return champ.schedule
      .filter((round) => round.date)
      .map((round) => ({
        iso: round.date!,
        title: `${champ.game} · R${round.round} · ${round.track}`,
        href: sim ? `/${sim.slug}/championships/${champ.slug}` : '/calendar',
        color: sim?.accentColor,
      }));
  });

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — Calendar
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Race Calendar
      </h1>

      {gridEvents.length > 0 && <CalendarGrid events={gridEvents} />}

      {teasedChamps.length === 0 && realChamps.length === 0 && (
        <div className="border border-line/50 bg-carbon-2 px-8 py-12 text-center">
          <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
            No scheduled events yet — coming soon
          </p>
        </div>
      )}

      {teasedChamps.length > 0 && (
        <div className="mb-16">
          {teasedChamps.map((champ, i) => (
            <Fragment key={champ.standingsKey ?? champ.simgridId ?? champ.title}>
              {i > 0 && <div className="h-px bg-line my-10" />}
              <div className="flex items-center gap-4">
                {champ.logo && (
                  <Image
                    src={champ.logo}
                    alt={champ.title}
                    width={96}
                    height={96}
                    className="w-[80px] h-[80px] shrink-0 object-contain opacity-70"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="font-display font-bold text-[20px] uppercase leading-none text-txt/70 min-w-0 truncate">
                      {champ.title}
                    </h2>
                    <span className="inline-block font-mono text-[11px] tracking-[.35em] uppercase px-2 py-[3px] border text-txt-3/60 border-txt-3/20 whitespace-nowrap shrink-0">
                      {champ.classTag}
                    </span>
                  </div>
                  <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3">
                    Coming Soon
                  </p>
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      )}

      {realChamps.map((champ) => (
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
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <h2 className="font-display font-bold text-[20px] uppercase leading-none text-txt min-w-0 truncate">
                {champ.title}
              </h2>
              <span className="inline-block font-mono text-[11px] tracking-[.35em] uppercase px-2 py-[3px] border text-gold border-gold/40 whitespace-nowrap shrink-0">
                {champ.classTag}
              </span>
              <span className="font-mono text-[11px] tracking-[.25em] uppercase px-2 py-[2px] border text-txt-3 border-line whitespace-nowrap shrink-0">
                <GameLabel game={champ.game} />
              </span>
            </div>
          </div>

          <div className="mb-5 space-y-1">
            {champ.raceDays && (
              <p className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-2">
                {champ.raceDays}
              </p>
            )}
            <p className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3">
              {champ.raceFormat}
            </p>
          </div>

          <div className="border border-line bg-panel">
            {champ.schedule.map((round, i) => {
              const { time: timeStr } = formatScheduleDateTime(round.date);
              return (
                <div
                  key={round.round}
                  className={[
                    'flex items-center gap-5 px-6 py-[11px]',
                    i < champ.schedule.length - 1
                      ? 'border-b border-line/50'
                      : '',
                  ].join(' ')}
                >
                  <span className="font-mono text-[15px] tracking-[.2em] uppercase text-gold w-10 shrink-0">
                    R{round.round}
                  </span>
                  <span className="font-display font-bold text-[20px] uppercase leading-none text-txt-2 flex-1 min-w-0 truncate">
                    {round.track}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-display font-bold text-[20px] uppercase leading-none text-txt">
                      <LocalScheduleDate iso={round.date} />
                    </span>
                    {timeStr && (
                      <>
                        <span className="text-txt-3">·</span>
                        <span className="font-mono text-[15px] tracking-[.1em] text-txt-2">
                          <LocalScheduleTime iso={round.date} />
                        </span>
                      </>
                    )}
                  </span>
                  <span className="font-mono text-[15px] tracking-[.1em] uppercase text-txt-3/70 shrink-0 w-24 text-right">
                    {round.raceLength}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
