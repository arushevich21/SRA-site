'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type NavDrop = { label: string; href: string };
type NavItem =
  | { label: string; href: string; drop?: undefined }
  | { label: string; href: string; drop: NavDrop[] };

const NAV: NavItem[] = [
  { label: 'Calendar', href: '/calendar' },
  { label: 'Championships', href: '/championships' },
  {
    label: 'Leaderboards',
    href: '/leaderboards',
    drop: [
      { label: 'Hot Lap', href: '/leaderboards' },
      { label: 'Hot Lap · Seasonal', href: '/leaderboards/seasonal' },
      { label: 'Hot Stint', href: '/leaderboards/hot-stint' },
      { label: 'Stint Qualifying', href: '/leaderboards/stint-qualifying' },
      { label: 'Endurance Qualifying', href: '/leaderboards/endurance-qualifying' },
    ],
  },
  {
    label: 'Standings',
    href: '/standings',
    drop: [
      { label: 'GT3 Team Series', href: '/standings' },
      { label: 'Multiclass Mayhem', href: '/standings/multiclass' },
      { label: 'League in a Week', href: '/standings/litw' },
    ],
  },
  { label: 'Results', href: '/results' },
  {
    label: 'About',
    href: '/about',
    drop: [
      { label: 'League Info', href: '/about' },
      { label: 'Rules & Regs', href: '/about/rules' },
      { label: 'SRAting', href: '/about/srating' },
      { label: 'ACC Servers', href: '/about/servers' },
      { label: 'Reference Lap Times', href: '/about/lap-times' },
      { label: 'Drivers · Stats', href: '/about/drivers' },
      { label: 'Partners', href: '/about/partners' },
    ],
  },
  { label: 'Store', href: '/store' },
];

const LINK_CLS =
  'text-[12.5px] font-semibold tracking-[.13em] uppercase text-txt-2 px-[13px] py-[10px] hover:text-txt transition-colors whitespace-nowrap';

export default function NavBar() {
  const [scrolled, setScrolled] = useState(false);

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
        <Link href="/">
          <Image
            src="/sra_logo.png"
            alt="Sim Racing Alliance"
            width={76}
            height={76}
            className="h-[40px] w-auto object-contain"
          />
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1" aria-label="Primary navigation">
          {NAV.map((item) =>
            item.drop ? (
              <div key={item.label} className="nav-has relative">
                <span className={`${LINK_CLS} flex items-center gap-[5px] cursor-default select-none`}>
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
