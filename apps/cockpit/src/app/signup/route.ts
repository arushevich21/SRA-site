import { redirect } from 'next/navigation';

// sra.gg/signup is a bare alias: there's no separate signup flow, just the
// existing Discord OAuth login (auth/login/route.ts upserts a drivers row on
// first sign-in via the callback), so this immediately forwards into it
// instead of rendering anything.
export async function GET() {
  redirect('/auth/login');
}
