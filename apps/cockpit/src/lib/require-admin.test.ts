import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// require-admin.ts imports 'server-only' and next/navigation's redirect —
// stub both so this file is importable in a plain vitest run, same pattern
// as hot-stint-store.test.ts.
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('./supabase-server', () => ({ createSupabaseServerClient: vi.fn() }));

const { ADMIN_PERMISSIONS } = await import('./require-admin.js');

// The RLS side of 'bop' lives in a migration file, not exported TS — the
// two are two independent literals with nothing forcing them to agree.
// This reads the migration's actual text so a typo on either side (RLS
// checks a permission that's never granted, or TS grants a permission RLS
// never checks) fails a test instead of failing silently in production.
// See ADMIN_PERMISSIONS' own comment in require-admin.ts for why this
// can't be a DB CHECK constraint instead (would defeat the point of
// keeping `permission` migration-free for the next scoped role).
describe('ADMIN_PERMISSIONS.BOP', () => {
  it('matches the literal used in 20260825c_admin_permissions.sql', () => {
    const migrationPath = fileURLToPath(
      new URL(
        '../../../../supabase/migrations/20260825c_admin_permissions.sql',
        import.meta.url,
      ),
    );
    const migrationSrc = readFileSync(migrationPath, 'utf-8');
    expect(migrationSrc).toContain(`has_admin_permission('${ADMIN_PERMISSIONS.BOP}')`);
  });
});
