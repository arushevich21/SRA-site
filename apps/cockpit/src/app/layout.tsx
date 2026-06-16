import type { Metadata } from 'next';
import { Hanken_Grotesk, Saira_Condensed, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import NavBar from '@/components/NavBar';

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${hanken.variable} ${saira.variable} ${mono.variable}`}
    >
      <body className="bg-carbon text-txt font-sans antialiased overflow-x-hidden">
        <NavBar />
        <main className="pt-[76px]">{children}</main>
      </body>
    </html>
  );
}
