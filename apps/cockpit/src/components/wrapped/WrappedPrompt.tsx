'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { markWrappedSeen } from '@/app/wrapped/actions';
import { forgetWrappedPrompt, useWrappedPrompt } from './useWrappedPrompt';

// Link colour set inline: globals.css has an unlayered `a { color: inherit }`,
// which beats Tailwind's text-* utilities on <a>/<Link>.
const LINK_ON_DARK = { color: '#fff' } as const;

// One-time launch prompt: a gold sheet at the foot of whatever page a driver
// with a Wrapped card lands on, until they watch it or tap Later (either is
// recorded per driver, so it doesn't follow them to another device).
// Never on stream overlays, generated images, or the Wrapped pages themselves.
const HIDDEN = ['/wrapped', '/overlay', '/thumbnail', '/graphics'];

export function WrappedPrompt() {
  const pathname = usePathname();
  const hidden = HIDDEN.some((p) => pathname.startsWith(p));
  // No fetch at all on hidden paths — OBS reloads overlays constantly.
  const state = useWrappedPrompt(!hidden);
  const [gone, setGone] = useState(false);

  if (gone || !state || state.state !== 'ready' || state.seen) return null;
  if (hidden) return null;

  const later = () => {
    setGone(true);
    forgetWrappedPrompt();
    void markWrappedSeen();
  };

  return (
    <div
      role="region"
      aria-label="Your Season 19 Wrapped"
      className="wx-prompt fixed z-[90] left-1/2 -translate-x-1/2 bottom-4 w-[calc(100%-32px)] max-w-[440px] rounded-[18px] bg-gold text-carbon px-6 py-5 shadow-[0_18px_50px_rgba(0,0,0,.45)]"
      onKeyDown={(e) => e.key === 'Escape' && setGone(true)}
    >
      <div className="flex items-center gap-3">
        {state.number != null && (
          <span className="grid place-items-center min-w-[52px] h-[42px] px-2 bg-white rounded-[6px] font-display font-black text-[28px] leading-none ring-2 ring-carbon">
            {state.number}
          </span>
        )}
        <p className="font-display font-black text-[26px] leading-[1.02]">
          Your Season 19 Team Series Wrapped is ready.
        </p>
      </div>
      <div className="flex items-center gap-4 mt-4">
        <Link
          href="/wrapped/s19"
          onClick={() => setGone(true)}
          className="font-sans font-semibold text-[15px] bg-carbon text-white rounded-full px-6 py-3 hover:bg-black"
          style={LINK_ON_DARK}
        >
          Watch it
        </Link>
        <button
          type="button"
          onClick={later}
          className="font-sans font-semibold text-[15px] px-2 py-3 hover:underline"
        >
          Later
        </button>
      </div>
    </div>
  );
}
