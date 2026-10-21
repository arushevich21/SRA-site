import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const insert = vi.fn();
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ insert })) },
}));

import { supabase } from '@/lib/supabase';
import {
  notifyDiscordProfileUpdated,
  notifyDiscordProfileUpdatedMany,
} from './discord-notify.js';

const OK = { error: null };
const DUP = { error: { code: '23505', message: 'duplicate key' } };

beforeEach(() => {
  insert.mockReset().mockResolvedValue(OK);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const job = (id: string) => ({ type: 'profile_sync', payload: { discord_id: id } });

describe('notifyDiscordProfileUpdated', () => {
  it('queues the profile_sync job the bot drains', async () => {
    await notifyDiscordProfileUpdated('123456789012345678');

    expect(supabase.from).toHaveBeenCalledWith('bot_jobs');
    expect(insert).toHaveBeenCalledWith(job('123456789012345678'));
  });

  it('skips drivers with no usable discord_id', async () => {
    await notifyDiscordProfileUpdated(null);
    await notifyDiscordProfileUpdated('');
    await notifyDiscordProfileUpdated('not-a-snowflake');

    expect(insert).not.toHaveBeenCalled();
  });

  it('treats an already-pending sync as success', async () => {
    insert.mockResolvedValue(DUP);

    await notifyDiscordProfileUpdated('123456789012345678');

    expect(console.error).not.toHaveBeenCalled();
  });

  // A queue outage must never fail the profile save that triggered the nudge.
  it('swallows errors', async () => {
    insert.mockRejectedValue(new Error('ETIMEDOUT'));
    await expect(notifyDiscordProfileUpdated('123456789012345678')).resolves.toBeUndefined();

    insert.mockResolvedValue({ error: { code: '500', message: 'boom' } });
    await expect(notifyDiscordProfileUpdated('123456789012345678')).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

describe('notifyDiscordProfileUpdatedMany', () => {
  // Built as strings, not by adding to a numeric literal: a Discord snowflake
  // is well past Number.MAX_SAFE_INTEGER, so `1000…000 + i` yields the SAME
  // string for every i and the dedup below folds them all into one.
  const ids = (n: number) =>
    Array.from({ length: n }, (_, i) => `1000000000000${String(i).padStart(5, '0')}`);

  it('queues a whole cohort in one insert — no cap', async () => {
    const result = await notifyDiscordProfileUpdatedMany(ids(221));

    expect(result).toEqual({ kind: 'nudged', count: 221 });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toHaveLength(221);
  });

  it('deduplicates repeated ids', async () => {
    const result = await notifyDiscordProfileUpdatedMany(['123456789012345678', '123456789012345678']);

    expect(result).toEqual({ kind: 'nudged', count: 1 });
    expect(insert).toHaveBeenCalledWith([job('123456789012345678')]);
  });

  it('reports none when no driver has a usable discord id', async () => {
    const result = await notifyDiscordProfileUpdatedMany([null, undefined, '', '   ']);

    expect(result).toEqual({ kind: 'none' });
    expect(insert).not.toHaveBeenCalled();
  });

  // One member already queued rejects the whole bulk insert; the rest must
  // still get their job.
  it('falls back to per-row inserts when the dedup index rejects the batch', async () => {
    insert.mockResolvedValueOnce(DUP).mockResolvedValueOnce(DUP).mockResolvedValue(OK);

    const result = await notifyDiscordProfileUpdatedMany(ids(3));

    expect(result).toEqual({ kind: 'nudged', count: 3 });
    expect(insert).toHaveBeenCalledTimes(4);
    expect(insert).toHaveBeenLastCalledWith(job(ids(3)[2]));
    expect(console.error).not.toHaveBeenCalled();
  });

  it('never throws — a grading write must not be undone', async () => {
    insert.mockRejectedValue(new Error('down'));
    await expect(notifyDiscordProfileUpdatedMany(ids(3))).resolves.toEqual({ kind: 'nudged', count: 3 });
  });
});
