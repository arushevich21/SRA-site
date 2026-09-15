import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  notifyDiscordProfileUpdated,
  notifyDiscordProfileUpdatedMany,
  DISCORD_NUDGE_LIMIT,
} from './discord-notify.js';

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

// The throttle is real time and irrelevant to what these assert.
const NO_THROTTLE = { spacingMs: 0 };

describe('notifyDiscordProfileUpdatedMany', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.DISCORD_INTEGRATION_WEBHOOK_URL = WEBHOOK;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.DISCORD_INTEGRATION_WEBHOOK_URL;
  });

  // Built as strings, not by adding to a numeric literal: a Discord snowflake
  // is well past Number.MAX_SAFE_INTEGER, so `1000…000 + i` yields the SAME
  // string for every i and the dedup below folds them all into one.
  const ids = (n: number) =>
    Array.from({ length: n }, (_, i) => `1000000000000${String(i).padStart(5, '0')}`);

  it('nudges each driver in a small batch', async () => {
    const result = await notifyDiscordProfileUpdatedMany(ids(3), NO_THROTTLE);
    expect(result).toEqual({ kind: 'nudged', count: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('nudges right up to the limit', async () => {
    const result = await notifyDiscordProfileUpdatedMany(ids(DISCORD_NUDGE_LIMIT), NO_THROTTLE);
    expect(result).toEqual({ kind: 'nudged', count: DISCORD_NUDGE_LIMIT });
    expect(fetchMock).toHaveBeenCalledTimes(DISCORD_NUDGE_LIMIT);
  });

  it('defers past the limit instead of rate-limiting itself into a stall', async () => {
    // The 221-driver classification run is exactly this case.
    const result = await notifyDiscordProfileUpdatedMany(ids(DISCORD_NUDGE_LIMIT + 1), NO_THROTTLE);
    expect(result).toEqual({ kind: 'deferred-to-bulk', count: DISCORD_NUDGE_LIMIT + 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deduplicates, so a repeated id counts once against the limit', async () => {
    const result = await notifyDiscordProfileUpdatedMany(['123456789012345678', '123456789012345678'], NO_THROTTLE);
    expect(result).toEqual({ kind: 'nudged', count: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports none when no driver has a usable discord id', async () => {
    const result = await notifyDiscordProfileUpdatedMany([null, undefined, '', '   '], NO_THROTTLE);
    expect(result).toEqual({ kind: 'none' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps going when one nudge fails — a grading write must not be undone', async () => {
    fetchMock.mockRejectedValueOnce(new Error('discord down'));
    const result = await notifyDiscordProfileUpdatedMany(ids(3), NO_THROTTLE);
    expect(result).toEqual({ kind: 'nudged', count: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
