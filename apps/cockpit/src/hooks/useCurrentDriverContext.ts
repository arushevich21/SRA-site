'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export type CurrentDriverContext = {
  steamId: string | null;
  division: number | null; // 1-4, from drivers.division_id — null if unassigned
};

const SIGNED_OUT: CurrentDriverContext = { steamId: null, division: null };

// Client-side counterpart to lib/current-driver.ts's getCurrentDriverContext —
// fetched in the browser (not via a server-side cookie read) so leaderboard
// pages that only need this for "my laps" highlighting/filters can stay
// static/ISR instead of being forced dynamic by an auth cookie read. Same
// pattern as NavBar's signed-in chip. Re-fetches on login/logout via
// onAuthStateChange.
export function useCurrentDriverContext(): CurrentDriverContext {
  const [context, setContext] = useState<CurrentDriverContext>(SIGNED_OUT);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (active) setContext(SIGNED_OUT);
        return;
      }
      const { data } = await supabase
        .from('drivers')
        .select('steam_id, division_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (active) {
        setContext({
          steamId: data?.steam_id ?? null,
          division: data?.division_id ?? null,
        });
      }
    }

    load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => load());

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return context;
}
