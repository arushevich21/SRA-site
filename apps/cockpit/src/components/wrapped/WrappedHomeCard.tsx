'use client';

import Link from 'next/link';
import { useWrappedPrompt } from './useWrappedPrompt';

// Link colour set inline: globals.css has an unlayered `a { color: inherit }`,
// which beats Tailwind's text-* utilities on <a>/<Link>.
const LINK_ON_DARK = { color: '#fff' } as const;

// Homepage card for the Wrapped launch window: your own story when you have
// one, otherwise a way in (sign in, or the league's season). Renders nothing
// outside the window or until the state has loaded.
export function WrappedHomeCard() {
  const state = useWrappedPrompt();
  if (!state || state.state === 'off') return null;

  const ready = state.state === 'ready';
  const cta =
    state.state === 'ready'
      ? { href: '/wrapped/s19', label: 'Watch yours' }
      : state.state === 'signed-out'
        ? { href: '/auth/login', label: 'Sign in to watch yours' }
        : { href: '/wrapped/s19/league', label: 'Watch the season' };

  return (
    <section className="px-5 sm:px-7 py-10">
      <div className="max-w-[1280px] mx-auto rounded-[18px] bg-gold text-carbon px-7 py-8 sm:px-10 flex flex-col sm:flex-row sm:items-center gap-6 justify-between">
        <div>
          <h2 className="font-display font-black text-[clamp(34px,5vw,52px)] leading-[.92] tracking-[-.5px]">
            {ready ? 'Your Season 19, wrapped.' : 'Season 19, wrapped.'}
          </h2>
          <p className="font-sans text-[16px] mt-2 max-w-[52ch]">
            {ready
              ? 'Your distance, your best rounds, your nemesis, and what kind of driver you were.'
              : 'The GT3 Team Series season as a story: the numbers, the standouts, and our champions.'}
          </p>
        </div>
        {cta.href === '/auth/login' ? (
          <a
            href={cta.href}
            className="self-start sm:self-auto shrink-0 font-sans font-semibold text-[15px] bg-carbon text-white rounded-full px-6 py-3 hover:bg-black"
            style={LINK_ON_DARK}
          >
            {cta.label}
          </a>
        ) : (
          <Link
            href={cta.href}
            className="self-start sm:self-auto shrink-0 font-sans font-semibold text-[15px] bg-carbon text-white rounded-full px-6 py-3 hover:bg-black"
            style={LINK_ON_DARK}
          >
            {cta.label}
          </Link>
        )}
      </div>
    </section>
  );
}
