'use server';

import { getWrappedViewer } from '@/lib/wrapped/session';
import { markSeen } from '@/lib/wrapped/snapshot';

// Records that the signed-in driver has seen (or dismissed) this season's
// Wrapped, so the launch prompt doesn't come back — on any device. Acts only
// on the session's own driver; takes no input.
export async function markWrappedSeen(): Promise<void> {
  const viewer = await getWrappedViewer();
  if (viewer) await markSeen(viewer.driverId);
}
