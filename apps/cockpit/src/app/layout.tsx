import type { Metadata } from 'next';
import { Hanken_Grotesk, Saira_Condensed, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import NavBar from '@/components/NavBar';
import { SponsorsCarousel } from '@/components/SponsorsCarousel';
import { Footer } from '@/components/Footer';
import { getChampionships } from '@/lib/championships-store';

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
  // Powers the per-sim championship dropdowns in the nav. Falls back to seed
  // content if the DB is unreachable/unseeded (see championships-store.ts).
  const championships = await getChampionships();

  return (
    <html
      lang="en"
      className={`${hanken.variable} ${saira.variable} ${mono.variable}`}
    >
      <body className="bg-carbon text-txt font-sans antialiased overflow-x-hidden min-h-screen flex flex-col">
        <NavBar championships={championships} />
        <main className="pt-[76px] flex-1">{children}</main>
        <SponsorsCarousel />
        <Footer />
      </body>
    </html>
  );
}
