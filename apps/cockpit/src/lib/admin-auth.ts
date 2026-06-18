/**
 * TEMPORARY — placeholder auth for the admin standings upload page.
 * Shared-password check via ADMIN_PASSWORD env var + httpOnly cookie.
 *
 * REPLACE WITH REAL AUTH (e.g. NextAuth, Clerk, or similar) before
 * this app has real users beyond the race director.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const SALT = 'sra-admin-standings-temp';

export function getSessionCookieValue(password: string): string {
  return createHmac('sha256', SALT).update(password).digest('hex');
}

export function isValidSession(cookieValue: string | undefined): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !cookieValue) return false;

  const expected = getSessionCookieValue(password);
  try {
    return timingSafeEqual(
      Buffer.from(cookieValue, 'utf8'),
      Buffer.from(expected, 'utf8'),
    );
  } catch {
    return false;
  }
}

export const SESSION_COOKIE = 'sra-admin-session';
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours
