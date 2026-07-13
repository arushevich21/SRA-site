import type { Metadata } from 'next';
import { Hanken_Grotesk, Saira_Condensed, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import NavBar, { type NavUser } from '@/components/NavBar';
import { SponsorsCarousel } from '@/components/SponsorsCarousel';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
});

const saira = Saira_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800', '900'],
  variable: '--font-saira',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sim Racing Alliance',
  description: 'Competitive multi-sim racing league — ACC, LMU, AC EVO and beyond.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let navUser: NavUser | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: driver } = await supabase
        .from('drivers')
        .select('display_name, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (driver) navUser = driver;
    }
  } catch {
    // Supabase env vars may be absent in preview/test builds — degrade gracefully.
  }

  return (
    <html
      lang="en"
      className={`${hanken.variable} ${saira.variable} ${mono.variable}`}
    >
      <body className="bg-carbon text-txt font-sans antialiased overflow-x-hidden">
        <NavBar user={navUser} />
        <main className="pt-[76px]">{children}</main>
        <SponsorsCarousel />
      </body>
    </html>
  );
}
