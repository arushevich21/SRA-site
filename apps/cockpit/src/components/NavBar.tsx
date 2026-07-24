'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getSimBySlug, SIMS, type SimConfig } from '@/content/sims';
import { getStandingsKey, type ChampionshipContent } from '@/content/championships';
import { GameLabel } from '@/components/GameLabel';

export type NavUser = {
  display_name: string | null;
  avatar_url: string | null;
};

type NavDrop = { label: string; href: string };
type NavItem =
  | { label: string; href: string; drop?: undefined }
  // clickParent: render the parent label itself as a link to `href` (desktop)
  // instead of a hover-only span. Used by Calendar so the word opens the
  // cumulative calendar while the dropdown still lists each championship.
  | { label: string; href: string; drop: NavDrop[]; clickParent?: boolean };

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
      { label: 'Support SRA', href: '/about/sponsor' },
      { label: 'Discord', href: '/about/discord' },
    ],
  },
  { label: 'Calendar', href: '/calendar' },
  { label: 'Store', href: 'https://exclaim.gg/store/simracingalliance' },
];

// Only worth a dropdown once a sim actually has more than one championship
// for that tab — a single-item dropdown is just a redundant extra click, so
// those fall back to a plain direct link (same as before this existed).
function tabNavItem(
  sim: SimConfig,
  label: string,
  tab: string,
  champs: ChampionshipContent[],
  // Whether to lead the dropdown with an "All {label}" link to the tab index.
  // Register has no meaningful "all" landing (you sign up per championship), so
  // it opts out — the dropdown lists only the individual championships.
  includeAllItem = true,
  // Whether the parent label links to the tab index (see NavItem.clickParent).
  // The tab index then replaces the "All" head as the way to reach it.
  clickableParent = false,
): NavItem {
  const href = `/${sim.slug}/${tab}`;
  if (champs.length === 0) return { label, href };
  if (champs.length === 1) {
    // A dropdown of one is redundant. If the parent isn't itself a link and
    // has no "all" head, point straight at the lone championship (Register);
    // otherwise fall back to the tab index (clickable parent still reaches it).
    if (!includeAllItem && !clickableParent) {
      return { label, href: `/${sim.slug}/championships/${champs[0].slug}/${tab}` };
    }
    return { label, href };
  }

  const champLinks = champs.map((c) => ({
    label: c.title,
    href: `/${sim.slug}/championships/${c.slug}/${tab}`,
  }));

  return {
    label,
    href,
    clickParent: clickableParent || undefined,
    drop: includeAllItem
      ? [{ label: `All ${label}`, href }, ...champLinks]
      : champLinks,
  };
}

function buildSimNav(sim: SimConfig, championships: ChampionshipContent[]): NavItem[] {
  const champsForSim = championships.filter((c) => c.game === sim.game);
  const calendarChamps = champsForSim.filter((c) => c.schedule.length > 0 && !c.teaserOnly);
  const standingsChamps = champsForSim.filter(
    (c) => c.emperorChampionshipId || (!c.teaserOnly && getStandingsKey(c)),
  );
  const leaderboardChamps = champsForSim.filter((c) => c.emperorChampionshipId);
  // Only championships with registration currently OPEN belong in the Register
  // menu — a closed/disabled one drops out (and the whole Register item goes
  // away once none are open).
  const registerChamps = champsForSim.filter(
    (c) => c.registrationKey && c.registrationOpen,
  );

  // ACC leaderboards split into Hot Lap / (Seasonal) / (Endurance). The
  // "Leaderboards" word opens the always-on Hot Lap board. Seasonal and
  // Endurance each appear only once a championship of that type has released a
  // round (endurance = formatTag "Endurance"). Other sims keep the champ list.
  const isEndurance = (c: ChampionshipContent) =>
    (c.formatTag ?? '').trim().toLowerCase() === 'endurance';
  const hasSeasonal = champsForSim.some(
    (c) => !isEndurance(c) && c.schedule.some((r) => r.hotlapReleased),
  );
  const hasEndurance = champsForSim.some(
    (c) => isEndurance(c) && c.schedule.some((r) => r.hotlapReleased),
  );
  const leaderboardItem: NavItem =
    sim.game === 'ACC'
      ? {
          label: 'Leaderboards',
          href: `/${sim.slug}/leaderboards`,
          clickParent: true,
          drop: [
            { label: 'Hot Lap', href: `/${sim.slug}/leaderboards` },
            ...(hasSeasonal
              ? [{ label: 'Hot Lap (Seasonal)', href: `/${sim.slug}/leaderboards/seasonal` }]
              : []),
            ...(hasEndurance
              ? [{ label: 'Hot Lap (Endurance)', href: `/${sim.slug}/leaderboards/endurance` }]
              : []),
          ],
        }
      : tabNavItem(sim, 'Leaderboards', 'leaderboards', leaderboardChamps);

  return [
    { label: 'Championships', href: `/${sim.slug}/championships` },
    // Calendar keeps its per-championship dropdown but drops the "All" head —
    // clicking the "Calendar" word itself goes to the cumulative sim calendar.
    tabNavItem(sim, 'Calendar', 'calendar', calendarChamps, false, true),
    // Register always shows. With open championships it's a dropdown of them;
    // with none open it's a plain link to /[sim]/register, which renders the
    // "coming soon — watch Discord" state.
    tabNavItem(sim, 'Register', 'register', registerChamps, false),
    leaderboardItem,
    tabNavItem(sim, 'Standings', 'standings', standingsChamps),
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

// ── Hamburger / Close icon ──────────────────────────────────────────────────
function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <div className="w-5 h-[18px] flex flex-col justify-between">
      <span
        className={[
          'block h-[2px] bg-txt transition-all duration-200 origin-center',
          open ? 'translate-y-[8px] rotate-45' : '',
        ].join(' ')}
      />
      <span
        className={[
          'block h-[2px] bg-txt transition-all duration-200',
          open ? 'opacity-0 scale-x-0' : '',
        ].join(' ')}
      />
      <span
        className={[
          'block h-[2px] bg-txt transition-all duration-200 origin-center',
          open ? '-translate-y-[8px] -rotate-45' : '',
        ].join(' ')}
      />
    </div>
  );
}

