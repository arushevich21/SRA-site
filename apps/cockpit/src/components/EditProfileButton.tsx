'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

// "Edit Profile" on /drivers/[id], shown only when the viewer owns that driver
// row. Checked client-side so the public page stays ISR-cached (an auth-cookie
// read on the server would make it dynamic for everyone). getSession(), not
// getUser(): see the GoTrue lock note in NavBar. Purely cosmetic — /profile
// only ever edits the signed-in user's own row.
export function EditProfileButton({ driverId }: { driverId: string }) {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const { data } = await supabase.from('drivers').select('id').eq('user_id', session.user.id).maybeSingle();
      if (active && data?.id === driverId) setIsOwner(true);
    });
    return () => {
      active = false;
    };
  }, [driverId]);

  if (!isOwner) return null;
  return (
    <Link
      href="/profile"
      className="inline-block font-mono text-[12px] tracking-[.2em] uppercase px-5 py-3 border border-line text-txt hover:border-gold hover:text-gold transition-colors whitespace-nowrap"
    >
      Edit Profile
    </Link>
  );
}
