'use client';

import { useEffect, useState } from 'react';
import type { WrappedPromptState } from '@/lib/wrapped/card';

const KEY = 'wrapped-prompt';

// The visitor's Wrapped state, fetched once per tab and kept in
// sessionStorage so navigating around doesn't refetch it.
export function useWrappedPrompt(enabled = true): WrappedPromptState | null {
  const [state, setState] = useState<WrappedPromptState | null>(null);
  useEffect(() => {
    if (!enabled) return;
    try {
      const cached = sessionStorage.getItem(KEY);
      if (cached) return setState(JSON.parse(cached) as WrappedPromptState);
    } catch {
      /* storage unavailable — fetch instead */
    }
    let live = true;
    fetch('/api/wrapped/prompt', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<WrappedPromptState>) : null))
      .then((s) => {
        if (!live || !s) return;
        setState(s);
        try {
          sessionStorage.setItem(KEY, JSON.stringify(s));
        } catch {
          /* fine — we just refetch next page */
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [enabled]);
  return state;
}

export function forgetWrappedPrompt() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing cached */
  }
}
