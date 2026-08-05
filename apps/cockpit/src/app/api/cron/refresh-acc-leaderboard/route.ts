import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { refreshWithLock } from '@/lib/acc/hotlaps';

// Called by an external scheduler (e.g. cron-job.org), same pattern as
// /api/cron/refresh-leaderboard for AC Evo — see that route for the timing
// rationale. Pulls from every server in EMPEROR_ACC_BASE_URLS (defaults to
// accsm1-7; idle/unreachable servers are skipped, not fatal).
//
// Protect with: Authorization: Bearer <CRON_SECRET>

// Give the function headroom above Vercel's short default limit: a run walks
// every server in EMPEROR_ACC_BASE_URLS sequentially, paced by
// CRON_REQUEST_INTERVAL_MS, so even a modest backlog can take tens of seconds.
// Also raise the external scheduler's own request timeout to match.
export const maxDuration = 60;

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

  // Leaderboard pages are cached (see [sim]/leaderboards/*, [sim]/leaderboards/[track])
  // — bust exactly what changed rather than the whole site or waiting out the
  // window. This only touches acc_hotlap_leaderboard, not hot-stint (that's
  // written externally — see [sim]/leaderboards/hotstint/[track]/page.tsx).
  //
  // Two invalidations, not one: revalidatePath busts the route/RSC cache for
  // the initial page-1 render; revalidateTag busts getAccTrackLeaderboard's
  // unstable_cache (see tracks.ts), which is what actually serves page-2+ and
  // class-filtered requests via the leaderboards Server Action — those never
  // go through the route cache, so revalidatePath alone wouldn't reach them.
  if (result.tracks.length > 0) {
    revalidatePath('/acc/leaderboards');
    for (const track of result.tracks) {
      revalidatePath(`/acc/leaderboards/${track}`);
      revalidateTag(`acc-hotlap:${track}`);
    }
  }

  return NextResponse.json({
    processed: result.processed,
    tracks: result.tracks,
    durationMs: result.durationMs,
    ...(result.timedOut ? { timedOut: true } : {}),
  });
}
