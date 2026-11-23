'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { WrappedDriverCard } from '@/lib/wrapped/card';
import './wrapped.css';

// Season 19 Wrapped — story prototype. Each slide is one idea on a full-bleed
// colour field; setup slides ask, reveal slides answer. Slides advance on a
// timer (the progress bar IS the timer: its animation ending moves on, so
// pausing the animation pauses the story). Tap right/left to skip, hold to
// pause, ← → and space on a keyboard.

export const C = {
  gold: '#E6B53D',
  red: '#E04040',
  cobalt: '#2337C6',
  green: '#0D6B4C',
  white: '#FFFFFF',
  carbon: '#0A0B0E',
  purple: '#6A2FD6', // the purple sector
};

export type SlideDef = { bg: string; fg: string; ms: number | null; render: () => ReactNode };

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
export const d = (ms: number): CSSProperties => ({ '--d': `${ms}ms` }) as CSSProperties;

// Every slide is laid out on one fixed canvas and scaled to the space it
// gets (like a phone screen), so the layout never reflows or overflows.
export const CANVAS_W = 440;
export const CANVAS_H = 782; // 9:16

// Display names sized so their longest word fits the canvas on one line, and
// hyphenated words never break at the hyphen ("Front-Runner" wrapped to 3
// lines). Saira Condensed Black runs ~0.46em per glyph.
export const nb = (w: string) => w.replace(/-/g, '‑');
export function fitName(text: string, max = 104): CSSProperties {
  const longest = Math.max(...text.split(' ').map((w) => w.length));
  return { fontSize: Math.floor(Math.min(max, (CANVAS_W - 52) / (longest * 0.46))) };
}

// A line of display type revealed out of its own line box.
export function Line({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <span className="wx-line">
      <span style={d(delay)}>{children}</span>
    </span>
  );
}

