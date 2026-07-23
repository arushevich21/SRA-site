export const EMPEROR_ACEVO_BASE_URL = (
  process.env.EMPEROR_ACEVO_BASE_URL ?? 'https://sram1acevo.emperorservers.com'
).replace(/\/+$/, '');

// SRA runs multiple ACCSM (ACC Server Manager) instances at
// accsm1-7.simracingalliance.com. All are wired in here so no code change is
// needed as servers come online or host one-off events (e.g. quick races) —
// the cron isolates per-server failures, so any that are idle or unreachable
// at a given moment fail harmlessly (see runIncrementalRefresh). As of 2026-07
// accsm1/4/5 are live and accsm6 is unreachable. Production can pin a subset
// via EMPEROR_ACC_BASE_URLS; leave it unset to poll all seven.
export const EMPEROR_ACC_BASE_URLS: string[] = (
  process.env.EMPEROR_ACC_BASE_URLS ??
  [1, 2, 3, 4, 5, 6, 7].map((n) => `https://accsm${n}.simracingalliance.com`).join(',')
)
  .split(',')
  .map((u) => u.trim().replace(/\/+$/, ''))
  .filter(Boolean);
