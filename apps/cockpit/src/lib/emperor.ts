export const EMPEROR_ACEVO_BASE_URL = (
  process.env.EMPEROR_ACEVO_BASE_URL ?? 'https://sram1acevo.emperorservers.com'
).replace(/\/+$/, '');

// SRA runs multiple ACCSM (ACC Server Manager) instances — currently only
// ACCSM4 is wired in. Add more hostnames here as they come online.
export const EMPEROR_ACC_BASE_URLS: string[] = (
  process.env.EMPEROR_ACC_BASE_URLS ?? 'https://accsm4.simracingalliance.com'
)
  .split(',')
  .map((u) => u.trim().replace(/\/+$/, ''))
  .filter(Boolean);
