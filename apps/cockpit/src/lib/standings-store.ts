/**
 * TEMPORARY — filesystem-based standings storage.
 *
 * Writes uploaded SimGrid standings exports to:
 *   apps/cockpit/src/content/standings/{key}.json
 *
 * This does NOT persist across deploys on Vercel or similar platforms.
 * It is only meant for local/testing use until real persistence
 * (packages/store, database, or blob storage) is added.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { StandingsExport } from './standings-types';

const STANDINGS_DIR = path.join(process.cwd(), 'src', 'content', 'standings');
const VALID_KEY = /^[a-z0-9][a-z0-9-]*$/;

export function isValidStandingsKey(key: string): boolean {
  return VALID_KEY.test(key) && !key.includes('..');
}

export async function writeStandings(
  key: string,
  data: StandingsExport,
): Promise<void> {
  await mkdir(STANDINGS_DIR, { recursive: true });
  const filePath = path.join(STANDINGS_DIR, `${key}.json`);
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export async function readStandings(
  key: string,
): Promise<StandingsExport | null> {
  const filePath = path.join(STANDINGS_DIR, `${key}.json`);
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as StandingsExport;
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}