export default function NavBar({
  user,
  championships = [],
}: {
  user?: NavUser | null;
  championships?: ChampionshipContent[];
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { sim } = useSimContext();
  const nav = sim ? buildSimNav(sim, championships) : MAIN_NAV;

  // Close mobile menu on navigation
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <>
      <header
        className={[
          'fixed top-0 left-0 right-0 z-[100]',
          'transition-[background-color,border-color,backdrop-filter] duration-[350ms]',
          scrolled || menuOpen
            ? 'bg-[rgba(9,10,13,.95)] backdrop-blur-[14px] border-b border-line'
            : 'border-b border-transparent',
        ].join(' ')}
      >
        <div className="max-w-[1280px] mx-auto px-7 flex items-center justify-between h-[76px]">

          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 shrink-0" onClick={close}>
            <Image
              src="/badges/GT3TSAsset_white.png"
              alt="Sim Racing Alliance"
              width={480}
              height={120}
              className="h-[36px] w-auto object-contain"
            />
          </Link>

          {/* Desktop nav — hidden on mobile */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Primary navigation">
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
                    <GameLabel game={s.game} />
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
                      <GameLabel game={sim.game} />
                    </span>
                    <span className="text-[11px] ml-[2px]" style={{ color: `${sim.accentColor}80` }}>▾</span>
                  </span>
                  <div className="nav-drop">
                    {SIMS.map((s) => (
                      <Link
                        key={s.slug}
                        href={`/${s.slug}`}
                        style={s.slug === sim.slug ? { color: s.accentColor, borderLeftColor: s.accentColor } : undefined}
                      >
                        <span
                          className="inline-block w-[6px] h-[6px] rounded-full mr-2 shrink-0"
                          style={{ backgroundColor: s.accentColor }}
                        />
                        <GameLabel game={s.game} />
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
                  {item.clickParent ? (
                    <Link href={item.href} className={`${LINK_CLS} flex items-center gap-[5px]`}>
                      {item.label}
                      <span className="text-[8px] opacity-50">▾</span>
                    </Link>
                  ) : (
                    <span className={`${LINK_CLS} flex items-center gap-[5px] cursor-pointer`}>
                      {item.label}
                      <span className="text-[8px] opacity-50">▾</span>
                    </span>
                  )}
                  <div className="nav-drop">
                    {item.drop.map((sub) => (
                      <Link key={sub.href} href={sub.href}>
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : item.href.startsWith('http') ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_CLS}
                >
                  {item.label}
                </a>
              ) : (
                <Link key={item.href} href={item.href} className={LINK_CLS}>
                  {item.label}
                </Link>
              )
            )}

            {user ? (
              <div className="flex items-center gap-3 ml-1">
                {user.avatar_url && (
                  <Image
                    src={user.avatar_url}
                    alt={user.display_name ?? ''}
                    width={28}
                    height={28}
                    className="rounded-full shrink-0"
                  />
                )}
                <Link
                  href="/profile"
                  className="text-[12.5px] font-semibold tracking-[.1em] uppercase text-txt hover:text-gold-soft transition-colors whitespace-nowrap"
                >
                  {user.display_name ?? 'Account'}
                </Link>
                <form action="/auth/signout" method="POST">
                  <button type="submit" className="nav-signin">
                    <span style={{ display: 'inline-block', transform: 'skewX(9deg)' }}>
                      Sign Out
                    </span>
                  </button>
                </form>
              </div>
            ) : (
              <a href="/auth/login" className="nav-signin">
                <span style={{ display: 'inline-block', transform: 'skewX(9deg)' }}>
                  Sign In
                </span>
              </a>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 -mr-2"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <HamburgerIcon open={menuOpen} />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={[
          'md:hidden fixed top-[76px] left-0 right-0 bottom-0 z-[99]',
          'bg-[rgba(9,10,13,.98)] overflow-y-auto border-t border-line',
          'transition-[opacity,visibility] duration-200',
          menuOpen ? 'opacity-100 visible' : 'opacity-0 invisible',
        ].join(' ')}
        aria-hidden={!menuOpen}
      >
        <div className="px-7 py-6 flex flex-col">

          {/* Sim switcher — main pages show all sims, sim pages show switcher */}
          <div className="mb-2">
            <p className="font-mono text-[10px] tracking-[.35em] uppercase text-txt-3 mb-3">
              {sim ? 'Switch Sim' : 'Choose Your Sim'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SIMS.map((s) => (
                <Link
                  key={s.slug}
                  href={`/${s.slug}`}
                  className="flex items-center gap-2 px-4 py-3 border transition-colors"
                  style={{
                    borderColor: `${s.accentColor}30`,
                    backgroundColor: sim?.slug === s.slug ? `${s.accentColor}10` : undefined,
                  }}
                  onClick={close}
                >
                  <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: s.accentColor }} />
                  <span className="font-mono text-[12px] font-bold tracking-[.12em] uppercase" style={{ color: s.accentColor }}>
                    <GameLabel game={s.game} />
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="border-t border-line my-5" />

          {/* Sim context sub-nav */}
          {sim && (
            <>
              <Link href="/" className="flex items-center gap-3 py-3 text-[13px] font-semibold tracking-[.1em] uppercase text-txt-2 hover:text-gold transition-colors" onClick={close}>
                ← Home
              </Link>
              {buildSimNav(sim, championships).map((item) =>
                item.drop ? (
                  <div key={item.label}>
                    <Link
                      href={item.href}
                      className={[
                        'flex items-center gap-3 py-3 border-b border-line/30',
                        'text-[14px] font-semibold tracking-[.08em] uppercase transition-colors',
                        pathname === item.href ? 'text-gold' : 'text-txt hover:text-gold-soft',
                      ].join(' ')}
                      onClick={close}
                    >
                      {item.label}
                    </Link>
                    <div className="pl-4">
                      {item.drop.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={[
                            'flex items-center py-[10px] border-b border-line/20',
                            'text-[12.5px] font-semibold tracking-[.06em] uppercase transition-colors',
                            pathname === sub.href ? 'text-gold' : 'text-txt-2 hover:text-gold-soft',
                          ].join(' ')}
                          onClick={close}
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'flex items-center gap-3 py-3 border-b border-line/30',
                      'text-[14px] font-semibold tracking-[.08em] uppercase transition-colors',
                      pathname === item.href ? 'text-gold' : 'text-txt hover:text-gold-soft',
                    ].join(' ')}
                    onClick={close}
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </>
          )}

          {/* Main-page nav */}
          {!sim && nav.map((item) =>
            item.drop ? (
              <div key={item.label}>
                <p className="font-mono text-[10px] tracking-[.35em] uppercase text-txt-3 mt-2 mb-2">
                  {item.label}
                </p>
                {item.drop.map((sub) => (
                  <Link
                    key={sub.href}
                    href={sub.href}
                    className={[
                      'flex items-center py-[10px] border-b border-line/30 pl-2',
                      'text-[13px] font-semibold tracking-[.08em] uppercase transition-colors',
                      pathname === sub.href ? 'text-gold' : 'text-txt-2 hover:text-gold-soft',
                    ].join(' ')}
                    onClick={close}
                  >
                    {sub.label}
                  </Link>
                ))}
              </div>
            ) : item.href.startsWith('http') ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center py-3 border-b border-line/30 text-[14px] font-semibold tracking-[.08em] uppercase transition-colors text-txt hover:text-gold-soft"
                onClick={close}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'flex items-center py-3 border-b border-line/30',
                  'text-[14px] font-semibold tracking-[.08em] uppercase transition-colors',
                  pathname === item.href ? 'text-gold' : 'text-txt hover:text-gold-soft',
                ].join(' ')}
                onClick={close}
              >
                {item.label}
              </Link>
            )
          )}

          <div className="border-t border-line mt-5 mb-5" />

          {user ? (
            <div className="flex items-center gap-3">
              {user.avatar_url && (
                <Image
                  src={user.avatar_url}
                  alt={user.display_name ?? ''}
                  width={32}
                  height={32}
                  className="rounded-full shrink-0"
                />
              )}
              <div>
                <Link
                  href="/profile"
                  className="block font-semibold text-[14px] tracking-[.06em] uppercase text-txt hover:text-gold transition-colors"
                  onClick={close}
                >
                  {user.display_name ?? 'Account'}
                </Link>
              </div>
              <form action="/auth/signout" method="POST" className="ml-auto">
                <button
                  type="submit"
                  onClick={close}
                  className="nav-signin self-start"
                >
                  <span style={{ display: 'inline-block', transform: 'skewX(9deg)' }}>
                    Sign Out
                  </span>
                </button>
              </form>
            </div>
          ) : (
            <a href="/auth/login" className="nav-signin self-start" onClick={close}>
              <span style={{ display: 'inline-block', transform: 'skewX(9deg)' }}>
                Sign In
              </span>
            </a>
          )}
        </div>
      </div>
    </>
  );
}
