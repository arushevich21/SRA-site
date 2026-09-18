'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// A browser source loads its page once and never asks again, so the page has
// to ask for itself. router.refresh() re-renders the server tree in place:
// no reload, no blank frame, the supporters ticker keeps scrolling.
//
// Two triggers. `at` is the one that matters — an hour before this division's
// green flag, so a crew that opened OBS early still gets the new round. `every`
// is the heartbeat that catches OBS left running since last week, a late track
// assignment, or standings after results land. The numbers, and why neither
// runs anywhere near a minute, are in lib/stream/refresh.ts.
// Every source in a scene collection loads within the same second; spreading
// the timed refresh keeps six of them out of one 20s rate-limit window.
const JITTER_MS = 90 * 1000;
// setTimeout wraps past ~24.8 days. Anything that far out is next season's
// problem, and the heartbeat will have re-rendered with a fresh `at` long before.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export function OverlayRefresh({ at, every }: { at: string | null; every: number }) {
  const router = useRouter();

  useEffect(() => {
    const jitter = () => Math.random() * JITTER_MS;
    const heartbeat = setInterval(() => router.refresh(), every * 1000 + jitter());

    let timed: ReturnType<typeof setTimeout> | undefined;
    if (at) {
      const delay = new Date(at).getTime() - Date.now() + jitter();
      if (delay > 0 && delay < MAX_TIMEOUT_MS) timed = setTimeout(() => router.refresh(), delay);
    }

    return () => {
      clearInterval(heartbeat);
      if (timed) clearTimeout(timed);
    };
  }, [router, at, every]);

  return null;
}
