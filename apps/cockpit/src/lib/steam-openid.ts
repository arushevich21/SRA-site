import 'server-only';

// Steam sign-in uses OpenID 2.0 (a legacy protocol), NOT OAuth2 — which is why
// it can't be a Supabase Auth provider and lives here as a hand-rolled flow.
// The handshake is keyless: no Steam Web API key is needed to prove ownership.
//
//   1. buildLoginUrl()   → redirect the user to Steam
//   2. Steam redirects back to return_to with a signed assertion
//   3. verifyAssertion() → POST the assertion back to Steam (check_authentication).
//      Steam replies is_valid:true only for a genuine, unmodified assertion.
//      This step IS the security model — without it the callback is forgeable.

const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const STEAM_ID_RE = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

/**
 * Build the URL that sends the user to Steam to approve sign-in.
 *
 * `origin` is the site origin (e.g. https://…vercel.app). realm/return_to must
 * agree with what the callback receives, so we derive both from the same origin.
 */
export function buildLoginUrl(origin: string): string {
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': `${origin}/auth/steam/callback`,
    'openid.realm': origin,
    // identifier_select = "let the user pick which Steam account"
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });
  return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`;
}

/**
 * Verify the assertion Steam redirected back with and extract the SteamID64.
 *
 * Returns the 17-digit SteamID64 on success, or null if the assertion is
 * missing, malformed, or Steam does not confirm it as valid. Never throws.
 */
export async function verifyAssertion(
  incoming: URLSearchParams,
): Promise<string | null> {
  // The claimed_id carries the SteamID; bail early if it isn't the shape we
  // expect (also guards against an attacker pointing claimed_id elsewhere).
  const claimedId = incoming.get('openid.claimed_id');
  const match = claimedId ? STEAM_ID_RE.exec(claimedId) : null;
  if (!match) return null;
  const steamId = match[1];

  // Echo every openid.* param back to Steam unchanged, flipping mode to
  // check_authentication. Steam re-signs and tells us whether it's valid.
  const body = new URLSearchParams(incoming);
  body.set('openid.mode', 'check_authentication');

  let text: string;
  try {
    const res = await fetch(STEAM_OPENID_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    text = await res.text();
  } catch {
    return null;
  }

  // A valid response contains the line `is_valid:true`.
  const isValid = /(^|\n)is_valid\s*:\s*true(\r?\n|$)/.test(text);
  return isValid ? steamId : null;
}
