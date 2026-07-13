'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/require-admin';
import { validateStandingsExport } from '../../../lib/standings-types';
import { writeStandings, isValidStandingsKey } from '../../../lib/standings-store';

function redirectWithResult(result: string, msg: string): never {
  redirect(`/admin/standings?result=${result}&msg=${encodeURIComponent(msg)}`);
}

export async function uploadStandingsAction(formData: FormData): Promise<never> {
  await requireAdmin();

  const championshipId = (formData.get('championshipId') as string)?.trim().toLowerCase();
  if (!championshipId || !isValidStandingsKey(championshipId)) {
    redirectWithResult('error', 'Key must be lowercase alphanumeric with hyphens (e.g. 22872 or endurance-s3)');
  }

  let jsonText = formData.get('jsonText') as string | null;
  const jsonFile = formData.get('jsonFile') as File | null;

  if (!jsonText && jsonFile && jsonFile.size > 0) {
    jsonText = await jsonFile.text();
  }

  if (!jsonText?.trim()) {
    redirectWithResult('error', 'No JSON provided — paste into the textarea or attach a file');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    redirectWithResult('error', 'Invalid JSON — could not parse');
  }

  const validation = validateStandingsExport(parsed);
  if (!validation.ok) {
    redirectWithResult('error', `Validation failed: ${validation.error}`);
  }

  try {
    await writeStandings(championshipId, validation.data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown write error';
    redirectWithResult('error', `Failed to write file: ${msg}`);
  }

  redirectWithResult(
    'success',
    `Saved standings for championship ${championshipId} (${validation.data.length} class group(s), ${validation.data.reduce((n, g) => n + g.standings.length, 0)} entries)`,
  );
}
