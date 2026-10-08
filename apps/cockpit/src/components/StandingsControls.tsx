import Link from 'next/link';
import type { AccsmTarget } from '@/content/championships';
import { DivisionBadge } from './DivisionBadge';
import { DriverTierBadge } from './DriverTierBadge';
import { LinkPendingBar } from './LinkPendingBar';
import {
  standingsViewHref,
  type StandingsTierFilter,
  type StandingsView,
} from '@/lib/standings-view';

// All three controls are <Link>s, not buttons — see lib/standings-view.ts for
// why the view lives in the URL. Server components throughout; the only client
// JS is LinkPendingBar, which shows a click registered while the server
// renders the next view.
//
// Every control uses a full `prefetch`: the page reads searchParams, so it is
// dynamic, and Next's default prefetch for a dynamic route stops at the
// loading boundary — each click then waited on a full server render. Full
// prefetch renders the neighbouring views as soon as the controls are on
// screen, so switching is instant. Affordable because a view is ~120 KB
// (see CarLogo) and the Emperor fetch behind it is cached for 5 minutes and
// shared across views (lib/emperor-standings.ts), so prefetching costs ACCSM
// nothing extra.

const TAB_BASE = 'relative px-4 py-2 border-b-2 transition-all';
const PILL_BASE =
  'relative font-mono text-[11px] tracking-[.2em] uppercase px-3 py-1.5 border transition-colors';

/** Division tab strip. One tab per ACCSM championship the series spans. */
export function DivisionTabs({
  targets,
  basePath,
  view,
  activeDivision,
}: {
  targets: AccsmTarget[];
  basePath: string;
  view: StandingsView;
  activeDivision: number;
}) {
  // Inset-shadow baseline rather than a border the tabs overlap with -mb-px —
  // see LeaderboardTabs for the stray scrollbar that overhang caused.
  return (
    <div className="flex gap-1 mb-6 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-line)]">
      {targets.map((t) => {
        const active = t.divisionId === activeDivision;
        return (
          <Link
            key={t.divisionId}
            href={standingsViewHref(basePath, view, { division: t.divisionId })}
            prefetch
            aria-current={active ? 'page' : undefined}
            className={[
              TAB_BASE,
              'whitespace-nowrap flex items-center',
              // The badge carries the identity, so the active state is the
              // underline plus full opacity — inactive tabs dim rather than
              // change colour, which artwork can't do.
              active
                ? 'border-gold opacity-100'
                : 'border-transparent opacity-45 hover:opacity-80',
            ].join(' ')}
          >
            <DivisionBadge division={t.divisionId} label={t.divisionName} height={30} />
            <LinkPendingBar />
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Drivers'/Teams' championship toggle, plus the Gold/Silver filter.
 *
 * The tier filter is rendered only on the drivers view: Emperor's team
 * standings carry a team name and points and nothing else — no steamId, so no
 * way to resolve a driver classification for a team row. Showing a disabled
 * control there would imply the filter means something for teams; it doesn't.
 */
export function StandingsViewControls({
  basePath,
  view,
  hasTeamStandings,
}: {
  basePath: string;
  view: StandingsView;
  hasTeamStandings: boolean;
}) {
  // Gold/Silver show the division's own tier badge (the same asset drivers
  // wear next to their name in the table) instead of the word, so the filter
  // reads as "show me these badges". Only possible when a division is
  // resolved — a single-grid event (LIAW) has no division badge to show, so
  // it keeps the text. The label stays as the link's accessible name either
  // way (sr-only when the badge renders).
  const tiers: { value: StandingsTierFilter; label: string; badgeTier: 'gold' | 'silver' | null }[] = [
    { value: 'all', label: 'All', badgeTier: null },
    { value: 'gold', label: 'Gold', badgeTier: 'gold' },
    { value: 'silver', label: 'Silver', badgeTier: 'silver' },
  ];
  const badgeDivision = view.division ?? null;

  return (
    <div className="flex items-center justify-between gap-6 flex-wrap mb-5">
      <div className="flex gap-1">
        <Link
          href={standingsViewHref(basePath, view, { entrant: 'drivers' })}
          prefetch
          className={[
            PILL_BASE,
            view.entrant === 'drivers'
              ? 'text-gold border-gold bg-gold/5'
              : 'text-txt-3 border-line hover:text-txt-2',
          ].join(' ')}
        >
          Drivers
          <LinkPendingBar />
        </Link>
        {/* Hidden entirely rather than disabled when the championship has no
            team standings — an ACCSM championship configured without teams
            returns an empty teamStandings map, and a toggle to a permanently
            empty table is worse than no toggle. */}
        {hasTeamStandings && (
          <Link
            href={standingsViewHref(basePath, view, { entrant: 'teams' })}
            prefetch
            className={[
              PILL_BASE,
              view.entrant === 'teams'
                ? 'text-gold border-gold bg-gold/5'
                : 'text-txt-3 border-line hover:text-txt-2',
            ].join(' ')}
          >
            Teams
            <LinkPendingBar />
          </Link>
        )}
      </div>

      {view.entrant === 'drivers' && (
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] tracking-[.2em] uppercase text-txt-3">Tier</span>
          <div className="flex gap-1">
            {tiers.map((t) => {
              const showBadge = t.badgeTier != null && badgeDivision != null;
              return (
                <Link
                  key={t.value}
                  href={standingsViewHref(basePath, view, { tier: t.value })}
                  prefetch
                  title={showBadge ? `D${badgeDivision} ${t.label}` : undefined}
                  className={[
                    PILL_BASE,
                    'inline-flex items-center',
                    // Badge pills: same height as the text pills, tighter
                    // horizontal padding so the graphic isn't floating in a box.
                    showBadge ? 'px-2 py-1' : '',
                    view.tier === t.value
                      ? 'text-gold border-gold bg-gold/5'
                      : 'text-txt-3 border-line hover:text-txt-2',
                    // Inactive badge pills sit back a little so the selected one reads.
                    showBadge && view.tier !== t.value ? 'opacity-60 hover:opacity-100' : '',
                  ].join(' ')}
                >
                  {showBadge ? (
                    <>
                      <DriverTierBadge isSralien={false} division={badgeDivision} tier={t.badgeTier} />
                      <span className="sr-only">{t.label}</span>
                    </>
                  ) : (
                    t.label
                  )}
                  <LinkPendingBar />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
