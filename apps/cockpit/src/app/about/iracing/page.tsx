export default function IRacingPage() {
  const schedule = [
    { round: 1, track: 'Oulton Park Circuit (International)', date: 'Sep 12' },
    { round: 2, track: 'Snetterton Circuit (200)', date: 'Sep 19' },
    { round: 3, track: 'Motorsport Arena Oschersleben (Grand Prix)', date: 'Sep 26' },
    { round: 4, track: 'Autodromo Internazionale del Mugello (Grand Prix)', date: 'Oct 3' },
    { round: 5, track: 'Suzuka International Racing Course (Grand Prix)', date: 'Oct 10' },
    { round: 6, track: 'Circuito de Navarra (Speed Circuit)', date: 'Oct 17' },
  ];

  return (
    <section className="max-w-[1280px] mx-auto px-7 pt-14 pb-24">
      <span className="block font-mono text-[15px] tracking-[.3em] uppercase text-gold mb-5">
        — About
      </span>
      <h1 className="font-display font-black text-[clamp(44px,6vw,80px)] uppercase leading-[.9] tracking-[-1px] text-txt mb-10">
        iRacing
      </h1>

      <p className="font-sans text-sm text-txt-2 leading-relaxed mb-4">
        Thursday night race events with drivers&apos; briefings at 9:00 PM EDT.
        SRA&apos;s iRacing series welcomes competitors of all ages and skill
        levels.
      </p>

      {/* Race Format */}
      <div className="bg-panel border border-line p-6 mb-10 max-w-2xl">
        <h2 className="font-display font-bold text-[20px] uppercase text-txt mb-4">
          Race Format
        </h2>
        <ul className="space-y-3">
          <li className="font-sans text-sm text-txt-2 leading-relaxed">
            <span className="font-mono text-[15px] tracking-[.15em] uppercase text-gold">
              Vehicle
            </span>{' '}
            — Radical SR8
          </li>
          <li className="font-sans text-sm text-txt-2 leading-relaxed">
            <span className="font-mono text-[15px] tracking-[.15em] uppercase text-gold">
              Practice
            </span>{' '}
            — 20 minutes (includes briefing)
          </li>
          <li className="font-sans text-sm text-txt-2 leading-relaxed">
            <span className="font-mono text-[15px] tracking-[.15em] uppercase text-gold">
              Qualifying
            </span>{' '}
            — 10 minutes (2 laps)
          </li>
          <li className="font-sans text-sm text-txt-2 leading-relaxed">
            <span className="font-mono text-[15px] tracking-[.15em] uppercase text-gold">
              Races
            </span>{' '}
            — Two 30-minute sprint races
          </li>
        </ul>
      </div>

      {/* Season 3 Schedule */}
      <h2 className="font-display font-bold text-[28px] uppercase text-txt mt-16 mb-6">
        Season 3 Schedule
      </h2>
      <p className="font-mono text-[15px] tracking-[.2em] uppercase text-txt-3 mb-5">
        6 Rounds &middot; Radical SR8 &middot; Thursdays 9:00 PM EDT
      </p>

      <div className="border border-line bg-panel">
        {schedule.map((round, i) => (
          <div
            key={round.round}
            className={[
              'flex items-center gap-5 px-6 py-[11px]',
              i < schedule.length - 1 ? 'border-b border-line/50' : '',
            ].join(' ')}
          >
            <span className="font-mono text-[15px] tracking-[.2em] uppercase text-gold w-10 shrink-0">
              R{round.round}
            </span>
            <span className="font-display font-bold text-[16px] uppercase leading-none text-txt-2 flex-1 min-w-0 truncate">
              {round.track}
            </span>
            <span className="font-mono text-[15px] tracking-[.15em] text-txt-3 shrink-0 text-right">
              {round.date}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
