import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { syncSralienStatus } from '@/lib/acc/sralien-sync';

// Called by an external scheduler (e.g. cron-job.org), same pattern as the
// other /api/cron/* routes — see refresh-leaderboard/route.ts. driver_ratings
// is populated by an external pipeline on its own weekly cadence (Thursday
// night). Two jobs ride along with that cadence: busting the page's cache so
// the next visit re-reads Supabase instead of serving a stale build, and
// syncing drivers.is_sralien to the freshly-computed top 10 (see
// sralien-sync.ts — that flag drives the SRAlien badge everywhere BUT this
// leaderboard itself, which always computes its own top 10 live).
//
// Schedule: weekly, Thursday 23:55 (matches the pipeline's own run time).
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

  const sralien = await syncSralienStatus();
  revalidatePath('/acc/srating');

  return NextResponse.json({ revalidated: '/acc/srating', sralien });
}
