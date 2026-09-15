/**
 * Outbound nudges to SRA-Bot.
 *
 * The bot never polls for profile changes: it writes a member's Discord nickname
 * and division role only from its `on_member_update` listeners. The old sra.gg
 * site closed that loop by POSTing a message into the bot's integration channel;
 * the bot listens for it, sets the member's nick to a placeholder, and that edit
 * fires `on_member_update` → nick + role sync, which then reads the driver row
 * back out of Supabase. So this is a *trigger*, not a data transfer — the payload
 * carries nothing but the Discord ID.
 *
 * Bot side, for reference:
 *   app/core/cogs/listeners/member_role_sync.py :: trigger_on_member_update_on_profile_update
 *   config/integration_codes.py :: PROFILE_UPDATE_CODE / INTEGRATION_WH_ID
 *
 * The bot filters on `message.webhook_id == INTEGRATION_WH_ID`, so this MUST be
 * the URL of that exact webhook (id below) — any other webhook is ignored
 * silently. Configure `DISCORD_INTEGRATION_WEBHOOK_URL`; unset (local dev,
 * previews) simply disables the nudge.
 */

const PROFILE_UPDATE_CODE = 'profile_updated';

// Not a secret (the token in the URL is) — it's committed in the bot's
// config/integration_codes.py too. Used only to catch a misconfigured URL.
const EXPECTED_WEBHOOK_ID = '1021527577724190800';

const TIMEOUT_MS = 3000;

/**
 * Returns the webhook id if `raw` is a real Discord webhook URL, else null.
 *
 * Exists because the natural misconfiguration here — setting the var to the
 * webhook *id* instead of its full URL — otherwise surfaces only as a generic
 * "Invalid URL" from fetch, swallowed by the catch below, leaving no clue why
 * Discord never updates.
 */
function webhookId(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!/^(discord|discordapp)\.com$/.test(parsed.hostname)) return null;
  const m = /^\/api(?:\/v\d+)?\/webhooks\/(\d+)\/[\w-]+$/.exec(parsed.pathname);
  return m ? m[1] : null;
}

/**
 * Ask the bot to resync a member's nickname and division role.
 *
 * Never throws and never blocks longer than {@link TIMEOUT_MS}: a Discord
 * outage must not fail the profile save that triggered it. The driver row is
 * already committed at that point, so the worst case is a stale nickname until
 * the next member update.
 */
export async function notifyDiscordProfileUpdated(
  discordId: string | number | null | undefined,
): Promise<void> {
  const url = process.env.DISCORD_INTEGRATION_WEBHOOK_URL;
  if (!url) {
    // Silent no-op here previously left zero trace in logs when this var was
    // missing in an environment that should have it (e.g. Production) —
    // indistinguishable from "the bot resynced and did nothing new". Warn so
    // a stuck-nickname report is diagnosable from Vercel logs instead of
    // requiring a guess-and-check of env var configuration.
    console.warn('[discord-notify] skipped: DISCORD_INTEGRATION_WEBHOOK_URL not configured');
    return;
  }

  const id = String(discordId ?? '').trim();
  // Snowflakes only: the bot parses this out of the message content, so keep
  // anything else from reaching it.
  if (!/^\d{5,25}$/.test(id)) {
    console.warn('[discord-notify] skipped: no usable discord_id');
    return;
  }

  const configuredId = webhookId(url);
  if (!configuredId) {
    console.error(
      '[discord-notify] DISCORD_INTEGRATION_WEBHOOK_URL is not a Discord webhook URL. ' +
        'Expected https://discord.com/api/webhooks/<id>/<token> — the full URL, not just the id.',
    );
    return;
  }
  if (configuredId !== EXPECTED_WEBHOOK_ID) {
    console.warn(
      `[discord-notify] configured webhook is ${configuredId}, but the bot only reacts to ` +
        `${EXPECTED_WEBHOOK_ID} (INTEGRATION_WH_ID); this message will be ignored.`,
    );
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `${PROFILE_UPDATE_CODE}|${id}`,
        // The content is machine-read by the bot; never let it ping anyone.
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(
        `[discord-notify] webhook POST failed: ${res.status} ${res.statusText}`,
      );
    }
  } catch (err) {
    // Includes the timeout abort. Log and move on.
    console.error(
      '[discord-notify] webhook POST error:',
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * How many drivers a single admin action will nudge individually before it
 * stops and defers to the bot's bulk resync command.
 *
 * Discord rate-limits a webhook to roughly 5 requests per 2 seconds (and ~30
 * messages/minute per channel), so nudging the whole 221-driver classification
 * cohort one at a time would take minutes and blow the server action's
 * execution budget long before it finished. A small edit — regrading a handful
 * of drivers — is worth nudging inline; a bulk run is the bot's job.
 */
export const DISCORD_NUDGE_LIMIT = 10;

// Spacing between nudges. Comfortably under Discord's ~5-per-2s webhook bucket
// while keeping a full batch (10 × 250ms = 2.5s) inside a server action's
// budget alongside the DB write it follows.
const NUDGE_SPACING_MS = 250;

export type DiscordNudgeOutcome =
  /** Every affected driver was nudged individually. */
  | { kind: 'nudged'; count: number }
  /** Too many to nudge inline — SRA-Bot's bulk resync should be run instead. */
  | { kind: 'deferred-to-bulk'; count: number }
  /** Nothing to do: no affected driver had a usable discord_id. */
  | { kind: 'none' };

/**
 * Nudges a set of drivers, throttled, or defers when the set is too large.
 *
 * Same trigger-not-transfer semantics as {@link notifyDiscordProfileUpdated}:
 * each nudge makes the bot re-read that driver's row out of Supabase, so the
 * division/tier written immediately before this call is what the bot picks up.
 * Never throws — a Discord problem must not fail a grading write that already
 * committed.
 */
export async function notifyDiscordProfileUpdatedMany(
  discordIds: (string | null | undefined)[],
  // Overridable so tests don't spend real seconds asleep. Production callers
  // pass nothing and get the throttle.
  { spacingMs = NUDGE_SPACING_MS }: { spacingMs?: number } = {},
): Promise<DiscordNudgeOutcome> {
  const ids = [...new Set(discordIds.filter((id): id is string => !!id && id.trim() !== ''))];

  if (ids.length === 0) return { kind: 'none' };
  if (ids.length > DISCORD_NUDGE_LIMIT) return { kind: 'deferred-to-bulk', count: ids.length };

  for (const [i, id] of ids.entries()) {
    // Sequential, not Promise.all: the whole point is to stay under the rate
    // limit, and firing them in parallel would defeat that.
    await notifyDiscordProfileUpdated(id);
    if (spacingMs > 0 && i < ids.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, spacingMs));
    }
  }

  return { kind: 'nudged', count: ids.length };
}
