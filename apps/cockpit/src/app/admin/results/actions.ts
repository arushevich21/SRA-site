'use server';

import { redirect } from 'next/navigation';
import { parseAccSession } from '@sra/domain';
import { requireAdmin } from '@/lib/require-admin';
import { ingestAccRaceSession } from '@/lib/acc/race-results-store';

function redirectWithResult(result: string, msg: string): never {
  redirect(`/admin/results?result=${result}&msg=${encodeURIComponent(msg)}`);
}

// No Emperor resultsJsonUrl exists for a manually-uploaded file, so the
// session key is derived from the file's own contents instead — stable
// across re-uploads of the same session (upserts in place) without
// colliding with the live cron's URL-keyed rows.
async function ingestFile(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error(`${file.name}: could not parse as JSON`);
  }

  const session = parseAccSession(parsed);
  const sessionKey = `manual:${session.track}:${session.sessionFile ?? file.name}`;
  await ingestAccRaceSession(session, sessionKey);
  return session.sessionType;
}

export async function uploadAccResultsAction(formData: FormData): Promise<never> {
  await requireAdmin();

  const files = [
    formData.get('fpFile') as File | null,
    formData.get('qFile') as File | null,
    formData.get('rFile') as File | null,
  ];

  if (files.every((f) => !f || f.size === 0)) {
    redirectWithResult('error', 'Attach at least one session JSON file (Practice, Qualifying, or Race)');
  }

  const ingested: string[] = [];
  try {
    for (const file of files) {
      const sessionType = await ingestFile(file);
      if (sessionType) ingested.push(sessionType);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    redirectWithResult('error', msg);
  }

  redirectWithResult('success', `Ingested ${ingested.length} session(s): ${ingested.join(', ')}`);
}
