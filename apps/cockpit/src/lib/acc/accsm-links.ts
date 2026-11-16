// Deep links from our results pages back to the same session on ACCSM, the
// Emperor server manager the race actually ran on. Pure (no env, no DB) so
// client components can call it and it can be unit-tested.
//
// Two facts, both checked against the live hosts on 2026-11-16:
//
//  1. Which host. acc_race_sessions doesn't store it, and both hosts number
//     their servers from 0, so `/server/0/...` alone is ambiguous. The SRAM
//     slot tag in the server name decides it: accsm1 runs SRAM1/3/5/7 and
//     accsm2 runs SRAM2/4/6 (see server-fleet.ts). Linking the wrong host is
//     a 404, so no tag means no link rather than a guess.
//  2. The page path. It's `/server/{id}/result/{YYYY-MM-DD_HH-MM-SS}_{TYPE}`,
//     singular "result". The list API's own `results_page_url` field says
//     `/results/` (plural) and 404s, so it isn't used.

const ACCSM_HOST_ODD = 'https://accsm1.simracingalliance.com';
const ACCSM_HOST_EVEN = 'https://accsm2.simracingalliance.com';

// ACC's file suffix -> ACCSM's session label in the page URL. Only the three
// codes seen in the wild. Anything else (a sprint-weekend R1/R2) gets no link
// until it's been checked against a real page.
const TYPE_BY_SUFFIX: Record<string, string> = {
  FP: 'PRACTICE',
  Q: 'QUALIFYING',
  R: 'RACE',
};

const SLOT_TAG = /\bSRAM(\d+)\b/i;
const SERVER_ID = /^\/server\/(\d+)\/results\/download\//;
const SESSION_FILE = /^(\d{2})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_([A-Z]+)$/;

export function accsmHostForServerName(serverName: string | null): string | null {
  if (!serverName) return null;
  const m = SLOT_TAG.exec(serverName);
  if (!m) return null;
  return Number(m[1]) % 2 === 1 ? ACCSM_HOST_ODD : ACCSM_HOST_EVEN;
}

export function accsmResultPageUrl(session: {
  sessionKey: string | null;
  sessionFile: string | null;
  serverName: string | null;
}): string | null {
  const host = accsmHostForServerName(session.serverName);
  const serverId = session.sessionKey ? SERVER_ID.exec(session.sessionKey)?.[1] : undefined;
  const file = session.sessionFile ? SESSION_FILE.exec(session.sessionFile) : null;
  if (!host || serverId == null || !file) return null;

  const [, yy, mo, dd, hh, mi, ss, suffix] = file;
  const type = TYPE_BY_SUFFIX[suffix];
  if (!type) return null;

  return `${host}/server/${serverId}/result/20${yy}-${mo}-${dd}_${hh}-${mi}-${ss}_${type}`;
}
