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
  if (!url) return; // integration not configured — nothing to do

  const id = String(discordId ?? '').trim();
  // Snowflakes only: the bot parses this out of the message content, so keep
  // anything else from reaching it.
  if (!/^\d{5,25}$/.test(id)) {
    console.warn('[discord-notify] skipped: no usable discord_id');
    return;
  }

  if (!url.includes(`/webhooks/${EXPECTED_WEBHOOK_ID}/`)) {
    console.warn(
      `[discord-notify] DISCORD_INTEGRATION_WEBHOOK_URL is not webhook ${EXPECTED_WEBHOOK_ID}; ` +
        'the bot will ignore this message.',
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
