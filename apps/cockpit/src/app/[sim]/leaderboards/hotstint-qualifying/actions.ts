'use server';

import { getCurrentDriverContext } from '@/lib/current-driver';
import {
  getClassificationSignupState,
  getCurrentClassificationScope,
  type ClassificationSignupState,
} from '@/lib/acc/hot-stint-store';

// Client-side fetch target for ClassificationSignupNotice — deliberately
// takes no arguments. steamId comes from the caller's own session (via
// getCurrentDriverContext's RLS-scoped drivers lookup, drivers_select_own:
// auth.uid() = user_id), never from client input, since
// getClassificationSignupState reads has_signup/has_hotstint through the
// service-role client and those columns are otherwise admin-only — accepting
// a steamId parameter here would let any signed-in visitor probe another
// driver's classification status.
export async function getMyClassificationSignupNotice(): Promise<ClassificationSignupState> {
  const { steamId } = await getCurrentDriverContext();
  if (!steamId) return null;

  const scope = await getCurrentClassificationScope();
  if (!scope) return null;

  return getClassificationSignupState(steamId, scope.series, scope.season);
}
