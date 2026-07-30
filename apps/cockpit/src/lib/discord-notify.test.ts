import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notifyDiscordProfileUpdated } from './discord-notify.js';

const WEBHOOK = 'https://discord.com/api/webhooks/1021527577724190800/token';

describe('notifyDiscordProfileUpdated', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.DISCORD_INTEGRATION_WEBHOOK_URL;
  });

  it('does nothing when the webhook is not configured', async () => {
    await notifyDiscordProfileUpdated('123456789012345678');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the code the bot listens for, with mentions disabled', async () => {
    process.env.DISCORD_INTEGRATION_WEBHOOK_URL = WEBHOOK;

    await notifyDiscordProfileUpdated('123456789012345678');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(WEBHOOK);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      content: 'profile_updated|123456789012345678',
      allowed_mentions: { parse: [] },
    });
  });

  it('skips drivers with no usable discord_id', async () => {
    process.env.DISCORD_INTEGRATION_WEBHOOK_URL = WEBHOOK;

    await notifyDiscordProfileUpdated(null);
    await notifyDiscordProfileUpdated('');
    await notifyDiscordProfileUpdated('not-a-snowflake');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // The easy misconfiguration: pasting the webhook id instead of its URL.
  it('reports a non-URL value instead of attempting a request', async () => {
    process.env.DISCORD_INTEGRATION_WEBHOOK_URL = '1021527577724190800';

    await notifyDiscordProfileUpdated('123456789012345678');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('warns when pointed at a webhook the bot ignores', async () => {
    process.env.DISCORD_INTEGRATION_WEBHOOK_URL =
      'https://discord.com/api/webhooks/999999999999999999/token';

    await notifyDiscordProfileUpdated('123456789012345678');

    expect(console.warn).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1); // still sent — the id may have changed
  });

  // A Discord outage must never fail the profile save that triggered the nudge.
  it('swallows transport errors', async () => {
    process.env.DISCORD_INTEGRATION_WEBHOOK_URL = WEBHOOK;
    fetchMock.mockRejectedValue(new Error('ETIMEDOUT'));

    await expect(notifyDiscordProfileUpdated('123456789012345678')).resolves.toBeUndefined();
  });

  it('swallows a non-2xx response', async () => {
    process.env.DISCORD_INTEGRATION_WEBHOOK_URL = WEBHOOK;
    fetchMock.mockResolvedValue(new Response('nope', { status: 404, statusText: 'Not Found' }));

    await expect(notifyDiscordProfileUpdated('123456789012345678')).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
