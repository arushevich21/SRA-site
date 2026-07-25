import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// TEMPORARY diagnostic — reports this serverless function's public egress IP
// (as seen by external echo services) so we can hand the ACCSM firewall admin
// the exact IP to allowlist, and confirm whether Vercel's requests to
// accsm*.simracingalliance.com are being blocked at that IP. Delete once ACC
// ingestion is confirmed working. NOTE: without a dedicated egress IP (Vercel
// Secure Compute), egress can rotate per connection — hitting several echo
// services at once surfaces whether the IP is stable or varies.
export async function GET(): Promise<NextResponse> {
  const echoServices: ReadonlyArray<readonly [string, string]> = [
    ['ipify', 'https://api.ipify.org'],
    ['ifconfig.me', 'https://ifconfig.me/ip'],
    ['icanhazip', 'https://icanhazip.com'],
  ];

  const egress: Record<string, string> = {};
  await Promise.all(
    echoServices.map(async ([name, url]) => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        egress[name] = (await res.text()).trim();
      } catch (err) {
        egress[name] = `error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }),
  );

  return NextResponse.json({ region: process.env.VERCEL_REGION ?? null, egress });
}
