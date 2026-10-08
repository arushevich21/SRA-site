'use client';

import { useLinkStatus } from 'next/link';

// Rendered inside a <Link>: a pulsing underline while the navigation that
// link started is in flight. The standings controls are server-rendered links
// (see StandingsControls.tsx), so without this a click shows nothing until the
// new view arrives — which read as "the click didn't register" and invited a
// second click. The parent Link must be `relative`.
export function LinkPendingBar() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={[
        'pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-gold transition-opacity',
        pending ? 'opacity-100 animate-pulse' : 'opacity-0',
      ].join(' ')}
    />
  );
}
