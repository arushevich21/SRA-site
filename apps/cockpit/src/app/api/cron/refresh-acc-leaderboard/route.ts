import { NextRequest, NextResponse } from 'next/server';
import { refreshWithLock } from '@/lib/acc/hotlaps';

// Called by an external scheduler (e.g. cron-job.org), same pattern as
// /api/cron/refresh-leaderboard for AC Evo — see that route for the timing
// rationale. Currently only pulls from ACCSM4 (EMPEROR_ACC_BASE_URLS).
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

  let result;
  try {
    result = await refreshWithLock();
  } catch (err) {
    console.error('ACC leaderboard refresh failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  if (result === null) {
    return NextResponse.json({ skipped: true, reason: 'refresh already in progress' }, { status: 200 });
  }

  return NextResponse.json({
    processed: result.processed,
    tracks: result.tracks,
    durationMs: result.durationMs,
  });
}
