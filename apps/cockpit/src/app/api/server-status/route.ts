import { NextResponse } from 'next/server';
import { getFleetStatus, FLEET_REVALIDATE_SECONDS } from '@/lib/server-fleet';

// Public, cached snapshot of every SRA-hosted server across all sims. Both the
// calendar's ACC panel and /about/servers read this one route, so the upstream
// managers are hit at most once per window regardless of traffic.
export const revalidate = 60;

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(await getFleetStatus(), {
    headers: {
      'Cache-Control': `public, s-maxage=${FLEET_REVALIDATE_SECONDS}, stale-while-revalidate=120`,
    },
  });
}
