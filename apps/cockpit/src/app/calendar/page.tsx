import Image from 'next/image';
import { CHAMPIONSHIPS, formatScheduleDate } from '../../content/championships';

export default function CalendarPage() {
  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — Calendar
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-16">
        Race Calendar
      </h1>

      {CHAMPIONSHIPS.filter((c) => c.schedule.length > 0).map((champ) => (
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
              <span className="font-mono text-[11px] tracking-[.25em] uppercase px-2 py-[2px] border text-txt-3 border-line">
                {champ.game}
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
      ))}
    </section>
  );
}
