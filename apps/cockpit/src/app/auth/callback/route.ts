import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabase as adminClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[auth/callback] session exchange failed:', error?.message);
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  const user = data.session.user;

  // Extract Discord identity — Supabase Auth surfaces it in identities[]
  const discordIdentity = user.identities?.find((i) => i.provider === 'discord');
  const discordId =
    (discordIdentity?.identity_data?.sub as string | undefined) ??
    (discordIdentity?.identity_data?.provider_id as string | undefined) ??
    (user.user_metadata?.provider_id as string | undefined);

  // Prefer Discord's global_name (display name) over username.
  // Supabase sometimes maps full_name to the username when global_name is absent.
  const displayName =
    (discordIdentity?.identity_data?.global_name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    'Unknown';

  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ?? null;

  if (discordId) {
    // Check for an existing row (seeded or prior sign-in)
    const { data: existing } = await adminClient
      .from('drivers')
      .select('id')
      .eq('discord_id', discordId)
      .maybeSingle();

    if (existing) {
      // Claim the seeded row: attach user_id, refresh display name + avatar.
      // Does NOT touch steam_id — preserves pre-seeded value.
      const { error: updateErr } = await adminClient
        .from('drivers')
        .update({ user_id: user.id, display_name: displayName, avatar_url: avatarUrl })
        .eq('discord_id', discordId);

      if (updateErr) {
        console.error('[auth/callback] claim update failed:', updateErr.message);
      }
    } else {
      // Newcomer: create a fresh driver row (no steam_id yet)
      const { error: insertErr } = await adminClient
        .from('drivers')
        .insert({
          user_id: user.id,
          discord_id: discordId,
          display_name: displayName,
          avatar_url: avatarUrl,
        });

      if (insertErr) {
        console.error('[auth/callback] newcomer insert failed:', insertErr.message);
      }
    }
  } else {
    console.warn('[auth/callback] no discord_id found in session for user', user.id);
  }

  return NextResponse.redirect(origin);
}
