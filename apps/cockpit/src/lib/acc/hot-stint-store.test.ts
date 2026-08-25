import { describe, it, expect, vi } from 'vitest';

// hot-stint-store.ts imports 'server-only' and the production supabase
// singleton (which throws if env vars aren't set) — stub both so this file
// is importable in a plain vitest run. These tests only exercise the
// exported column-list constants and source text, not any actual query
// execution — the real enforcement of the privacy rule is
// classification_status_public (a security_invoker VIEW with an explicit
// anon/authenticated revoke — see 20260814b_classification_hotstint_public.sql),
// which holds even though every query in this codebase, public and admin
// alike, runs on the same service-role client and therefore bypasses RLS.
// These are the belt-and-braces app-layer mirror, not the primary defense.
vi.mock('server-only', () => ({}));
vi.mock('../supabase', () => ({ supabase: {} }));

const {
  PUBLIC_CLASSIFICATION_COLUMNS,
  ADMIN_ONLY_CLASSIFICATION_COLUMNS,
  ALL_CLASSIFICATION_STATUS_COLUMNS,
} = await import('./hot-stint-store.js');

describe('PUBLIC_CLASSIFICATION_COLUMNS', () => {
  it('never includes an admin-only (PII/lap-count/rating-revealing) column', () => {
    for (const col of ADMIN_ONLY_CLASSIFICATION_COLUMNS) {
      expect(PUBLIC_CLASSIFICATION_COLUMNS).not.toContain(col);
    }
  });

  it('is exactly the public-safe column set — scoping + display name + time + car + sectors + steam_id only', () => {
    // A change to this list is exactly the kind of change that should force
    // a human to re-read the privacy requirement before merging. No
    // discord_id, no driver_id, no rating internals, no num_laps (the one
    // column that's permanently admin-only, confirmed 2026-08-25) — the
    // same PII/lap-count enumeration the classification_status leak
    // exposed. car_model(_id), sectors_ms, car_group, track_key, and
    // steam_id are not in that category — see
    // 20260825_classification_status_car_model.sql.
    expect([...PUBLIC_CLASSIFICATION_COLUMNS].sort()).toEqual(
      [
        'car_model',
        'car_model_id',
        'car_group',
        'first_name',
        'hotstint_ms',
        'last_name',
        'season',
        'series',
        'sectors_ms',
        'steam_id',
        'track_key',
      ].sort(),
    );
  });

  it('PUBLIC ∪ ADMIN_ONLY covers every column on classification_status — a new column must be classified', () => {
    // ALL_CLASSIFICATION_STATUS_COLUMNS is transcribed independently from
    // the view's definition, not derived from the two lists below — see its
    // own comment for why that independence is what makes this assertion
    // meaningful. If this fails, someone added a column to
    // classification_status without deciding whether it's public or
    // admin-only, which is exactly the silent-drift scenario this test
    // exists to catch.
    const union = [...new Set([...PUBLIC_CLASSIFICATION_COLUMNS, ...ADMIN_ONLY_CLASSIFICATION_COLUMNS])].sort();
    expect(union).toEqual([...ALL_CLASSIFICATION_STATUS_COLUMNS].sort());
  });

  it('never selects "*" — the public query builds its column list from PUBLIC_CLASSIFICATION_COLUMNS', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('./hot-stint-store.ts', import.meta.url), 'utf-8'),
    );
    const publicFnSrc = src.slice(
      src.indexOf('export async function getPublicHotStintLeaderboard'),
      src.indexOf('export type AdminHotStintRow'),
    );
    expect(publicFnSrc).not.toContain("select('*')");
    expect(publicFnSrc).not.toContain('select("*")');
  });

  it('the public query reads from the classification_status_public VIEW, not classification_status directly', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('./hot-stint-store.ts', import.meta.url), 'utf-8'),
    );
    const publicFnSrc = src.slice(
      src.indexOf('export async function getPublicHotStintLeaderboard'),
      src.indexOf('export type AdminHotStintRow'),
    );
    expect(publicFnSrc).toContain("from('classification_status_public')");
  });
});
