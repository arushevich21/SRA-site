import { createSupabaseServerClient } from '@/lib/supabase-server';
import { buildLoginUrl } from '@/lib/steam-openid';
import { redirect } from 'next/navigation';

// Kicks off Steam OpenID. Requires an existing Discord session — Steam is an
// identity we attach to the already-signed-in user, not a standalone login.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect('/auth/login');

  return redirect(buildLoginUrl(origin));
}
