import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Most traffic on a public leaderboard site is anonymous. getUser() is a
  // network round-trip to Supabase's auth server on every request — skip it
  // entirely when there's no Supabase auth cookie to refresh or check in the
  // first place. A signed-in request always carries one of these (set by
  // @supabase/ssr, chunked as "-auth-token" / "-auth-token.0" etc. for large
  // sessions), so this can't false-negative a real session.
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.includes('-auth-token'));
  if (!hasAuthCookie) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the session cookie if it's expiring soon.
  // IMPORTANT: do not remove this call — it keeps the user logged in across requests.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Steam gate ──────────────────────────────────────────────────────────────
  // Every signed-in user must have a VERIFIED Steam link before using the site.
  // Unverified users are funnelled to /auth/steam/link. Auth routes and the gate
  // page itself are exempt so the flow (and sign-out) can complete.
  if (user && !isGateExempt(request.nextUrl.pathname)) {
    const { data: driver } = await supabase
      .from('drivers')
      .select('steam_verified, first_name, last_name, driver_number')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!driver?.steam_verified) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/steam/link';
      url.search = '';
      return NextResponse.redirect(url);
    }

    // ── Profile-completion gate ────────────────────────────────────────────
    // Linking Discord + Steam alone left first_name/last_name/driver_number
    // NULL (see auth/callback/route.ts's newcomer insert) — drivers were
    // showing up nameless in results/standings/registration. /profile itself
    // must stay reachable or a driver missing these could never fix it.
    if ((!driver.first_name || !driver.last_name || driver.driver_number == null) &&
      request.nextUrl.pathname !== '/profile'
    ) {
      const url = request.nextUrl.clone();
      url.pathname = '/profile';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

// Paths the Steam gate must never block: the whole auth flow (Discord + Steam
// callbacks, sign-out) and the gate landing page.
function isGateExempt(pathname: string): boolean {
  return pathname.startsWith('/auth/');
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
