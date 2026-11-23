'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { LeagueWrapped } from '@/lib/wrapped/card';
import {
  C,
  CountUp,
  Line,
  StoryPlayer,
  d,
  fitName,
  fmt,
  nb,
  type SlideDef,
  type WrappedShare,
} from './WrappedStory';
import './wrapped.css';

// The league's Season 19 as a story: the GT3 Team Series as a whole, its
// standouts, then one slide per division for the champions, ending on a
// champions poster. Same player and visual language as a driver's own.

const EARTH_KM = 40_075;

// One colour per division, the same order every time.
const DIV_THEME: Record<number, { bg: string; fg: string }> = {
  1: { bg: C.gold, fg: C.carbon },
  2: { bg: C.white, fg: C.carbon },
  3: { bg: C.red, fg: C.white },
  4: { bg: C.purple, fg: C.white },
};

function Panel({ n, size }: { n: number; size: number }) {
  return (
    <span style={{ fontSize: size }}>
      <span className="wx-panel">{n}</span>
    </span>
  );
}

const and = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

function buildLeagueSlides(L: LeagueWrapped, motion: boolean): SlideDef[] {
  const slides: SlideDef[] = [
    {
      bg: C.gold,
      fg: C.carbon,
      ms: 4500,
      render: () => (
        <>
          <div className="wx-kerb wx-sweep" style={{ ...d(0), top: '24%' }} aria-hidden="true" />
          <div className="mt-auto">
            <p className="wx-say">
              <Line delay={300}>Season 19 of the</Line>
              <Line delay={400}>GT3 Team Series,</Line>
              <Line delay={500}>wrapped.</Line>
            </p>
            <p className="wx-body mt-5 wx-in" style={d(900)}>
              {L.rounds} rounds. {L.divisions} divisions. Here&apos;s how it went.
            </p>
          </div>
        </>
      ),
    },
    {
      bg: C.cobalt,
      fg: C.white,
      ms: 5500,
      render: () => (
        <div className="mt-[30%]">
          <div className="wx-big">
            <Line>
              <CountUp to={L.drivers} run={motion} />
            </Line>
          </div>
          <div className="wx-say mt-1">
            <Line delay={120}>drivers took the start.</Line>
          </div>
          <p className="wx-body mt-6 wx-in" style={d(500)}>
            {fmt(L.starts)} starts in all, across {L.divisions} divisions and {L.rounds} rounds.
          </p>
        </div>
      ),
    },
    {
      bg: C.red,
      fg: C.white,
      ms: 6500,
      render: () => (
        <>
          <div className="wx-road" aria-hidden="true" />
          <div className="relative mt-[18%]">
            <div className="wx-big" style={fitName(fmt(L.km), 132)}>
              <Line>
                <CountUp to={L.km} run={motion} />
              </Line>
            </div>
            <div className="wx-say mt-1">
              <Line delay={120}>kilometers of racing</Line>
            </div>
            <p className="wx-body mt-6 wx-in" style={d(500)}>
              That&apos;s {(L.km / EARTH_KM).toFixed(1)} times around the Earth. {fmt(L.laps)} laps,{' '}
              {fmt(L.hours)} hours on track.
            </p>
          </div>
        </>
      ),
    },
  ];

  if (L.mostWins) {
    const w = L.mostWins;
    slides.push({
      bg: C.white,
      fg: C.carbon,
      ms: 6000,
      render: () => (
        <>
          <p className="wx-say">
            <Line>Most race wins</Line>
            <Line delay={100}>of the season.</Line>
          </p>
          <div className="mt-auto">
            <div
              className="wx-name"
              style={fitName(w.names.join(' '), w.names.length > 1 ? 64 : 96)}
            >
              {w.names.map((n, k) => (
                <Line key={k} delay={250 + k * 90}>
                  {nb(n)}
                </Line>
              ))}
            </div>
            <p className="wx-body mt-4 font-bold wx-in" style={d(700)}>
              {w.wins} wins{w.names.length > 1 ? ' each' : ''}.
            </p>
          </div>
        </>
      ),
    });
  }

  if (L.purpleKing) {
    const p = L.purpleKing;
    slides.push({
      bg: C.purple,
      fg: C.white,
      ms: 6000,
      render: () => (
        <>
          <p className="wx-say">
            <Line>Purple-sector</Line>
            <Line delay={100}>royalty.</Line>
          </p>
          <div className="mt-auto">
            <div className="wx-name" style={fitName(p.name, 96)}>
              {p.name.split(' ').map((w, k) => (
                <Line key={k} delay={250 + k * 90}>
                  {nb(w)}
                </Line>
              ))}
            </div>
            <p className="wx-body mt-4 wx-in" style={d(700)}>
              {p.purple} purple sectors, the fastest in their division that race. Nobody had more.
            </p>
          </div>
        </>
      ),
    });
  }

  if (L.sweatiest) {
    const s = L.sweatiest;
    slides.push({
      bg: C.red,
      fg: C.white,
      ms: 6000,
      render: () => (
        <>
          <div aria-hidden="true">
            {[8, 22, 37, 51, 66, 80, 93].map((left, k) => (
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
            <div className="wx-name" style={fitName(s.name, 96)}>
              {s.name.split(' ').map((w, k) => (
                <Line key={k} delay={250 + k * 90}>
                  {nb(w)}
                </Line>
              ))}
            </div>
            <p className="wx-body mt-4 wx-in" style={d(700)}>
              {fmt(s.laps)} laps in the Sweatshop. Respect.
            </p>
          </div>
        </>
      ),
    });
  }

  if (L.spotless > 0) {
    slides.push({
      bg: C.green,
      fg: C.white,
      ms: 5500,
      render: () => (
        <div className="mt-[30%]">
          <div className="wx-big">
            <Line>{L.spotless}</Line>
          </div>
          <div className="wx-say mt-1">
            <Line delay={120}>drivers kept it spotless.</Line>
          </div>
          <p className="wx-body mt-6 wx-in" style={d(500)}>
            Six rounds or more without a single penalty point or warning. Clean racing is the point.
          </p>
        </div>
      ),
    });
  }

  slides.push({
    bg: C.carbon,
    fg: C.white,
    ms: 3200,
    render: () => (
      <p className="wx-say my-auto" style={{ fontSize: 52 }}>
        <Line>And now,</Line>
        <Line delay={120}>your champions.</Line>
      </p>
    ),
  });

  for (const ch of L.champions) {
    const theme = DIV_THEME[ch.division] ?? DIV_THEME[1];
    slides.push({
      bg: theme.bg,
      fg: theme.fg,
      ms: 8000,
      render: () => (
        <>
          <p className="wx-say">
            <Line>Division {ch.division}</Line>
            <Line delay={100}>champion.</Line>
          </p>
          <div className="mt-auto">
            {ch.driver.number != null && (
              <div className="wx-in mb-4" style={d(200)}>
                <Panel n={ch.driver.number} size={52} />
              </div>
            )}
            <div className="wx-name" style={fitName(ch.driver.name, 96)}>
              {ch.driver.name.split(' ').map((w, k) => (
                <Line key={k} delay={300 + k * 90}>
                  {nb(w)}
                </Line>
              ))}
            </div>
            <p className="wx-body mt-3 font-bold wx-in" style={d(700)}>
              {ch.driver.points} points, {ch.driver.margin} clear.{' '}
              {ch.driver.wins === 0
                ? 'Not a single race win, and still the champion. Consistency pays.'
                : `${ch.driver.wins} ${ch.driver.wins === 1 ? 'win' : 'wins'}.`}
            </p>
            <div className="mt-5 flex flex-col gap-2 wx-in" style={d(950)}>
              {ch.team && (
                <p className="wx-body">
                  <strong>Teams&apos; title:</strong> {ch.team.name}, {and(ch.team.drivers)}
                </p>
              )}
              {ch.silver && (
                <p className="wx-body">
                  <strong>Silver title:</strong> {ch.silver.name}
                </p>
              )}
            </div>
          </div>
        </>
      ),
    });
  }

  if (L.closest) {
    const c = L.closest;
    slides.push({
      bg: C.cobalt,
      fg: C.white,
      ms: 6000,
      render: () => (
        <>
          <p className="wx-say">
            <Line>The tightest</Line>
            <Line delay={100}>title fight.</Line>
          </p>
          <div className="mt-auto">
            <div className="wx-big">
              <Line delay={250}>{c.margin}</Line>
            </div>
            <div className="wx-say mt-1">
              <Line delay={350}>points in it</Line>
            </div>
            <p className="wx-body mt-5 wx-in" style={d(800)}>
              Division {c.division} went to the wire, and {c.champion} held on.
            </p>
          </div>
        </>
      ),
    });
  }

  slides.push({
    bg: C.gold,
    fg: C.carbon,
    ms: null,
    render: () => <ChampionsPoster L={L} />,
  });

  return slides;
}

function ChampionsPoster({ L }: { L: LeagueWrapped }) {
  return (
    <div className="wx-poster">
      <div className="wx-poster-hero" style={{ flexBasis: '34%' }}>
        <p className="wx-poster-name wx-in" style={d(0)}>
          GT3 Team Series
        </p>
        <div className="wx-name mt-auto" style={fitName('Champions', 92)}>
          <Line delay={100}>Season 19</Line>
          <Line delay={190}>champions</Line>
        </div>
      </div>
      <div className="wx-poster-body" style={{ paddingTop: 16 }}>
        <div className="flex flex-col wx-in" style={d(320)}>
          {L.champions.map((ch) => (
            <section key={ch.division} className="py-[9px] border-b border-white/10 last:border-0">
              <h3 className="wx-poster-label !mb-1">Division {ch.division}</h3>
              <p className="wx-poster-item">
                <b>{ch.driver.name}</b>
                {ch.driver.number != null ? ` #${ch.driver.number}` : ''}
              </p>
              <p className="text-[13px] leading-snug text-white/70 mt-0.5">
                {[
                  ch.team ? `Teams: ${ch.team.name}` : null,
                  ch.silver ? `Silver: ${ch.silver.name}` : null,
                ]
                  .filter(Boolean)
                  .join('. ')}
              </p>
            </section>
          ))}
        </div>
        <div className="flex items-center justify-between mt-auto pt-3 wx-in" style={d(500)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand lockup */}
          <img src="/badges/sra-lockup.webp" alt="Sim Racing Alliance" width={112} height={32} />
          <span className="text-[12px] text-white/55">Season 19 Wrapped</span>
        </div>
      </div>
    </div>
  );
}

export function LeagueStory({
  league,
  share,
  extra,
}: {
  league: LeagueWrapped;
  share?: WrappedShare;
  extra?: ReactNode;
}) {
  return (
    <StoryPlayer
      build={(motion) => buildLeagueSlides(league, motion)}
      label="Season 19 of the GT3 Team Series, wrapped"
      share={share}
      extra={extra}
    />
  );
}
