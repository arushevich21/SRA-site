export const EMPEROR_ACEVO_BASE_URL = (
  process.env.EMPEROR_ACEVO_BASE_URL ?? 'https://sram1acevo.emperorservers.com'
).replace(/\/+$/, '');

// SRA runs its ACC fleet on two ACCSM (ACC Server Manager) instances at
// accsm1-2.simracingalliance.com. Each one hosts SEVERAL race servers —
// accsm1 carries SRAM1/3/5/7, accsm2 carries SRAM2/4/6 — enumerated in the
// healthcheck's `Servers` map (see lib/server-fleet.ts).
//
// This used to default to accsm1-7. Confirmed 2026-09-28 that only 1 and 2
// are in use now; 3/4/5/7 no longer resolve and 6 returns 404,
// so every cron run was paying a full fetch timeout apiece for five hosts
// that will never answer. Production can still pin a different subset via
// EMPEROR_ACC_BASE_URLS if a host comes back.
export const EMPEROR_ACC_BASE_URLS: string[] = (
  process.env.EMPEROR_ACC_BASE_URLS ??
  [1, 2].map((n) => `https://accsm${n}.simracingalliance.com`).join(',')
)
  .split(',')
  .map((u) => u.trim().replace(/\/+$/, ''))
  .filter(Boolean);
