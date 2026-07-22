export const EMPEROR_ACEVO_BASE_URL = (
  process.env.EMPEROR_ACEVO_BASE_URL ?? 'https://sram1acevo.emperorservers.com'
).replace(/\/+$/, '');

// SRA runs multiple ACCSM (ACC Server Manager) instances, accsm1-7. Only
// ACCSM4 is live as of 2026-07; the rest are wired in ahead of time so no
// code change is needed as they come online — healthcheck failures for the
// not-yet-live ones are expected and harmless (see runIncrementalRefresh).
export const EMPEROR_ACC_BASE_URLS: string[] = (
  process.env.EMPEROR_ACC_BASE_URLS ??
  [1, 2, 3, 4, 5, 6, 7].map((n) => `https://accsm${n}.simracingalliance.com`).join(',')
)
  .split(',')
  .map((u) => u.trim().replace(/\/+$/, ''))
  .filter(Boolean);
