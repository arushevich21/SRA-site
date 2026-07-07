import { NextRequest, NextResponse } from 'next/server';
import { refreshWithLock } from '@/lib/acevo-hotlaps';

// Called by an external scheduler (e.g. cron-job.org) every ~10 minutes.
// Vercel Hobby's 30s function limit is safe: normal runs process 0-1 new
// sessions and complete in ~1-5s. See acevo-hotlaps.ts for the timing table.
//
// Protect with: Authorization: Bearer <CRON_SECRET>
// Add CRON_SECRET to .env.local and Vercel environment variables.
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

  const result = await refreshWithLock();

  if (result === null) {
    return NextResponse.json({ skipped: true, reason: 'refresh already in progress' }, { status: 200 });
  }

  return NextResponse.json({
    processed: result.processed,
    tracks: result.tracks,
    durationMs: result.durationMs,
    ...(result.needsBackfill ? { needsBackfill: true } : {}),
  });
}
