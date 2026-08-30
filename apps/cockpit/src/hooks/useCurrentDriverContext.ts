'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export type CurrentDriverContext = {
  driverId: string | null; // drivers.id (uuid) — null if signed out
  steamId: string | null;
  division: number | null; // 1-4, from drivers.division_id — null if unassigned
};

const SIGNED_OUT: CurrentDriverContext = { driverId: null, steamId: null, division: null };

// Client-side counterpart to lib/current-driver.ts's getCurrentDriverContext —
// fetched in the browser (not via a server-side cookie read) so leaderboard
// pages that only need this for "my laps" highlighting/filters can stay
// static/ISR instead of being forced dynamic by an auth cookie read. Same
// pattern as NavBar's signed-in chip. Re-fetches on login/logout via
// onAuthStateChange.
//
// Uses getSession() (trusts the local session, no round-trip to Supabase's
// Auth server) rather than getUser() (always revalidates server-side) —
// deliberately, since this only drives cosmetic personalization (row
// highlight, filter buttons), not an authorization decision. The one real
// data access here (the drivers row) stays safe regardless, via RLS
// (drivers_select_own: auth.uid() = user_id) — a stale/wrong id from here
// can never read another driver's row, just fail to match one.
//
// IMPORTANT: deliberately NOT calling supabase.auth.getSession() directly
// on mount — onAuthStateChange fires an INITIAL_SESSION event immediately on
// subscribe (with the current session already resolved), so that alone
// covers the initial load without a second, separate session call. A direct
// getSession()/getUser() call racing onAuthStateChange's own initial dispatch
// (which holds GoTrueClient's internal lock while it runs) can deadlock the
// client permanently — no error, no network request ever issued — since
// createBrowserClient() hands out a shared singleton (see NavBar.tsx, which
// hit and confirmed this exact deadlock). This hook used to call load()
// directly in addition to subscribing, which fired that race on every mount;
// it's the reason "signed in" state got stuck on pages using this hook
// (leaderboards) but never on pages that don't (Home).
export function useCurrentDriverContext(): CurrentDriverContext {
  const [context, setContext] = useState<CurrentDriverContext>(SIGNED_OUT);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    async function loadDriver(userId: string) {
      const { data } = await supabase
        .from('drivers')
        .select('id, steam_id, division_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (active) {
        setContext({
          driverId: data?.id ?? null,
          steamId: data?.steam_id ?? null,
          division: data?.division_id ?? null,
        });
      }
    }

    function handleSession(session: { user: { id: string } } | null) {
      if (!session?.user) {
        if (active) setContext(SIGNED_OUT);
        return;
      }
      loadDriver(session.user.id);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return context;
}
