import { NextResponse } from 'next/server';
import { EMPEROR_ACC_BASE_URLS } from '@/lib/emperor';
import { supabase } from '@/lib/supabase';

// Public, cached (~60s) snapshot of the ACCSM fleet for the ACC overview page's
// server-status panel. The healthcheck only exposes online/event-in-progress/
// driver-count — NOT the current track — so "what's being run" is inferred from
// the newest completed session in each server's results list ("last raced").
//
// revalidate + per-fetch next.revalidate mean each upstream URL is hit at most
// once per window regardless of traffic, so this never hammers the servers or
// trips Emperor's rate limit on page load.
export const revalidate = 60;

const FETCH_TIMEOUT_MS = 8000;

export type AccServerStatus = {
  label: string; // e.g. "SRAM1"
  online: boolean;
  eventInProgress: boolean;
  drivers: number;
  lastTrackKey: string | null;
  lastTrackName: string | null;
  lastRacedAt: string | null; // ISO
};

function labelFor(baseUrl: string): string {
  const m = baseUrl.match(/accsm(\d+)/i);
  return m ? `SRAM${m[1]}` : baseUrl.replace(/^https?:\/\//, '');
}

async function timedJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchServer(baseUrl: string): Promise<AccServerStatus> {
  const label = labelFor(baseUrl);
  const hc = (await timedJson(`${baseUrl}/healthcheck.json`)) as
    | { OK?: boolean; EventInProgress?: boolean; NumConnectedDrivers?: number }
    | null;

  if (!hc) {
    return { label, online: false, eventInProgress: false, drivers: 0, lastTrackKey: null, lastTrackName: null, lastRacedAt: null };
  }

  const list = (await timedJson(`${baseUrl}/api/results/list.json?page=0`)) as
    | { results?: { track?: string; date?: string }[] }
    | null;
  const newest = list?.results?.[0];

  return {
    label,
    online: hc.OK ?? true,
    eventInProgress: hc.EventInProgress ?? false,
    drivers: hc.NumConnectedDrivers ?? 0,
    lastTrackKey: newest?.track ?? null,
    lastTrackName: null, // filled in below from track_layouts
    lastRacedAt: newest?.date ?? null,
  };
}

function prettifyKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET(): Promise<NextResponse> {
  const servers = await Promise.all(EMPEROR_ACC_BASE_URLS.map(fetchServer));

  // Resolve last-raced track keys to their curated display names.
  const { data: layouts } = await supabase
    .from('track_layouts')
    .select('layout_key, display_name')
    .eq('game', 'ACC');
  const nameByKey = new Map((layouts ?? []).map((r) => [r.layout_key as string, r.display_name as string]));

  const withNames = servers.map((s) => ({
    ...s,
    lastTrackName: s.lastTrackKey ? (nameByKey.get(s.lastTrackKey) ?? prettifyKey(s.lastTrackKey)) : null,
  }));

  return NextResponse.json({ servers: withNames });
}
