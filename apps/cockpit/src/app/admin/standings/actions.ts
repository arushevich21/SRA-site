'use server';

/**
 * TEMPORARY — server actions for the admin standings upload page.
 * Replace with real auth + persistence before production use.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  getSessionCookieValue,
  isValidSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from '../../../lib/admin-auth';
import { validateStandingsExport } from '../../../lib/standings-types';
import { writeStandings } from '../../../lib/standings-store';

function redirectWithResult(result: string, msg: string): never {
  redirect(`/admin/standings?result=${result}&msg=${encodeURIComponent(msg)}`);
}

export async function loginAction(formData: FormData): Promise<never> {
  const password = formData.get('password');
  if (typeof password !== 'string' || !password) {
    redirectWithResult('error', 'Password is required');
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    redirectWithResult('error', 'ADMIN_PASSWORD not configured on server');
  }

  if (password !== expected) {
    redirectWithResult('error', 'Invalid password');
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, getSessionCookieValue(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/admin',
    maxAge: SESSION_MAX_AGE,
  });

  redirectWithResult('success', 'Logged in');
}

export async function uploadStandingsAction(formData: FormData): Promise<never> {
  const jar = await cookies();
  if (!isValidSession(jar.get(SESSION_COOKIE)?.value)) {
    redirectWithResult('error', 'Not authenticated');
  }

  const rawId = formData.get('championshipId');
  const championshipId = Number(rawId);
  if (!Number.isInteger(championshipId) || championshipId <= 0) {
    redirectWithResult('error', 'Championship ID must be a positive integer');
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

export async function logoutAction(): Promise<never> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirectWithResult('success', 'Logged out');
}