export function CountUp({ to, run }: { to: number; run: boolean }) {
  const [v, setV] = useState(run ? 0 : to);
  useEffect(() => {
    if (!run) return setV(to);
    let raf = 0;
    let t0: number | null = null;
    const tick = (t: number) => {
      t0 ??= t;
      const p = Math.min((t - t0) / 1400, 1);
      setV(to * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, run]);
  return <>{fmt(v)}</>;
}

// The season as one line: finishing position per round, best finish at the
// top of the driver's own range. Every driver's line is a different shape —
// the poster's signature. Gaps where a round wasn't started.
function SeasonTrace({ rounds }: { rounds: WrappedDriverCard['rounds'] }) {
  const W = 320;
  const H = 96;
  const padX = 10;
  const top = 26; // room for the best-finish label
  const bottom = 26; // room for the worst-finish label
  const pts = rounds
    .map((r, i) => ({ i, p: r.position }))
    .filter((q): q is { i: number; p: number } => q.p != null);
  if (pts.length < 2) return null;
  const best = Math.min(...pts.map((q) => q.p));
  const worst = Math.max(...pts.map((q) => q.p));
  const span = Math.max(worst - best, 1);
  const x = (i: number) => padX + (i * (W - 2 * padX)) / Math.max(1, rounds.length - 1);
  const y = (p: number) => top + ((p - best) / span) * (H - top - bottom);
  // Consecutive rounds join solid; a skipped round is bridged with a faint
  // dashed segment, so the season still reads as one line.
  const segs = pts.slice(1).map((q, k) => ({ a: pts[k], b: q, gap: q.i - pts[k].i > 1 }));
  const bestQ = pts.find((q) => q.p === best)!;
  const worstQ = pts.find((q) => q.p === worst)!;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full block overflow-visible"
      role="img"
      aria-label={`Finishes by round: ${rounds.map((r) => (r.position != null ? `P${r.position}` : 'did not start')).join(', ')}`}
    >
      {segs.map((sg, k) => (
        <line
          key={k}
          x1={x(sg.a.i)}
          y1={y(sg.a.p)}
          x2={x(sg.b.i)}
          y2={y(sg.b.p)}
          stroke="#E6B53D"
          strokeWidth={sg.gap ? 2 : 4}
          strokeLinecap="round"
          strokeDasharray={sg.gap ? '2 7' : undefined}
          opacity={sg.gap ? 0.55 : 1}
        />
      ))}
      {pts.map((q) => (
        <circle
          key={q.i}
          cx={x(q.i)}
          cy={y(q.p)}
          r={q === bestQ ? 7 : 4}
          fill={q === bestQ ? '#E6B53D' : '#0A0B0E'}
          stroke="#E6B53D"
          strokeWidth="2.5"
        />
      ))}
      <text x={x(bestQ.i)} y={y(best) - 13} textAnchor="middle" className="wx-trace-label">
        P{best}
      </text>
      {worst !== best && (
        <text
          x={x(worstQ.i)}
          y={y(worst) + 24}
          textAnchor="middle"
          className="wx-trace-label wx-trace-low"
        >
          P{worst}
        </text>
      )}
    </svg>
  );
}

// Easter egg: "Jag" stretched out the way a certain motoring presenter says
// it. Starts huge, gains an "a" at a time and shrinks to keep fitting the
// canvas, so the word looks like it's being dragged out.
function Jaaag({ run }: { run: boolean }) {
  const MAX_A = 14;
  const [a, setA] = useState(run ? 1 : MAX_A);
  useEffect(() => {
    if (!run) return setA(MAX_A);
    let raf = 0;
    let t0: number | null = null;
    const tick = (t: number) => {
      t0 ??= t;
      const p = Math.min(Math.max((t - t0 - 300) / 1900, 0), 1);
      setA(1 + Math.round((MAX_A - 1) * (1 - Math.pow(1 - p, 2))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run]);
  const word = `J${'a'.repeat(a)}g`;
  const size = Math.floor(Math.min(150, (CANVAS_W - 52) / (word.length * 0.46)));
  return (
    <p
      className="font-display font-black leading-[.9] tracking-[-1px] whitespace-nowrap"
      style={{ fontSize: size }}
    >
      {word}
    </p>
  );
}

function buildSlides(card: WrappedDriverCard, motion: boolean): SlideDef[] {
  const n = card.numbers;
  const finishes = card.rounds.filter((r) => r.position != null);
  const best = finishes.length ? Math.min(...finishes.map((r) => r.position!)) : null;
  const bestRound = card.rounds.find((r) => r.position === best);
  const minutes = Math.round(n.hours * 60);
  const nm = card.nemesis;

  const slides: SlideDef[] = [
    {
      bg: C.gold,
      fg: C.carbon,
      ms: 4200,
      render: () => (
        <>
          <div className="wx-kerb wx-sweep" style={{ ...d(0), top: '26%' }} aria-hidden="true" />
          <div className="mt-auto">
            {card.number != null && (
              <div className="wx-in mb-6" style={{ ...d(250), fontSize: 64 }}>
                <span className="wx-panel">{card.number}</span>
              </div>
            )}
            <p className="wx-say">
              <Line delay={350}>{card.name},</Line>
              <Line delay={450}>your Season 19</Line>
              <Line delay={550}>is in.</Line>
            </p>
          </div>
        </>
      ),
    },
    {
      bg: C.red,
      fg: C.white,
      ms: 3200,
      render: () => (
        <p className="wx-say my-auto">
          <Line>You put in some</Line>
          <Line delay={100}>serious miles.</Line>
        </p>
      ),
    },
    {
      bg: C.cobalt,
      fg: C.white,
      ms: 6500,
      render: () => (
        <>
          <div className="wx-road" aria-hidden="true" />
          <div className="relative mt-[18%]">
            <div className="wx-big">
              <Line>
                <CountUp to={n.km} run={motion} />
              </Line>
            </div>
            <div className="wx-say mt-1">
              <Line delay={120}>kilometers</Line>
            </div>
            <p className="wx-body mt-6 wx-in" style={d(500)}>
              {card.distanceCompare} {fmt(n.laps)} race laps in {Math.floor(minutes / 60)} hours{' '}
              {minutes % 60} minutes.
            </p>
          </div>
        </>
      ),
    },
    {
      bg: C.white,
      fg: C.carbon,
      ms: 7500,
      render: () => (
        <>
          <p className="wx-say">
            <Line>Every round,</Line>
            <Line delay={100}>on the board.</Line>
          </p>
          <div className="grid grid-cols-4 gap-3 mt-8">
            {card.rounds.map((r, i) => {
              const tilt = ((i * 7) % 5) - 2;
              return (
                <div
                  key={r.round}
                  className="wx-board wx-drop"
                  data-best={r.position != null && r.position === best}
                  data-dns={r.position == null}
                  style={{ ...d(300 + i * 70), '--r': `${tilt}deg` } as CSSProperties}
                  aria-label={`${r.track}: ${r.position != null ? `P${r.position}` : 'did not start'}`}
                >
                  <b>{r.position != null ? `P${r.position}` : '—'}</b>
                  <small>{r.code}</small>
                </div>
              );
            })}
          </div>
          {bestRound && (
            <p className="wx-body mt-auto wx-in" style={d(1100)}>
              {best === 1 ? 'Best of all: ' : 'Your best: '}
              <strong>
                P{best} at {bestRound.track}
              </strong>
              {finishes.filter((r) => r.position === best).length > 1
                ? `, and you did it ${finishes.filter((r) => r.position === best).length} times.`
                : '.'}
            </p>
          )}
        </>
      ),
    },
  ];

  // Easter egg: the sweatiest driver in SRA (#1 on the Sweatshop board).
  // Sits right after the distance slide — it's the same story, turned up.
  const sweat = card.easterEggs.find((e) => e.kind === 'sweat');
  if (sweat) {
    slides.splice(3, 0, {
      bg: C.red,
      fg: C.white,
      ms: 8000,
      render: () => (
        <>
          <div aria-hidden="true">
            {[6, 17, 29, 40, 52, 63, 74, 85, 95, 34].map((left, k) => (
              <span
                key={k}
                className="wx-sweat"
                style={
                  {
                    left: `${left}%`,
                    '--d': `${(k * 370) % 1700}ms`,
                    '--s': `${0.8 + ((k * 3) % 5) * 0.15}`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <p className="wx-say relative">
            <Line>The sweatiest</Line>
            <Line delay={100}>driver in SRA.</Line>
          </p>
          <div className="relative mt-auto">
            <div className="wx-big">
              <Line delay={250}>
                <CountUp to={sweat.laps} run={motion} />
              </Line>
            </div>
            <div className="wx-say mt-1">
              <Line delay={350}>laps in the Sweatshop</Line>
            </div>
            <p className="wx-body mt-5 wx-in" style={d(900)}>
              {fmt(sweat.margin)} more than anyone else in the league
              {sweat.runnerUp ? ` (${sweat.runnerUp} was next)` : ''}. You practiced on {sweat.days}{' '}
              of the season&apos;s {sweat.seasonDays} days.
            </p>
          </div>
        </>
      ),
    });
  }

  const jag = card.easterEggs.find((e) => e.kind === 'jag');
  if (jag) {
    slides.push({
      bg: '#0B4D35', // British racing green
      fg: C.white,
      ms: 8000,
      render: () => (
        <>
          <div className="my-auto">
            <Jaaag run={motion} />
            <p className="wx-body mt-8 wx-in" style={d(2300)}>
              The Jaguar G3. Arguably the slowest car on the grid, and you raced it {jag.races}{' '}
              times.
            </p>
            <p className="wx-body mt-3 font-bold wx-in" style={d(2500)}>
              Best finish P{jag.best}. {jag.beaten} different drivers finished behind it.
            </p>
          </div>
        </>
      ),
    });
  }

  // Saturday vs Sunday: average qualifying vs average finish.
  const sat = card.saturday;
  if (sat) {
    const gained = sat.gained;
    slides.push({
      bg: C.white,
      fg: C.carbon,
      ms: 7000,
      render: () => (
        <>
          <p className="wx-say">
            <Line>Saturday</Line>
            <Line delay={100}>vs Sunday.</Line>
          </p>
          <div className="mt-auto flex items-end gap-5">
            <div>
              <p className="wx-body opacity-70 wx-in" style={d(250)}>
                Qualified
              </p>
              <div className="wx-big" style={{ fontSize: 104 }}>
                <Line delay={300}>P{sat.avgQuali.toFixed(1)}</Line>
              </div>
            </div>
            <div
              className="pb-4 font-display font-black text-[48px] wx-in"
              style={d(500)}
              aria-hidden="true"
            >
              {'→'}
            </div>
            <div>
              <p className="wx-body opacity-70 wx-in" style={d(550)}>
                Finished
              </p>
              <div className="wx-big" style={{ fontSize: 104 }}>
                <Line delay={600}>P{sat.avgFinish.toFixed(1)}</Line>
              </div>
            </div>
          </div>
          <p className="wx-body mt-6 wx-in" style={d(900)}>
            {gained > 0
              ? `On average, that is. You gained ${gained} ${gained === 1 ? 'place' : 'places'} from qualifying across the season`
              : gained < 0
                ? `On average, that is. You gave back ${-gained} ${gained === -1 ? 'place' : 'places'} from qualifying across the season`
                : 'On average, that is. Over the season you finished exactly where you started'}
            {sat.bestGain
              ? `, and your best charge was +${sat.bestGain.places} at ${sat.bestGain.track}.`
              : '.'}
          </p>
        </>
      ),
    });
  }

  // Purple sectors: fastest sector in the division that race (best lap).
  const sec = card.sectors;
  if (sec) {
    const nth = (n: number) =>
      `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th')}`;
    slides.push({
      bg: C.purple,
      fg: C.white,
      ms: 6500,
      render: () =>
        sec.purple > 0 ? (
          <>
            <p className="wx-say">
              <Line>Some sectors,</Line>
              <Line delay={100}>nobody touched you.</Line>
            </p>
            <div className="mt-auto">
              <div className="wx-big">
                <Line delay={250}>{sec.purple}</Line>
              </div>
              <div className="wx-say mt-1">
                <Line delay={350}>purple {sec.purple === 1 ? 'sector' : 'sectors'}</Line>
              </div>
              <p className="wx-body mt-5 wx-in" style={d(800)}>
                The quickest sector in your division that race, set on your best lap. Sector{' '}
                {sec.best.sector} at {sec.best.track} was one of them.
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="wx-say">
              <Line>Your best</Line>
              <Line delay={100}>sector.</Line>
            </p>
            <div className="mt-auto">
              <div className="wx-big">
                <Line delay={250}>{nth(sec.best.rank)}</Line>
              </div>
              <div className="wx-say mt-1">
                <Line delay={350}>quickest in your division</Line>
              </div>
              <p className="wx-body mt-5 wx-in" style={d(800)}>
                Sector {sec.best.sector} at {sec.best.track}, on your best lap of the race.
              </p>
            </div>
          </>
        ),
    });
  }

  // Teammate head to head.
  const tm = card.teammate;
  if (tm) {
    const won = tm.race.me > tm.race.them;
    const tied = tm.race.me === tm.race.them;
    slides.push({
      bg: C.gold,
      fg: C.carbon,
      ms: 7000,
      render: () => (
        <>
          <p className="wx-say">
            <Line>Then there was</Line>
            <Line delay={100}>the teammate.</Line>
          </p>
          <div className="mt-auto">
            <div className="wx-name" style={fitName(tm.name, 84)}>
              {tm.name.split(' ').map((w, k) => (
                <Line key={k} delay={250 + k * 90}>
                  {nb(w)}
                </Line>
              ))}
            </div>
            <p className="wx-body mt-2 wx-in" style={d(500)}>
              {tm.team}
            </p>
            <div className="grid grid-cols-2 gap-6 mt-7 wx-in" style={d(700)}>
              <div>
                <p className="wx-body opacity-70">Races</p>
                <p className="font-display font-black text-[64px] leading-none">
                  {tm.race.me}
                  {'–'}
                  {tm.race.them}
                </p>
              </div>
              <div>
                <p className="wx-body opacity-70">Qualifying</p>
                <p className="font-display font-black text-[64px] leading-none">
                  {tm.quali.me}
                  {'–'}
                  {tm.quali.them}
                </p>
              </div>
            </div>
            <p className="wx-body mt-5 font-bold wx-in" style={d(950)}>
              {tied
                ? 'Dead even. Nobody gets bragging rights.'
                : won
                  ? 'Team bragging rights: yours.'
                  : 'They had the edge this year.'}
            </p>
          </div>
        </>
      ),
    });
  }

  if (nm) {
    slides.push(
      {
        bg: C.green,
        fg: C.white,
        ms: 3200,
        render: () => (
          <p className="wx-say my-auto">
            <Line>One driver kept</Line>
            <Line delay={100}>turning up in</Line>
            <Line delay={200}>your mirrors.</Line>
          </p>
        ),
      },
      {
        bg: C.red,
        fg: C.white,
        ms: 7000,
        render: () => (
          <>
            <div className="flex justify-center mt-4 wx-in" style={d(0)}>
              <div className="wx-mirror">{nm.number != null ? nm.number : '?'}</div>
            </div>
            <div className="mt-auto">
              <div className="wx-name" style={fitName(nm.name)}>
                {nm.name.split(' ').map((w, i) => (
                  <Line key={i} delay={250 + i * 100}>
                    {nb(w)}
                  </Line>
                ))}
              </div>
              <p className="wx-body mt-5 wx-in" style={d(650)}>
                Side by side at the flag {nm.sideBySide} {nm.sideBySide === 1 ? 'time' : 'times'}.
                Head to head, you finished ahead {nm.ahead} {nm.ahead === 1 ? 'time' : 'times'},
                they did {nm.behind}.
              </p>
            </div>
          </>
        ),
      }
    );
  }

  // Rating arc across the season.
  const rt = card.rating;
  if (rt) {
    const delta = Math.round((rt.end - rt.start) * 10) / 10;
    slides.push({
      bg: C.green,
      fg: C.white,
      ms: 6500,
      render: () => (
        <>
          <p className="wx-say">
            <Line>Your SRA rating</Line>
            <Line delay={100}>
              {delta > 0 ? 'went up.' : delta < 0 ? 'took a hit.' : 'held steady.'}
            </Line>
          </p>
          <div className="mt-auto">
            <div className="flex items-end gap-4">
              <div className="wx-big opacity-50" style={{ fontSize: 76 }}>
                <Line delay={250}>{rt.start.toFixed(1)}</Line>
              </div>
              <div className="wx-big">
                <Line delay={400}>{rt.end.toFixed(1)}</Line>
              </div>
            </div>
            <p className="wx-body mt-5 wx-in" style={d(800)}>
              First round to last{delta !== 0 ? `, ${delta > 0 ? '+' : ''}${delta.toFixed(1)}` : ''}
              . Your peak was {rt.peak.toFixed(1)}, after {rt.peakTrack}.
            </p>
          </div>
        </>
      ),
    });
  }

  // Clean racing, from the stewarding ledger.
  const cl = card.clean;
  if (cl.rounds > 0) {
    const spotless = cl.pp === 0 && cl.warnings === 0;
    slides.push({
      bg: spotless ? C.white : C.cobalt,
      fg: spotless ? C.carbon : C.white,
      ms: 6000,
      render: () => (
        <>
          <p className="wx-say">
            <Line>And the stewards</Line>
            <Line delay={100}>had this to say.</Line>
          </p>
          <div className="mt-auto">
            <div className="wx-big">
              <Line delay={300}>{spotless ? 'Nothing.' : `${cl.cleanRounds}/${cl.rounds}`}</Line>
            </div>
            {!spotless && (
              <div className="wx-say mt-1">
                <Line delay={400}>clean rounds</Line>
              </div>
            )}
            <p className="wx-body mt-5 wx-in" style={d(800)}>
              {spotless
                ? `${cl.rounds} rounds without a penalty point or a warning. Spotless.`
                : `${cl.pp} penalty ${cl.pp === 1 ? 'point' : 'points'} and ${cl.warnings} ${cl.warnings === 1 ? 'warning' : 'warnings'} over the season.`}
            </p>
          </div>
        </>
      ),
    });
  }

  slides.push(
    {
      bg: C.cobalt,
      fg: C.white,
      ms: 3000,
      render: () => (
        <p className="wx-say my-auto">
          <Line>So what kind of</Line>
          <Line delay={100}>driver were you?</Line>
        </p>
      ),
    },
    {
      bg: C.gold,
      fg: C.carbon,
      ms: 7000,
      render: () => (
        <>
          <div className="wx-kerb wx-sweep" style={{ ...d(0), bottom: '6%' }} aria-hidden="true" />
          <div className="mt-[22%]">
            <div className="wx-name" style={fitName(card.archetype.title)}>
              {card.archetype.title.split(' ').map((w, i) => (
                <Line key={i} delay={120 + i * 110}>
                  {nb(w)}
                </Line>
              ))}
            </div>
            <p className="wx-body mt-5 wx-in" style={d(550)}>
              {card.archetype.line}
            </p>
            <p className="wx-body mt-3 font-bold wx-in" style={d(700)}>
              {card.archetypeEvidence.replace(' — ', ': ')}.
            </p>
          </div>
        </>
      ),
    },
    {
      // Share card: a poster, not a profile. Gold hero (who + what kind of
      // driver), then two short lists side by side, then the headline
      // numbers and the sign-off.
      bg: C.gold,
      fg: C.carbon,
      ms: null, // the share card stays up
      render: () => {
        const topRounds = finishes
          .slice()
          .sort((a, b) => a.position! - b.position! || a.round - b.round)
          .slice(0, 3);
        return (
          <div className="wx-poster">
            <div className="wx-poster-hero">
              <div className="flex items-center gap-3 wx-in" style={d(0)}>
                {card.number != null && (
                  <span style={{ fontSize: 'clamp(26px, 9cqw, 40px)' }}>
                    <span className="wx-panel">{card.number}</span>
                  </span>
                )}
                <span className="wx-poster-name">{card.name}</span>
              </div>
              <div className="wx-name mt-auto" style={fitName(card.archetype.title, 96)}>
                {card.archetype.title.split(' ').map((w, k) => (
                  <Line key={k} delay={120 + k * 90}>
                    {nb(w)}
                  </Line>
                ))}
              </div>
            </div>

            <div className="wx-poster-body">
              <div className="grid grid-cols-2 gap-5 wx-in" style={d(320)}>
                <section>
                  <h3 className="wx-poster-label">Best rounds</h3>
                  <ol className="flex flex-col gap-1.5">
                    {topRounds.map((r) => (
                      <li key={r.round} className="wx-poster-item">
                        <b>P{r.position}</b> {r.track}
                      </li>
                    ))}
                  </ol>
                </section>
                <section>
                  <h3 className="wx-poster-label">Nemesis</h3>
                  {nm ? (
                    <>
                      <p className="wx-poster-item">
                        <b>{nm.name}</b>
                      </p>
                      <p className="wx-poster-item mt-1.5">
                        You {nm.ahead}, them {nm.behind}
                      </p>
                    </>
                  ) : (
                    <p className="wx-poster-item">Nobody, really</p>
                  )}
                </section>
              </div>

              <div className="mt-auto wx-in" style={d(420)}>
                <SeasonTrace rounds={card.rounds} />
                <p className="wx-poster-sum mt-3">
                  <b>{fmt(n.km)} km</b> across {n.races} {n.races === 1 ? 'round' : 'rounds'} in
                  Division {card.division}
                </p>
              </div>

              <div className="flex items-center justify-between mt-5 wx-in" style={d(500)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- static brand lockup */}
                <img
                  src="/badges/sra-lockup.webp"
                  alt="Sim Racing Alliance"
                  width={112}
                  height={32}
                />
                <span className="text-[12px] text-white/55">Season 19 Wrapped</span>
              </div>
            </div>
          </div>
        );
      },
    }
  );
  return slides;
}

export type WrappedShare = { url: string; imageUrl: string };

/**
 * The Wrapped story player: timed slides on a fixed 9:16 canvas. On the last
 * slide, share / download / replay controls appear under the card (outside
 * the canvas, so they never end up in the poster image).
 */
export function StoryPlayer({
  build,
  label,
  share,
  onStart,
  extra,
}: {
  /** The slides; `motion` is false under prefers-reduced-motion. */
  build: (motion: boolean) => SlideDef[];
  /** Accessible name, and the title when sharing. */
  label: string;
  share?: WrappedShare;
  /** Called once when the story is first shown (e.g. to mark it seen). */
  onStart?: () => void;
  /** More actions for the end of the story (e.g. a link to the league's). */
  extra?: ReactNode;
}) {
  const [reduced, setReduced] = useState(false);
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(0); // remount key: replay
  const [copied, setCopied] = useState(false);
  const press = useRef<{ t: number; x: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / CANVAS_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    onStart?.();
    // Once per mount, by design.
  }, []);

  const slides = build(!reduced);
  const slide = slides[i];
  const last = slides.length - 1;

  const go = useCallback(
    (delta: number) => setI((s) => Math.min(last, Math.max(0, s + delta))),
    [last]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('select, input, textarea, button, a'))
        return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // Tap = skip (left third back, rest forward). Hold = pause while held.
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    press.current = { t: performance.now(), x: e.clientX };
    setHeld(true);
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    press.current = null;
    setHeld(false);
    if (!p || performance.now() - p.t > 250) return; // it was a hold
    const box = e.currentTarget.getBoundingClientRect();
    go(p.x - box.left < box.width / 3 ? -1 : 1);
  };

  const replay = () => {
    setI(0);
    setPaused(false);
    setRun((r) => r + 1);
  };

  const shareLink = async () => {
    if (!share) return;
    const title = label;
    // Share paths are site-relative; the clipboard and share sheet need a full URL.
    const url = new URL(share.url, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      return; // cancelled the share sheet
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const frozen = held || paused;
  const atEnd = i === last;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div
        ref={stageRef}
        className={`wx-stage ${frozen ? 'wx-held' : ''}`}
        style={{ background: slide.bg, color: slide.fg }}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerLeave={() => {
          press.current = null;
          setHeld(false);
        }}
        onContextMenu={(e) => e.preventDefault()}
        aria-roledescription="story"
        aria-label={label}
      >
        <div
          className="wx-canvas"
          style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})` }}
        >
          <div className="wx-progress" aria-hidden="true">
            {slides.map((s, k) => (
              <span key={`${run}-${k}`} data-state={k < i ? 'done' : k === i ? 'now' : 'next'}>
                <i
                  style={{ '--dur': `${s.ms ?? 1}ms` } as CSSProperties}
                  onAnimationEnd={() => k === i && s.ms != null && go(1)}
                />
              </span>
            ))}
          </div>
          <button
            type="button"
            className="wx-pause"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Play story' : 'Pause story'}
          >
            {paused ? (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M3 1.5v11l9-5.5z" fill="currentColor" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <rect x="2.5" y="1.5" width="3" height="11" fill="currentColor" />
                <rect x="8.5" y="1.5" width="3" height="11" fill="currentColor" />
              </svg>
            )}
          </button>
          <div key={`${run}-${i}`} className="wx-slide" aria-live="polite">
            {slide.render()}
          </div>
        </div>
      </div>

      <div
        className={`flex flex-wrap justify-center gap-3 min-h-[44px] transition-opacity ${atEnd ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-hidden={!atEnd}
      >
        {share && (
          <>
            <button
              type="button"
              onClick={shareLink}
              className="wx-action wx-action-primary"
              tabIndex={atEnd ? 0 : -1}
            >
              {copied ? 'Link copied' : 'Share link'}
            </button>
            <a
              href={`${share.imageUrl}?download=1`}
              className="wx-action"
              tabIndex={atEnd ? 0 : -1}
            >
              Download image
            </a>
          </>
        )}
        <button type="button" onClick={replay} className="wx-action" tabIndex={atEnd ? 0 : -1}>
          Watch again
        </button>
        {extra}
      </div>
    </div>
  );
}

/** A driver's own Season 19 story. */
export function WrappedStory({
  card,
  share,
  onStart,
  extra,
}: {
  card: WrappedDriverCard;
  share?: WrappedShare;
  onStart?: () => void;
  extra?: ReactNode;
}) {
  return (
    <StoryPlayer
      build={(motion) => buildSlides(card, motion)}
      label={`${card.name}'s Season 19 Wrapped`}
      share={share}
      onStart={onStart}
      extra={extra}
    />
  );
}
