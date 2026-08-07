import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

// Called by an external scheduler (e.g. cron-job.org), same pattern as the
// other /api/cron/* routes — see refresh-leaderboard/route.ts. driver_ratings
// is populated by an external pipeline on its own weekly cadence (Thursday
// night), so unlike the other cron routes there's nothing to fetch/process
// here — this just busts the page's cache so the next visit re-reads
// Supabase instead of serving a stale build.
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

  revalidatePath('/acc/srating');

  return NextResponse.json({ revalidated: '/acc/srating' });
}
