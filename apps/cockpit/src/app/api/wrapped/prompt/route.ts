import { NextResponse } from 'next/server';
import { getWrappedViewer } from '@/lib/wrapped/session';
import type { WrappedPromptState } from '@/lib/wrapped/card';
import { getCardForSteam, hasSeen, wrappedLive } from '@/lib/wrapped/snapshot';

// What the launch prompt / homepage card should show this visitor. Fetched
// client-side, once per tab, so ordinary page renders don't pay for it.
//   off         outside the launch window
//   signed-out  invite to sign in
//   no-card     signed in, but didn't race this Wrapped's series
//   ready       their card exists; `seen` says whether to pop the prompt

export const dynamic = 'force-dynamic';

export async function GET() {
  const json = (body: WrappedPromptState) =>
    NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });

  if (!wrappedLive()) return json({ state: 'off' });
  const viewer = await getWrappedViewer();
  if (!viewer) return json({ state: 'signed-out' });
  const mine = viewer.steamId ? await getCardForSteam(viewer.steamId) : null;
  if (!mine) return json({ state: 'no-card' });
  return json({
    state: 'ready',
    seen: await hasSeen(viewer.driverId),
    name: mine.card.name,
    number: mine.card.number,
  });
}
