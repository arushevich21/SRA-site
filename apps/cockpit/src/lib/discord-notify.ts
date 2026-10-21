/**
 * Outbound nudges to SRA-Bot.
 *
 * The bot never polls drivers for changes: a member's Discord nickname and
 * division/SRAlien roles are rewritten only when something tells it to. That
 * signal is a `profile_sync` job on the `bot_jobs` outbox — the bot drains it
 * (Realtime for instant pickup, 30s poll as the safety net), re-reads the
 * driver row out of Supabase, and applies roles + nick. So this is a
 * *trigger*, not a data transfer — the payload carries only the Discord ID.
 *
 * This used to POST `profile_updated|<id>` to an integration webhook. SRA-Bot
 * removed that listener on 2026-09-16 (it gated on a retired channel), so the
 * webhook was being sent into the void and site edits never reached Discord.
 *
 * Bot side, for reference:
 *   app/core/cogs/bot_jobs.py :: BotJobs._handle_profile_sync
 *
 * `bot_jobs_profile_sync_pending_dedup` allows one *pending* profile_sync per
 * discord_id. Hitting it (23505) means a sync is already queued, and since the
 * job reads current DB state when it runs, that one covers this change too.
 */

import { supabase } from '@/lib/supabase';

const PROFILE_SYNC = 'profile_sync';
const UNIQUE_VIOLATION = '23505';

// Snowflakes only: the bot int()s this, so keep anything else from reaching it.
function usableId(discordId: string | number | null | undefined): string | null {
  const id = String(discordId ?? '').trim();
  return /^\d{5,25}$/.test(id) ? id : null;
}

function jobFor(id: string) {
  return { type: PROFILE_SYNC, payload: { discord_id: id } };
}

/** Insert one job; an already-pending job for the same member counts as done. */
async function enqueueOne(id: string): Promise<void> {
  const { error } = await supabase.from('bot_jobs').insert(jobFor(id));
  if (error && error.code !== UNIQUE_VIOLATION) {
    console.error(`[discord-notify] enqueue failed for ${id}: ${error.message}`);
  }
}

/**
 * Ask the bot to resync a member's nickname and roles.
 *
 * Never throws: the driver row is already committed when this runs, and a
 * queue hiccup must not fail the save that triggered it.
 */
export async function notifyDiscordProfileUpdated(
  discordId: string | number | null | undefined,
): Promise<void> {
  const id = usableId(discordId);
  if (!id) {
    console.warn('[discord-notify] skipped: no usable discord_id');
    return;
  }
  try {
    await enqueueOne(id);
  } catch (err) {
    console.error('[discord-notify] enqueue error:', err instanceof Error ? err.message : err);
  }
}

export type DiscordNudgeOutcome =
  /** A resync was queued for every affected driver with a Discord account. */
  | { kind: 'nudged'; count: number }
  /** Nothing to do: no affected driver had a usable discord_id. */
  | { kind: 'none' };

/**
 * Queues a resync for a set of drivers.
 *
 * One bulk insert in the common case. If any member already has a pending
 * sync the whole insert is rejected by the dedup index, so fall back to
 * per-row inserts that each tolerate it. The bot paces the Discord side
 * itself, so there is no cap here — a full classification run just queues
 * every driver. Never throws.
 */
export async function notifyDiscordProfileUpdatedMany(
  discordIds: (string | null | undefined)[],
): Promise<DiscordNudgeOutcome> {
  const ids = [
    ...new Set(discordIds.map(usableId).filter((id): id is string => id !== null)),
  ];
  if (ids.length === 0) return { kind: 'none' };

  try {
    const { error } = await supabase.from('bot_jobs').insert(ids.map(jobFor));
    if (error?.code === UNIQUE_VIOLATION) {
      for (const id of ids) await enqueueOne(id);
    } else if (error) {
      console.error(`[discord-notify] bulk enqueue failed: ${error.message}`);
    }
  } catch (err) {
    console.error('[discord-notify] enqueue error:', err instanceof Error ? err.message : err);
  }

  return { kind: 'nudged', count: ids.length };
}
