'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getSimBySlug, SIMS, type SimConfig } from '@/content/sims';

type NavDrop = { label: string; href: string };
type NavItem =
  | { label: string; href: string; drop?: undefined }
  | { label: string; href: string; drop: NavDrop[] };

const MAIN_NAV: NavItem[] = [
  {
    label: 'About',
    href: '/about',
    drop: [
      { label: 'League Info', href: '/about/league-info' },
      { label: 'Rules & Regs', href: '/about/rules' },
      { label: 'Reference Lap Times', href: '/about/reference-lap-times' },
      { label: 'Custom BoP', href: '/about/custom-bop' },
      { label: 'SRAting', href: '/about/srating' },
      { label: 'Drivers & Stats', href: '/about/drivers' },
      { label: 'Statistics', href: '/about/stats' },
      { label: 'Accolades', href: '/about/accolades' },
      { label: 'Partners', href: '/about/partners' },
      { label: 'Sponsor', href: '/about/sponsor' },
      { label: 'Donate', href: '/about/donate' },
      { label: 'Discord', href: '/about/discord' },
    ],
  },
  { label: 'Store', href: '/store' },
];

function buildSimNav(slug: string): NavItem[] {
  return [
    { label: 'Championships', href: `/${slug}/championships` },
    { label: 'Calendar', href: `/${slug}/calendar` },
    { label: 'Register', href: `/${slug}/register` },
    { label: 'Leaderboards', href: `/${slug}/leaderboards` },
    { label: 'Standings', href: `/${slug}/standings` },
  ];
}

function useSimContext(): { sim: SimConfig | null; subPath: string } {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0] ?? '';
  const sim = getSimBySlug(firstSegment) ?? null;
  const subPath = sim ? '/' + segments.slice(1).join('/') : '';
  return { sim, subPath };
}

const LINK_CLS =
  'text-[12.5px] font-semibold tracking-[.13em] uppercase text-txt px-[13px] py-[10px] hover:text-gold-soft transition-colors whitespace-nowrap';

export default function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const { sim, subPath } = useSimContext();
  const nav = sim ? buildSimNav(sim.slug) : MAIN_NAV;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={[
        'fixed top-0 left-0 right-0 z-[100]',
        'transition-[background-color,border-color,backdrop-filter] duration-[350ms]',
        scrolled
          ? 'bg-[rgba(9,10,13,.82)] backdrop-blur-[14px] border-b border-line'
          : 'border-b border-transparent',
      ].join(' ')}
    >
      <div className="max-w-[1280px] mx-auto px-7 flex items-center justify-between h-[76px]">

        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <Image
            src="/sra_logo.png"
            alt="Sim Racing Alliance"
            width={480}
            height={120}
            className="h-[40px] w-auto object-contain"
          />
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1" aria-label="Primary navigation">
          {/* Sim selector pills — shown on main pages */}
          {!sim && (
            <div className="flex items-center gap-1 mr-2">
              {SIMS.map((s) => (
                <Link
                  key={s.slug}
                  href={`/${s.slug}`}
                  className="text-[12.5px] font-semibold tracking-[.13em] uppercase px-[13px] py-[10px] transition-colors whitespace-nowrap hover:text-txt"
                  style={{ color: s.accentColor }}
                >
                  {s.game}
                </Link>
              ))}
              <span className="w-px h-5 bg-line-2 mx-1" />
            </div>
          )}

          {/* Sim context nav — shown on sim pages */}
          {sim && (
            <>
              <Link
                href="/"
                className="text-[12.5px] font-bold tracking-[.13em] uppercase px-[13px] py-[10px] transition-colors whitespace-nowrap"
                style={{ color: '#e6b53d' }}
              >
                Home
              </Link>
              <span className="w-px h-5 bg-line-2 mx-1" />
              <div className="nav-has relative">
                <span
                  className="flex items-center gap-2 px-3 py-[6px] border rounded cursor-default select-none transition-colors hover:bg-panel-2"
                  style={{ borderColor: `${sim.accentColor}40` }}
                >
                  <span
                    className="w-[7px] h-[7px] rounded-full shrink-0"
                    style={{ backgroundColor: sim.accentColor }}
                  />
                  <span
                    className="text-[12px] font-bold tracking-[.13em] uppercase whitespace-nowrap"
                    style={{ color: sim.accentColor }}
                  >
                    {sim.game}
                  </span>
                  <span className="text-[11px] ml-[2px]" style={{ color: `${sim.accentColor}80` }}>▾</span>
                </span>
                <div className="nav-drop">
                  {SIMS.map((s) => (
                    <Link
                      key={s.slug}
                      href={s.slug === sim.slug ? `/${s.slug}` : `/${s.slug}${subPath}`}
                      style={s.slug === sim.slug ? { color: s.accentColor, borderLeftColor: s.accentColor } : undefined}
                    >
                      <span
                        className="inline-block w-[6px] h-[6px] rounded-full mr-2 shrink-0"
                        style={{ backgroundColor: s.accentColor }}
                      />
                      {s.game}
                    </Link>
                  ))}
                </div>
              </div>
              <span className="w-px h-5 bg-line-2 mx-2" />
            </>
          )}

          {nav.map((item) =>
            item.drop ? (
              <div key={item.label} className="nav-has relative">
                <span className={`${LINK_CLS} flex items-center gap-[5px] cursor-pointer`}>
                  {item.label}
                  <span className="text-[8px] opacity-50">▾</span>
                </span>
                <div className="nav-drop">
                  {item.drop.map((sub) => (
                    <Link key={sub.href} href={sub.href}>
                      {sub.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link key={item.href} href={item.href} className={LINK_CLS}>
                {item.label}
              </Link>
            )
          )}

          <a href="/sign-in" className="nav-signin">
            <span style={{ display: 'inline-block', transform: 'skewX(9deg)' }}>
              Sign In
            </span>
          </a>
        </nav>
      </div>
    </header>
  );
}
