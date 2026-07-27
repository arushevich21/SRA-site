import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
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
      .select('steam_verified')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!driver?.steam_verified) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/steam/link';
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
