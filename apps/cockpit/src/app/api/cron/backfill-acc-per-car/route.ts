import { NextRequest, NextResponse } from 'next/server';
import { backfillRecentSessions } from '@/lib/acc/hotlaps';

// One-time-use recovery route, same auth pattern as
// /api/cron/refresh-acc-leaderboard. Replays one results-list page (~20
// results per ACCSM server; ?page=N, default 0 = most recent) through the
// leaderboard merge so laps discarded by the pre-per-car-key leaderboard
// (see supabase/migrations/20260725_acc_hotlap_per_car.sql) get their own
// row. Safe to trigger more than once, including for the same page — every
// write is the same idempotent upsert the live cron uses, and this never
// touches acc_processed_sessions. To cover more history, call again with
// ?page=1, ?page=2, etc. — each page is a distinct ~20 results, so there's
// no need to re-request a page already covered.
//
// Protect with: Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('CRON_SECRET env var is not set');
    return NextResponse.json({ error: 'server misconfiguration' }, { status: 500 });
  }

  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const pageParam = req.nextUrl.searchParams.get('page');
  const page = pageParam ? Number(pageParam) : 0;
  if (!Number.isInteger(page) || page < 0) {
    return NextResponse.json({ error: 'page must be a non-negative integer' }, { status: 400 });
  }

  let result;
  try {
    result = await backfillRecentSessions(page);
  } catch (err) {
    console.error('ACC per-car backfill failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    results: result.results,
    durationMs: result.durationMs,
  });
}
