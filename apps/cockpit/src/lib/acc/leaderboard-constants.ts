import { ACC_CAR_CLASS_NAMES } from '@sra/domain';

// Split out from tracks.ts deliberately: this file must stay import-clean of
// anything server-only (no supabase client, nothing DB-touching), because
// AccTrackLeaderboard ('use client') needs these same constants for its class
// dropdown — importing them from tracks.ts directly would pull that whole
// module (and its server-only lib/supabase.ts import) into the client bundle
// and fail the build ("You're importing a component that needs server-only").

// Every class value in circulation — used for the leaderboard's class
// dropdown, since it's populated up front rather than derived from
// whichever page/class happens to be currently loaded.
export const ACC_CLASSES: string[] = [...new Set(Object.values(ACC_CAR_CLASS_NAMES))].sort();

// Reverse lookup (class -> car ids), for pushing a class-filtered leaderboard
// query down to Postgres via car_model_id — car_group isn't a stored column,
// so filtering by class means filtering by the set of car ids that
// resolveCarGroup() would map to it. Built once from the same table every
// per-row class derivation already uses, so a class filter can never drift
// from what actually renders.
const CAR_MODEL_IDS_BY_CLASS: Record<string, number[]> = {};
for (const [idStr, cls] of Object.entries(ACC_CAR_CLASS_NAMES)) {
  (CAR_MODEL_IDS_BY_CLASS[cls] ??= []).push(Number(idStr));
}

export function carModelIdsForClass(carGroup: string): number[] {
  return CAR_MODEL_IDS_BY_CLASS[carGroup] ?? [];
}

// 300 rows/page — Supabase/PostgREST caps any single response at 1000
// regardless of what's asked for, and a busy track's full history (Spa: 2853
// rows) is too large to render as one page anyway (an uncapped/unpaginated
// version of this leaderboard once blew Vercel's 19.07MB ISR page-size
// limit — see git history). Query-level pagination fetches only the
// requested slice, rather than fetching everything and slicing in memory.
export const LEADERBOARD_PAGE_SIZE = 300;
